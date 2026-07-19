import { spawn, execFile, ChildProcess } from "child_process";
import { logger } from "./logger";

export type StreamStatus = "idle" | "connecting" | "live" | "error" | "stopped";
export type SourceMode = "camera" | "url";

export interface StreamDestination {
  rtmpUrl: string;
  streamKey: string;
}

interface StreamState {
  status: StreamStatus;
  destinations: StreamDestination[];
  sourceUrl: string | null;
  sourceMode: SourceMode;
  startedAt: string | null;
  error: string | null;
  ffmpegLastLines: string[];
  ffmpegProcess: ChildProcess | null;
}

const state: StreamState = {
  status: "idle",
  destinations: [],
  sourceUrl: null,
  sourceMode: "camera",
  startedAt: null,
  error: null,
  ffmpegLastLines: [],
  ffmpegProcess: null,
};

// ── yt-dlp ─────────────────────────────────────────────────────────────────

const YT_DLP_CANDIDATES = [
  "/home/runner/workspace/bin/yt-dlp",
  "/tmp/yt-dlp",
  "yt-dlp",
];

function findYtDlp(): string | null {
  const { execFileSync } = require("child_process") as typeof import("child_process");
  for (const candidate of YT_DLP_CANDIDATES) {
    try {
      execFileSync(candidate, ["--version"], { timeout: 5000, stdio: "pipe" });
      return candidate;
    } catch { /* try next */ }
  }
  return null;
}

function needsYtDlp(url: string): boolean {
  return (
    /youtube\.com\/(watch|live|shorts)/i.test(url) ||
    /youtu\.be\//i.test(url) ||
    /twitch\.tv\//i.test(url)
  );
}

function resolveWithYtDlp(pageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ytdlp = findYtDlp();
    if (!ytdlp) {
      return reject(new Error("yt-dlp غير متوفر. استخدم رابط m3u8 مباشراً."));
    }
    logger.info("Resolving URL with yt-dlp...");
    execFile(
      ytdlp,
      [
        "--no-warnings",
        "--no-playlist",
        // prefer a single merged mp4/ts that FFmpeg can read without DASH
        "-f", "bestvideo[ext=mp4][protocol=https]+bestaudio[ext=m4a][protocol=https]/bestvideo[protocol=https]+bestaudio[protocol=https]/best[protocol=https]/best",
        "--get-url",
        pageUrl,
      ],
      { timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(`فشل yt-dlp: ${stderr?.trim() || err.message}`));
        }
        // yt-dlp may return two lines (video + audio) for separate streams
        const lines = stdout.trim().split("\n").filter(Boolean);
        if (lines.length === 0) return reject(new Error("لم يُعثر على رابط من الصفحة."));
        logger.info({ lines: lines.length }, "yt-dlp resolved URL successfully");
        resolve(lines.join("\n")); // pass both lines for ffmpeg multi-input
      },
    );
  });
}

// ── helpers ─────────────────────────────────────────────────────────────────

export function getStreamStatus() {
  const durationSeconds =
    state.startedAt && state.status === "live"
      ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
      : null;

  return {
    status: state.status,
    rtmpUrl: state.destinations[0]?.rtmpUrl ?? null,
    destinationCount: state.destinations.length,
    startedAt: state.startedAt,
    error: state.error,
    durationSeconds,
  };
}

