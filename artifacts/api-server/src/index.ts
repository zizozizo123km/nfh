import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import { getFfmpegStdin, getStreamStatus } from "./lib/streamManager";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Create HTTP server wrapping Express
const server = http.createServer(app);

// Attach WebSocket server at /ws
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws: WebSocket, req) => {
  logger.info({ url: req.url }, "WebSocket client connected");

  ws.on("message", (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
    if (!isBinary) {
      logger.warn("Received non-binary WebSocket message, ignoring");
      return;
    }

    const status = getStreamStatus();
    if (status.status !== "live" && status.status !== "connecting") {
      logger.warn({ status: status.status }, "Received video data but no active stream");
      return;
    }

    const stdin = getFfmpegStdin();
    if (!stdin || stdin.destroyed) {
      logger.warn("FFmpeg stdin not available, dropping chunk");
      return;
    }

    const chunk = Buffer.isBuffer(data)
      ? data
      : data instanceof ArrayBuffer
        ? Buffer.from(data)
        : Buffer.concat(data as Buffer[]);

    const ok = stdin.write(chunk);
    if (!ok) {
      logger.warn("FFmpeg stdin backpressure — chunk dropped");
    }
  });

  ws.on("close", (code, reason) => {
    logger.info({ code, reason: reason.toString() }, "WebSocket client disconnected");
  });

  ws.on("error", (err) => {
    logger.error({ err }, "WebSocket error");
  });
});

server.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket)");
});
