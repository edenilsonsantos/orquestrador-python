import { Router, type IRouter } from "express";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import { db, executionsTable, machinesTable, queuesTable, projectsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetExecutionStatsResponse,
  GetQueueHealthResponse,
  GetRecentExecutionsResponse,
} from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [execToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionsTable)
    .where(gte(executionsTable.createdAt, today));

  const [execRunning] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionsTable)
    .where(eq(executionsTable.status, "running"));

  const [execCompleted] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionsTable)
    .where(and(eq(executionsTable.status, "completed"), gte(executionsTable.createdAt, today)));

  const [execErrors] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionsTable)
    .where(and(eq(executionsTable.status, "error"), gte(executionsTable.createdAt, today)));

  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionsTable)
    .where(eq(executionsTable.status, "pending"));

  const machineStats = await db
    .select({ status: machinesTable.status, count: sql<number>`count(*)::int` })
    .from(machinesTable)
    .groupBy(machinesTable.status);

  const queueStats = await db
    .select({ status: queuesTable.status, count: sql<number>`count(*)::int` })
    .from(queuesTable)
    .groupBy(queuesTable.status);

  const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable);

  const machineMap: Record<string, number> = {};
  for (const row of machineStats) machineMap[row.status] = row.count;

  const queueMap: Record<string, number> = {};
  for (const row of queueStats) queueMap[row.status] = row.count;

  const totalToday = (execCompleted?.count ?? 0) + (execErrors?.count ?? 0);
  const successRate = totalToday > 0 ? Math.round(((execCompleted?.count ?? 0) / totalToday) * 100) : 0;

  const summary = {
    executionsToday: execToday?.count ?? 0,
    executionsRunning: execRunning?.count ?? 0,
    successRate,
    machinesOnline: machineMap["online"] ?? 0,
    machinesTotal: Object.values(machineMap).reduce((a, b) => a + b, 0),
    queuesActive: queueMap["active"] ?? 0,
    queuesPaused: queueMap["paused"] ?? 0,
    projectsTotal: projectCount?.count ?? 0,
    errorsToday: execErrors?.count ?? 0,
    pendingItems: pending?.count ?? 0,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/execution-stats", async (_req, res): Promise<void> => {
  const stats = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const [completed] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(executionsTable)
      .where(
        and(
          eq(executionsTable.status, "completed"),
          gte(executionsTable.createdAt, date),
          sql`${executionsTable.createdAt} < ${nextDate}`
        )
      );

    const [errors] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(executionsTable)
      .where(
        and(
          eq(executionsTable.status, "error"),
          gte(executionsTable.createdAt, date),
          sql`${executionsTable.createdAt} < ${nextDate}`
        )
      );

    const comp = completed?.count ?? 0;
    const err = errors?.count ?? 0;
    stats.push({
      date: date.toISOString().split("T")[0],
      completed: comp,
      errors: err,
      total: comp + err,
    });
  }

  res.json(GetExecutionStatsResponse.parse(stats));
});

router.get("/dashboard/queue-health", async (_req, res): Promise<void> => {
  const queues = await db.select().from(queuesTable);

  const health = await Promise.all(
    queues.map(async (queue) => {
      const counts = await db
        .select({ status: executionsTable.status, count: sql<number>`count(*)::int` })
        .from(executionsTable)
        .where(eq(executionsTable.queueId, queue.id))
        .groupBy(executionsTable.status);

      const countMap: Record<string, number> = {};
      for (const row of counts) countMap[row.status] = row.count;

      return {
        queueId: queue.id,
        queueName: queue.name,
        pending: countMap["pending"] ?? 0,
        running: countMap["running"] ?? 0,
        completed: countMap["completed"] ?? 0,
        errors: countMap["error"] ?? 0,
        status: queue.status,
      };
    })
  );

  res.json(GetQueueHealthResponse.parse(health));
});

router.get("/dashboard/recent-executions", async (_req, res): Promise<void> => {
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
    .orderBy(desc(executionsTable.createdAt))
    .limit(10);

  res.json(GetRecentExecutionsResponse.parse(serialize(results)));
});

export default router;
