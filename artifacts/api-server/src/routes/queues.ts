import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, queuesTable, executionsTable } from "@workspace/db";
import {
  CreateQueueBody,
  GetQueueParams,
  UpdateQueueParams,
  UpdateQueueBody,
  DeleteQueueParams,
  ListQueueItemsParams,
  AddQueueItemParams,
  AddQueueItemBody,
  ListQueuesResponse,
  GetQueueResponse,
  UpdateQueueResponse,
  ListQueueItemsResponse,
} from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

async function getQueueWithCounts(id: number) {
  const [queue] = await db.select().from(queuesTable).where(eq(queuesTable.id, id));
  if (!queue) return null;

  const counts = await db
    .select({
      status: executionsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(executionsTable)
    .where(eq(executionsTable.queueId, id))
    .groupBy(executionsTable.status);

  const countMap: Record<string, number> = {};
  for (const row of counts) {
    countMap[row.status] = row.count;
  }

  return {
    ...queue,
    pendingCount: countMap["pending"] ?? 0,
    runningCount: countMap["running"] ?? 0,
    completedCount: countMap["completed"] ?? 0,
    errorCount: countMap["error"] ?? 0,
  };
}

router.get("/queues", async (_req, res): Promise<void> => {
  const queues = await db.select().from(queuesTable).orderBy(queuesTable.priority);

  const queuesWithCounts = await Promise.all(
    queues.map(async (queue) => {
      const counts = await db
        .select({
          status: executionsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(executionsTable)
        .where(eq(executionsTable.queueId, queue.id))
        .groupBy(executionsTable.status);

      const countMap: Record<string, number> = {};
      for (const row of counts) {
        countMap[row.status] = row.count;
      }

      return {
        ...queue,
        pendingCount: countMap["pending"] ?? 0,
        runningCount: countMap["running"] ?? 0,
        completedCount: countMap["completed"] ?? 0,
        errorCount: countMap["error"] ?? 0,
      };
    })
  );

  res.json(ListQueuesResponse.parse(serialize(queuesWithCounts)));
});

router.post("/queues", async (req, res): Promise<void> => {
  const parsed = CreateQueueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [queue] = await db.insert(queuesTable).values(parsed.data).returning();
  const withCounts = await getQueueWithCounts(queue.id);
  res.status(201).json(GetQueueResponse.parse(serialize(withCounts)));
});

router.get("/queues/:id", async (req, res): Promise<void> => {
  const params = GetQueueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const queue = await getQueueWithCounts(params.data.id);
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  res.json(GetQueueResponse.parse(serialize(queue)));
});

router.patch("/queues/:id", async (req, res): Promise<void> => {
  const params = UpdateQueueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateQueueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(queuesTable)
    .set(parsed.data)
    .where(eq(queuesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const withCounts = await getQueueWithCounts(updated.id);
  res.json(UpdateQueueResponse.parse(serialize(withCounts)));
});

router.delete("/queues/:id", async (req, res): Promise<void> => {
  const params = DeleteQueueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [queue] = await db.delete(queuesTable).where(eq(queuesTable.id, params.data.id)).returning();
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/queues/:id/items", async (req, res): Promise<void> => {
  const params = ListQueueItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const items = await db
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
    })
    .from(executionsTable)
    .where(eq(executionsTable.queueId, params.data.id))
    .orderBy(executionsTable.createdAt);
  res.json(ListQueueItemsResponse.parse(serialize(items)));
});

router.post("/queues/:id/items", async (req, res): Promise<void> => {
  const params = AddQueueItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddQueueItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [queue] = await db.select().from(queuesTable).where(eq(queuesTable.id, params.data.id));
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }

  const [execution] = await db
    .insert(executionsTable)
    .values({
      queueId: params.data.id,
      projectId: queue.projectId,
      machineId: parsed.data.machineId ?? null,
      inputData: parsed.data.inputData ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json(serialize({ ...execution, projectName: null, queueName: null, machineName: null }));
});

export default router;
