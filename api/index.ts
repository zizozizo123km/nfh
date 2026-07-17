/**
 * Vercel serverless entry-point — wraps the Express app.
 *
 * ⚠️  NOTE ON STREAMING:
 * The live-streaming functionality (FFmpeg, WebSocket) requires a
 * long-running persistent server. Vercel's serverless functions have a
 * maximum execution time (up to 300 s on Pro), so active streams will be
 * terminated after that limit.
 *
 * For production streaming, deploy the API server separately on a platform
 * that supports persistent processes (Render, Railway, Fly.io, a VPS, etc.)
 * and set the VITE_API_URL environment variable in your Vercel project to
 * point to that server.
 *
 * FFmpeg binary:
 * If FFMPEG_PATH is set in the Vercel environment, the stream manager uses
 * that binary.  Otherwise it falls back to the system `ffmpeg` (which is
 * not available on Vercel).  For Vercel, either set FFMPEG_PATH to a
 * bundled static binary or use a dedicated streaming server instead.
 */
import app from '../artifacts/api-server/src/app';

export default app;
