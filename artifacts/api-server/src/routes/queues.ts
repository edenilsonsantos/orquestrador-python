import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, queuesTable, queueItemsTable, machinesTable } from "@workspace/db";
import {
  CreateQueueBody,
  GetQueueParams,
  UpdateQueueParams,
  UpdateQueueBody,
  DeleteQueueParams,
  ListQueueItemsParams,
  ListQueueItemsQueryParams,
  EnqueueItemParams,
  EnqueueItemBody,
  DequeueItemParams,
  DequeueItemBody,
  GetQueueItemParams,
  UpdateQueueItemParams,
  UpdateQueueItemBody,
  ListQueuesResponse,
  GetQueueResponse,
  UpdateQueueResponse,
  ListQueueItemsResponse,
  GetQueueItemResponse,
  UpdateQueueItemResponse,
  DequeueItemResponse,
} from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

// Maps queue_item lifecycle statuses to the Queue summary counters.
async function getItemCounts(queueId: number) {
  const counts = await db
    .select({ status: queueItemsTable.status, count: sql<number>`count(*)::int` })
    .from(queueItemsTable)
    .where(eq(queueItemsTable.queueId, queueId))
    .groupBy(queueItemsTable.status);

  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.status] = row.count;

  return {
    pendingCount: countMap["new"] ?? 0,
    runningCount: countMap["in_progress"] ?? 0,
    completedCount: countMap["successful"] ?? 0,
    errorCount: (countMap["failed"] ?? 0) + (countMap["abandoned"] ?? 0),
  };
}

async function getQueueWithCounts(id: number) {
  const [queue] = await db.select().from(queuesTable).where(eq(queuesTable.id, id));
  if (!queue) return null;
  const counts = await getItemCounts(id);
  return { ...queue, ...counts };
}

const itemCols = {
  id: queueItemsTable.id,
  queueId: queueItemsTable.queueId,
  reference: queueItemsTable.reference,
  data: queueItemsTable.data,
  priority: queueItemsTable.priority,
  status: queueItemsTable.status,
  attempts: queueItemsTable.attempts,
  machineId: queueItemsTable.machineId,
  jobId: queueItemsTable.jobId,
  output: queueItemsTable.output,
  exception: queueItemsTable.exception,
  deadline: queueItemsTable.deadline,
  startedAt: queueItemsTable.startedAt,
  endedAt: queueItemsTable.endedAt,
  createdAt: queueItemsTable.createdAt,
  updatedAt: queueItemsTable.updatedAt,
  queueName: queuesTable.name,
  machineName: machinesTable.name,
};

async function getQueueItemWithNames(id: number) {
  const result = await db
    .select(itemCols)
    .from(queueItemsTable)
    .leftJoin(queuesTable, eq(queueItemsTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(queueItemsTable.machineId, machinesTable.id))
    .where(eq(queueItemsTable.id, id));
  return result[0] ?? null;
}

// Order: priority (high → normal → low), then FIFO by creation time.
const priorityOrder = sql`case ${queueItemsTable.priority} when 'high' then 0 when 'normal' then 1 else 2 end`;

router.get("/queues", async (_req, res): Promise<void> => {
  const queues = await db.select().from(queuesTable).orderBy(queuesTable.priority);
  const withCounts = await Promise.all(
    queues.map(async (queue) => ({ ...queue, ...(await getItemCounts(queue.id)) })),
  );
  res.json(ListQueuesResponse.parse(serialize(withCounts)));
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

// ── TRANSACTIONS (QUEUE ITEMS) ──────────────────────────────────────────────

router.get("/queues/:id/items", async (req, res): Promise<void> => {
  const params = ListQueueItemsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ListQueueItemsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [eq(queueItemsTable.queueId, params.data.id)];
  if (query.data.status) conditions.push(eq(queueItemsTable.status, query.data.status));

  const items = await db
    .select(itemCols)
    .from(queueItemsTable)
    .leftJoin(queuesTable, eq(queueItemsTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(queueItemsTable.machineId, machinesTable.id))
    .where(and(...conditions))
    .orderBy(priorityOrder, queueItemsTable.createdAt);
  res.json(ListQueueItemsResponse.parse(serialize(items)));
});

router.post("/queues/:id/items", async (req, res): Promise<void> => {
  const params = EnqueueItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = EnqueueItemBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [queue] = await db.select().from(queuesTable).where(eq(queuesTable.id, params.data.id));
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }

  const [item] = await db
    .insert(queueItemsTable)
    .values({
      queueId: params.data.id,
      reference: parsed.data.reference ?? null,
      data: parsed.data.data ?? null,
      priority: parsed.data.priority ?? "normal",
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
      status: "new",
    })
    .returning();

  const withNames = await getQueueItemWithNames(item.id);
  res.status(201).json(GetQueueItemResponse.parse(serialize(withNames)));
});

// Atomic claim of the next available transaction (FOR UPDATE SKIP LOCKED).
router.post("/queues/:id/dequeue", async (req, res): Promise<void> => {
  const params = DequeueItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = DequeueItemBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(queueItemsTable)
      .where(and(eq(queueItemsTable.queueId, params.data.id), eq(queueItemsTable.status, "new")))
      .orderBy(priorityOrder, queueItemsTable.createdAt)
      .limit(1)
      .for("update", { skipLocked: true });

    if (rows.length === 0) return null;
    const target = rows[0];
    const [updated] = await tx
      .update(queueItemsTable)
      .set({
        status: "in_progress",
        machineId: parsed.data.machineId ?? null,
        attempts: target.attempts + 1,
        startedAt: new Date(),
      })
      .where(eq(queueItemsTable.id, target.id))
      .returning();
    return updated;
  });

  if (!claimed) {
    res.sendStatus(204);
    return;
  }
  const withNames = await getQueueItemWithNames(claimed.id);
  res.json(DequeueItemResponse.parse(serialize(withNames)));
});

router.get("/queue-items/:id", async (req, res): Promise<void> => {
  const params = GetQueueItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const item = await getQueueItemWithNames(params.data.id);
  if (!item) {
    res.status(404).json({ error: "Queue item not found" });
    return;
  }
  res.json(GetQueueItemResponse.parse(serialize(item)));
});

router.patch("/queue-items/:id", async (req, res): Promise<void> => {
  const params = UpdateQueueItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateQueueItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(queueItemsTable).where(eq(queueItemsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Queue item not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.data !== undefined) updates.data = parsed.data.data;
  if (parsed.data.output !== undefined) updates.output = parsed.data.output;
  if (parsed.data.exception !== undefined) updates.exception = parsed.data.exception;

  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (["successful", "failed", "abandoned"].includes(parsed.data.status)) {
      updates.endedAt = new Date();
    } else if (parsed.data.status === "in_progress") {
      updates.startedAt = new Date();
    } else if (parsed.data.status === "new") {
      // Retry: re-queue and clear prior outcome.
      updates.machineId = null;
      updates.output = null;
      updates.exception = null;
      updates.startedAt = null;
      updates.endedAt = null;
      updates.attempts = existing.attempts + 1;
    }
  }

  const [updated] = await db
    .update(queueItemsTable)
    .set(updates)
    .where(eq(queueItemsTable.id, params.data.id))
    .returning();

  const withNames = await getQueueItemWithNames(updated.id);
  res.json(UpdateQueueItemResponse.parse(serialize(withNames)));
});

export default router;
