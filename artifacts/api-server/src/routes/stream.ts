import { Router } from "express";
import {
  startStream,
  stopStream,
  getStreamStatus,
  StreamDestination,
} from "../lib/streamManager";

const streamRouter = Router();

// POST /api/stream/start
streamRouter.post("/stream/start", async (req, res) => {
  const { destinations, sourceUrl } = req.body as {
    destinations?: unknown;
    sourceUrl?: string | null;
  };

  if (!Array.isArray(destinations) || destinations.length === 0) {
    res.status(400).json({ error: "destinations array is required (at least one entry)" });
    return;
  }

  // Validate sourceUrl type if present
  if (sourceUrl !== undefined && sourceUrl !== null && typeof sourceUrl !== "string") {
    res.status(400).json({ error: "sourceUrl must be a string or null" });
    return;
  }

  const parsed: StreamDestination[] = [];
  for (const d of destinations) {
    if (typeof d !== "object" || d === null) {
      res.status(400).json({ error: "كل وجهة يجب أن تكون كائناً يحتوي على rtmpUrl وstreamKey" });
      return;
    }
    const raw = d as Record<string, unknown>;
    const rtmpUrl = typeof raw.rtmpUrl === "string" ? raw.rtmpUrl.trim() : "";
    const streamKey = typeof raw.streamKey === "string" ? raw.streamKey.trim() : "";
    if (!rtmpUrl || !streamKey) {
      res.status(400).json({ error: "كل وجهة يجب أن تحتوي على rtmpUrl وstreamKey غير فارغين" });
      return;
    }
    parsed.push({ rtmpUrl, streamKey });
  }

  const currentStatus = getStreamStatus();
  if (
    currentStatus.status === "live" ||
    currentStatus.status === "connecting"
  ) {
    res.status(409).json({ error: "يوجد بث جارٍ بالفعل" });
    return;
  }

  try {
    await startStream(parsed, sourceUrl ?? null);
    res.json(getStreamStatus());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "فشل في بدء البث";
    req.log.error({ err }, "Failed to start stream");
    res.status(500).json({ error: message });
  }
});

// POST /api/stream/stop
streamRouter.post("/stream/stop", (req, res) => {
  const currentStatus = getStreamStatus();
  if (
    currentStatus.status !== "live" &&
    currentStatus.status !== "connecting"
  ) {
    res.status(404).json({ error: "لا يوجد بث نشط" });
    return;
  }

  try {
    stopStream();
    res.json(getStreamStatus());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "فشل في إيقاف البث";
    req.log.error({ err }, "Failed to stop stream");
    res.status(500).json({ error: message });
  }
});

// GET /api/stream/status
streamRouter.get("/stream/status", (_req, res) => {
  res.json(getStreamStatus());
});

export default streamRouter;