function maskRtmp(text: string): string {
  return text
    .replace(/(rtmps?:\/\/[^\s'"]+)/gi, "[rtmp-redacted]")
    .replace(/(rtmp:\/\/[^\s'"]+)/gi, "[rtmp-redacted]");
}

function maskDestination(url: string): string {
  const idx = url.lastIndexOf("/");
  return idx !== -1 && idx < url.length - 1
    ? url.slice(0, idx + 1) + "***"
    : "[redacted]";
}

/**
 * Returns true when FFmpeg exited after a real live stream but the only
 * "error" is that it could not write the FLV trailer (normal for RTMP live).
 */
function isNormalEndError(lines: string[]): boolean {
  const joined = lines.join("\n");
  return (
    /Error writing trailer/i.test(joined) ||
    /Error closing file/i.test(joined)
  );
}

/** Convert a raw FFmpeg error into a human-readable Arabic hint. */
function friendlyError(lines: string[], code: number | null, wasLive: boolean): string {
  const joined = lines.join("\n");

  if (/RTMP_ReadPacket|failed to read RTMP packet header/i.test(joined)) {
    return (
      "فشل الاتصال بخادم RTMP. الأسباب الشائعة:\n" +
      "• مفتاح البث منتهي الصلاحية أو غير صحيح\n" +
      "• انتظر دقيقة ثم حاول مجدداً (فيسبوك يرفض الاتصال الفوري بعد انتهاء جلسة سابقة)\n" +
      "• جرّب رابط rtmp:// بدلاً من rtmps://"
    );
  }
  if (/Error opening output/i.test(joined)) {
    return (
      "تعذّر فتح الاتصال بالخادم.\n" +
      "• تحقق من رابط RTMP ومفتاح البث\n" +
      "• إذا كنت تستخدم rtmps:// جرّب rtmp:// بدلاً منه"
    );
  }
  if (/Invalid data found|moov atom not found/i.test(joined)) {
    return "تعذّر قراءة الفيديو من المصدر. تأكد من صحة الرابط وأن الفيديو متاح للعرض العام.";
  }
  if (/Connection refused|Connection timed out/i.test(joined)) {
    return "الخادم رفض الاتصال. تحقق من رابط RTMP والمنفذ.";
  }
  if (wasLive && /Operation not permitted/i.test(joined)) {
    return "انتهى البث (انتهى المصدر أو أغلق الخادم الاتصال).";
  }
  return `FFmpeg توقف (رمز: ${code ?? "?"}).\nآخر رسالة: ${maskRtmp(lines[lines.length - 1] ?? "")}`;
}

// ── FFmpeg launcher ──────────────────────────────────────────────────────────

function buildRtmpDestination(dest: StreamDestination): string {
  return dest.rtmpUrl.endsWith("/")
    ? `${dest.rtmpUrl}${dest.streamKey}`
    : `${dest.rtmpUrl}/${dest.streamKey}`;
}

function launchFfmpeg(inputArgs: string[], destinations: StreamDestination[]): void {
  const encodingArgs = [
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-b:v", "2500k",
    "-maxrate", "2500k",
    "-bufsize", "5000k",
    "-pix_fmt", "yuv420p",
    "-g", "50",
    "-keyint_min", "25",
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
  ];

  let outputArgs: string[];

  if (destinations.length === 1) {
    // Single destination: use direct FLV output with rtmp_live flag
    const dest = buildRtmpDestination(destinations[0]);
    outputArgs = [...encodingArgs, "-rtmp_live", "live", "-f", "flv", dest];
    logger.info(
      { destination: maskDestination(dest), mode: state.sourceMode },
      "Launching FFmpeg (single destination)",
    );
  } else {
    // Multiple destinations: use tee muxer (encodes once, sends to all)
    // use_fifo=1 isolates each output so one slow/failed destination
    // does not stall or kill the others.
    const teeOutput = destinations
      .map(d => `[f=flv:use_fifo=1:fifo_options=attempt_recovery=1\\\\:drop_pkts_on_overflow=1]${buildRtmpDestination(d)}`)
      .join("|");
    outputArgs = [...encodingArgs, "-f", "tee", teeOutput];
    logger.info(
      {
        destinations: destinations.map(d => maskDestination(buildRtmpDestination(d))),
        mode: state.sourceMode,
        count: destinations.length,
      },
      "Launching FFmpeg (tee muxer — simulcast)",
    );
  }

  const ffmpegArgs = [...inputArgs, ...outputArgs];
  state.ffmpegLastLines = [];

  const ffmpegBin = process.env.FFMPEG_PATH ?? "ffmpeg";
  const ffmpeg = spawn(ffmpegBin, ffmpegArgs, { stdio: ["pipe", "pipe", "pipe"] });
  state.ffmpegProcess = ffmpeg;

  ffmpeg.stderr.on("data", (data: Buffer) => {
    const raw = data.toString();

    // Detect stream going live
    if (raw.includes("frame=") && state.status === "connecting") {
      state.status = "live";
      state.startedAt = new Date().toISOString();
      logger.info("Stream is now live");
    }

    // Keep a rolling buffer of last 20 meaningful lines for error reporting
    const safe = maskRtmp(raw).trim();
    if (safe) {
      for (const line of safe.split("\n")) {
        const l = line.trim();
        if (l && !l.startsWith("configuration:") && !l.startsWith("libav")) {
          state.ffmpegLastLines.push(l);
          if (state.ffmpegLastLines.length > 20) state.ffmpegLastLines.shift();
        }
      }
      logger.info({ ffmpeg: safe }, "FFmpeg output");
    }
  });

  ffmpeg.on("exit", (code, signal) => {
    logger.info({ code, signal }, "FFmpeg process exited");
    if (state.status === "live" || state.status === "connecting") {
      const wasLive = state.status === "live";
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        state.status = "stopped";
      } else if (code === 0) {
        state.status = "stopped";
      } else if (wasLive && isNormalEndError(state.ffmpegLastLines)) {
        state.status = "stopped";
      } else {
        state.status = "error";
        state.error = friendlyError(state.ffmpegLastLines, code, wasLive);
      }
    }
    state.ffmpegProcess = null;
  });

  ffmpeg.on("error", (err) => {
    logger.error({ err: err.message }, "FFmpeg process error");
    state.status = "error";
    state.error = err.message;
    state.ffmpegProcess = null;
  });
}

// ── public API ───────────────────────────────────────────────────────────────

export async function startStream(
  destinations: StreamDestination[],
  sourceUrl?: string | null,
): Promise<void> {
  if (state.status === "live" || state.status === "connecting") {
    throw new Error("يوجد بث جارٍ بالفعل");
  }
  if (!destinations || destinations.length === 0) {
    throw new Error("يجب تحديد منصة واحدة على الأقل");
  }

  const useUrlSource = !!(sourceUrl && sourceUrl.trim());

  state.status = "connecting";
  state.destinations = destinations;
  state.sourceUrl = useUrlSource ? sourceUrl! : null;
  state.sourceMode = useUrlSource ? "url" : "camera";
  state.startedAt = null;
  state.error = null;
  state.ffmpegLastLines = [];
  state.ffmpegProcess = null;

  if (!useUrlSource) {
    launchFfmpeg(["-re", "-i", "pipe:0"], destinations);
    return;
  }

  let resolvedUrl = sourceUrl!.trim();
  if (needsYtDlp(resolvedUrl)) {
    try {
      resolvedUrl = await resolveWithYtDlp(resolvedUrl);
    } catch (err: unknown) {
      state.status = "idle";
      throw err instanceof Error ? err : new Error("فشل في استخراج رابط البث");
    }
  }

  // yt-dlp may return two lines: video URL \n audio URL
  const urlLines = resolvedUrl.split("\n").filter(Boolean);
  let inputArgs: string[];
  if (urlLines.length >= 2) {
    // Two separate streams (DASH): give each as a separate -i and mix them
    inputArgs = [
      "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
      "-i", urlLines[0],
      "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
      "-i", urlLines[1],
      "-map", "0:v:0", "-map", "1:a:0",
    ];
  } else {
    inputArgs = [
      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_delay_max", "5",
      "-i", urlLines[0],
    ];
  }

  launchFfmpeg(inputArgs, destinations);
}

export function stopStream(): void {
  const ffmpeg = state.ffmpegProcess;
  if (!ffmpeg) throw new Error("لا يوجد بث نشط");

  logger.info("Stopping stream");
  state.status = "stopped";
  state.ffmpegProcess = null;

  ffmpeg.stdin?.end();
  const killTimer = setTimeout(() => {
    if (!ffmpeg.killed) {
      logger.warn("FFmpeg لم يتوقف — إرسال SIGTERM");
      ffmpeg.kill("SIGTERM");
    }
  }, 3000);
  ffmpeg.once("exit", () => clearTimeout(killTimer));
}

export function getFfmpegStdin() {
  if (state.sourceMode === "url") return null;
  return state.ffmpegProcess?.stdin ?? null;
}
