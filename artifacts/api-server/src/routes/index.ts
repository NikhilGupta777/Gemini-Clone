import { Router, type IRouter } from "express";
import healthRouter from "./health";
import geminiRouter from "./gemini";
import documentsRouter from "./documents";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/gemini", geminiRouter);
router.use("/documents", documentsRouter);

export default router;
