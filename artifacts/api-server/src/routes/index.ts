import { Router, type IRouter } from "express";
import healthRouter from "./health";
import machinesRouter from "./machines";
import projectsRouter from "./projects";
import queuesRouter from "./queues";
import executionsRouter from "./executions";
import schedulesRouter from "./schedules";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(machinesRouter);
router.use(projectsRouter);
router.use(queuesRouter);
router.use(executionsRouter);
router.use(schedulesRouter);
router.use(usersRouter);
router.use(dashboardRouter);

export default router;
