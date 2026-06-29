import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db,
  jobsTable,
  logLinesTable,
  machinesTable,
  projectsTable,
  queuesTable,
  automationsTable,
} from "@workspace/db";
import {
  ListJobsQueryParams,
  GetJobParams,
  GetJobLogsParams,
  RetryJobParams,
  StopJobParams,
  ListJobsResponse,
  GetJobResponse,
  GetJobLogsResponse,
  StopJobResponse,
} from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

const jobCols = {
  id: jobsTable.id,
  automationId: jobsTable.automationId,
  projectId: jobsTable.projectId,
  queueId: jobsTable.queueId,
  machineId: jobsTable.machineId,
  scheduleId: jobsTable.scheduleId,
  status: jobsTable.status,
  attempt: jobsTable.attempt,
  inputData: jobsTable.inputData,
  outputData: jobsTable.outputData,
  exitCode: jobsTable.exitCode,
  errorMessage: jobsTable.errorMessage,
  startedAt: jobsTable.startedAt,
  finishedAt: jobsTable.finishedAt,
  durationSeconds: jobsTable.durationSeconds,
  createdAt: jobsTable.createdAt,
  updatedAt: jobsTable.updatedAt,
  projectName: projectsTable.name,
  automationName: automationsTable.name,
  queueName: queuesTable.name,
  machineName: machinesTable.name,
};

function withJoins(q: any): any {
  return q
    .from(jobsTable)
    .leftJoin(projectsTable, eq(jobsTable.projectId, projectsTable.id))
    .leftJoin(automationsTable, eq(jobsTable.automationId, automationsTable.id))
    .leftJoin(queuesTable, eq(jobsTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(jobsTable.machineId, machinesTable.id));
}

async function getJobWithNames(id: number) {
  const result = await withJoins(db.select(jobCols)).where(eq(jobsTable.id, id));
  return result[0] ?? null;
}

router.get("/jobs", async (req, res): Promise<void> => {
  const params = ListJobsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.status) conditions.push(eq(jobsTable.status, params.data.status));
  if (params.data.projectId) conditions.push(eq(jobsTable.projectId, params.data.projectId));
  if (params.data.automationId) conditions.push(eq(jobsTable.automationId, params.data.automationId));
  if (params.data.machineId) conditions.push(eq(jobsTable.machineId, params.data.machineId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await withJoins(db.select(jobCols))
    .where(whereClause)
    .orderBy(desc(jobsTable.createdAt))
    .limit(params.data.limit ?? 50);

  res.json(ListJobsResponse.parse(serialize(results)));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const job = await getJobWithNames(params.data.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(GetJobResponse.parse(serialize(job)));
});

router.get("/jobs/:id/logs", async (req, res): Promise<void> => {
  const params = GetJobLogsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db
    .select()
    .from(logLinesTable)
    .where(eq(logLinesTable.jobId, params.data.id))
    .orderBy(logLinesTable.timestamp);
  res.json(GetJobLogsResponse.parse(serialize(logs)));
});

router.post("/jobs/:id/retry", async (req, res): Promise<void> => {
  const params = RetryJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const original = await getJobWithNames(params.data.id);
  if (!original) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const [newJob] = await db
    .insert(jobsTable)
    .values({
      automationId: original.automationId,
      projectId: original.projectId,
      queueId: original.queueId,
      machineId: original.machineId,
      inputData: original.inputData,
      status: "pending",
      attempt: original.attempt + 1,
    })
    .returning();
  res.status(201).json(
    serialize({
      ...newJob,
      projectName: original.projectName,
      automationName: original.automationName,
      queueName: original.queueName,
      machineName: original.machineName,
    }),
  );
});

router.post("/jobs/:id/stop", async (req, res): Promise<void> => {
  const params = StopJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db
    .update(jobsTable)
    .set({ status: "stopped", finishedAt: new Date() })
    .where(eq(jobsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  const withNames = await getJobWithNames(updated.id);
  res.json(StopJobResponse.parse(serialize(withNames)));
});

export default router;
