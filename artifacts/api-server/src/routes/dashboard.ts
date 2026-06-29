import { Router, type IRouter } from "express";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import {
  db,
  jobsTable,
  queueItemsTable,
  machinesTable,
  queuesTable,
  projectsTable,
  automationsTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetJobStatsResponse,
  GetQueueHealthResponse,
  GetRecentJobsResponse,
} from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [jobsToday] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(gte(jobsTable.createdAt, today));

  const [jobsRunning] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(eq(jobsTable.status, "running"));

  const [jobsSuccessful] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(and(eq(jobsTable.status, "successful"), gte(jobsTable.createdAt, today)));

  const [jobsErrors] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobsTable)
    .where(and(eq(jobsTable.status, "faulted"), gte(jobsTable.createdAt, today)));

  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(queueItemsTable)
    .where(eq(queueItemsTable.status, "new"));

  const machineStats = await db
    .select({ status: machinesTable.status, count: sql<number>`count(*)::int` })
    .from(machinesTable)
    .groupBy(machinesTable.status);

  const queueStats = await db
    .select({ status: queuesTable.status, count: sql<number>`count(*)::int` })
    .from(queuesTable)
    .groupBy(queuesTable.status);

  const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable);
  const [automationCount] = await db.select({ count: sql<number>`count(*)::int` }).from(automationsTable);

  const machineMap: Record<string, number> = {};
  for (const row of machineStats) machineMap[row.status] = row.count;

  const queueMap: Record<string, number> = {};
  for (const row of queueStats) queueMap[row.status] = row.count;

  const totalToday = (jobsSuccessful?.count ?? 0) + (jobsErrors?.count ?? 0);
  const successRate = totalToday > 0 ? Math.round(((jobsSuccessful?.count ?? 0) / totalToday) * 100) : 0;

  const summary = {
    jobsToday: jobsToday?.count ?? 0,
    jobsRunning: jobsRunning?.count ?? 0,
    successRate,
    machinesOnline: machineMap["online"] ?? 0,
    machinesTotal: Object.values(machineMap).reduce((a, b) => a + b, 0),
    queuesActive: queueMap["active"] ?? 0,
    queuesPaused: queueMap["paused"] ?? 0,
    projectsTotal: projectCount?.count ?? 0,
    automationsTotal: automationCount?.count ?? 0,
    errorsToday: jobsErrors?.count ?? 0,
    pendingItems: pending?.count ?? 0,
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/job-stats", async (_req, res): Promise<void> => {
  const stats = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const [completed] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.status, "successful"),
          gte(jobsTable.createdAt, date),
          sql`${jobsTable.createdAt} < ${nextDate}`,
        ),
      );

    const [errors] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.status, "faulted"),
          gte(jobsTable.createdAt, date),
          sql`${jobsTable.createdAt} < ${nextDate}`,
        ),
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

  res.json(GetJobStatsResponse.parse(stats));
});

router.get("/dashboard/queue-health", async (_req, res): Promise<void> => {
  const queues = await db.select().from(queuesTable);

  const health = await Promise.all(
    queues.map(async (queue) => {
      const counts = await db
        .select({ status: queueItemsTable.status, count: sql<number>`count(*)::int` })
        .from(queueItemsTable)
        .where(eq(queueItemsTable.queueId, queue.id))
        .groupBy(queueItemsTable.status);

      const countMap: Record<string, number> = {};
      for (const row of counts) countMap[row.status] = row.count;

      return {
        queueId: queue.id,
        queueName: queue.name,
        pending: countMap["new"] ?? 0,
        running: countMap["in_progress"] ?? 0,
        completed: countMap["successful"] ?? 0,
        errors: (countMap["failed"] ?? 0) + (countMap["abandoned"] ?? 0),
        status: queue.status,
      };
    }),
  );

  res.json(GetQueueHealthResponse.parse(health));
});

router.get("/dashboard/recent-jobs", async (_req, res): Promise<void> => {
  const results = await db
    .select({
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
    })
    .from(jobsTable)
    .leftJoin(projectsTable, eq(jobsTable.projectId, projectsTable.id))
    .leftJoin(automationsTable, eq(jobsTable.automationId, automationsTable.id))
    .leftJoin(queuesTable, eq(jobsTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(jobsTable.machineId, machinesTable.id))
    .orderBy(desc(jobsTable.createdAt))
    .limit(10);

  res.json(GetRecentJobsResponse.parse(serialize(results)));
});

export default router;
