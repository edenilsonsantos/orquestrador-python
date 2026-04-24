import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, executionsTable, logLinesTable, machinesTable, projectsTable, queuesTable } from "@workspace/db";
import {
  ListExecutionsQueryParams,
  GetExecutionParams,
  ListExecutionsResponse,
  GetExecutionResponse,
  GetExecutionLogsResponse,
} from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

async function getExecutionWithNames(id: number) {
  const result = await db
    .select({
      id: executionsTable.id,
      queueId: executionsTable.queueId,
      projectId: executionsTable.projectId,
      machineId: executionsTable.machineId,
      status: executionsTable.status,
      attempt: executionsTable.attempt,
      inputData: executionsTable.inputData,
      exitCode: executionsTable.exitCode,
      errorMessage: executionsTable.errorMessage,
      startedAt: executionsTable.startedAt,
      finishedAt: executionsTable.finishedAt,
      durationSeconds: executionsTable.durationSeconds,
      createdAt: executionsTable.createdAt,
      updatedAt: executionsTable.updatedAt,
      projectName: projectsTable.name,
      queueName: queuesTable.name,
      machineName: machinesTable.name,
    })
    .from(executionsTable)
    .leftJoin(projectsTable, eq(executionsTable.projectId, projectsTable.id))
    .leftJoin(queuesTable, eq(executionsTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(executionsTable.machineId, machinesTable.id))
    .where(eq(executionsTable.id, id));
  return result[0] ?? null;
}

router.get("/executions", async (req, res): Promise<void> => {
  const params = ListExecutionsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conditions = [];
  if (params.data.status) conditions.push(eq(executionsTable.status, params.data.status));
  if (params.data.projectId) conditions.push(eq(executionsTable.projectId, params.data.projectId));
  if (params.data.machineId) conditions.push(eq(executionsTable.machineId, params.data.machineId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select({
      id: executionsTable.id,
      queueId: executionsTable.queueId,
      projectId: executionsTable.projectId,
      machineId: executionsTable.machineId,
      status: executionsTable.status,
      attempt: executionsTable.attempt,
      inputData: executionsTable.inputData,
      exitCode: executionsTable.exitCode,
      errorMessage: executionsTable.errorMessage,
      startedAt: executionsTable.startedAt,
      finishedAt: executionsTable.finishedAt,
      durationSeconds: executionsTable.durationSeconds,
      createdAt: executionsTable.createdAt,
      updatedAt: executionsTable.updatedAt,
      projectName: projectsTable.name,
      queueName: queuesTable.name,
      machineName: machinesTable.name,
    })
    .from(executionsTable)
    .leftJoin(projectsTable, eq(executionsTable.projectId, projectsTable.id))
    .leftJoin(queuesTable, eq(executionsTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(executionsTable.machineId, machinesTable.id))
    .where(whereClause)
    .orderBy(desc(executionsTable.createdAt))
    .limit(params.data.limit ?? 50);

  res.json(ListExecutionsResponse.parse(serialize(results)));
});

router.get("/executions/:id", async (req, res): Promise<void> => {
  const params = GetExecutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const execution = await getExecutionWithNames(params.data.id);
  if (!execution) {
    res.status(404).json({ error: "Execution not found" });
    return;
  }
  res.json(GetExecutionResponse.parse(serialize(execution)));
});

router.get("/executions/:id/logs", async (req, res): Promise<void> => {
  const params = GetExecutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const logs = await db
    .select()
    .from(logLinesTable)
    .where(eq(logLinesTable.executionId, params.data.id))
    .orderBy(logLinesTable.timestamp);
  res.json(GetExecutionLogsResponse.parse(serialize(logs)));
});

router.post("/executions/:id/retry", async (req, res): Promise<void> => {
  const params = GetExecutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const original = await getExecutionWithNames(params.data.id);
  if (!original) {
    res.status(404).json({ error: "Execution not found" });
    return;
  }
  const [newExec] = await db
    .insert(executionsTable)
    .values({
      queueId: original.queueId,
      projectId: original.projectId,
      machineId: original.machineId,
      inputData: original.inputData,
      status: "pending",
      attempt: original.attempt + 1,
    })
    .returning();
  res.status(201).json(serialize({ ...newExec, projectName: original.projectName, queueName: original.queueName, machineName: original.machineName }));
});

router.post("/executions/:id/stop", async (req, res): Promise<void> => {
  const params = GetExecutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db
    .update(executionsTable)
    .set({ status: "stopped", finishedAt: new Date() })
    .where(eq(executionsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Execution not found" });
    return;
  }
  const withNames = await getExecutionWithNames(updated.id);
  res.json(serialize(withNames));
});

export default router;
