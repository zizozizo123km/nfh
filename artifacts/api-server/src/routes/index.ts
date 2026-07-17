import { Router, type IRouter } from "express";
import healthRouter from "./health";
import streamRouter from "./stream";
import downloadRouter from "./download";

const router: IRouter = Router();

router.use(healthRouter);
router.use(streamRouter);
router.use(downloadRouter);

export default router;
