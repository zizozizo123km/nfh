import { Router } from "express";
import path from "path";
import fs from "fs";

const downloadRouter = Router();

downloadRouter.get("/download/project", (_req, res) => {
  const zipPath = path.resolve("/home/runner/workspace/live-stream-project.zip");
  if (!fs.existsSync(zipPath)) {
    res.status(404).json({ error: "الملف غير موجود" });
    return;
  }
  res.download(zipPath, "live-stream-project.zip");
});

export default downloadRouter;
