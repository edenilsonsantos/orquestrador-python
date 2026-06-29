import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, schedulesTable, queuesTable, automationsTable, machinesTable } from "@workspace/db";
import {
  CreateScheduleBody,
  GetScheduleParams,
  UpdateScheduleParams,
  UpdateScheduleBody,
  DeleteScheduleParams,
  ToggleScheduleBody,
  ListSchedulesResponse,
  GetScheduleResponse,
  UpdateScheduleResponse,
  ToggleScheduleResponse,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

const scheduleColumns = {
  id: schedulesTable.id,
  name: schedulesTable.name,
  automationId: schedulesTable.automationId,
  queueId: schedulesTable.queueId,
  targetMachineId: schedulesTable.targetMachineId,
  triggerType: schedulesTable.triggerType,
  cronExpression: schedulesTable.cronExpression,
  intervalMinutes: schedulesTable.intervalMinutes,
  webhookToken: schedulesTable.webhookToken,
  minItemsToTrigger: schedulesTable.minItemsToTrigger,
  maxConcurrentAgents: schedulesTable.maxConcurrentAgents,
  itemsPerAgent: schedulesTable.itemsPerAgent,
  enabled: schedulesTable.enabled,
  lastTriggeredAt: schedulesTable.lastTriggeredAt,
  nextRunAt: schedulesTable.nextRunAt,
  createdAt: schedulesTable.createdAt,
  updatedAt: schedulesTable.updatedAt,
  automationName: automationsTable.name,
  queueName: queuesTable.name,
  targetMachineName: machinesTable.name,
} as const;

async function getScheduleWithQueue(id: number) {
  const result = await db
    .select(scheduleColumns)
    .from(schedulesTable)
    .leftJoin(automationsTable, eq(schedulesTable.automationId, automationsTable.id))
    .leftJoin(queuesTable, eq(schedulesTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(schedulesTable.targetMachineId, machinesTable.id))
    .where(eq(schedulesTable.id, id));
  return result[0] ?? null;
}

router.get("/schedules", async (_req, res): Promise<void> => {
  const results = await db
    .select(scheduleColumns)
    .from(schedulesTable)
    .leftJoin(automationsTable, eq(schedulesTable.automationId, automationsTable.id))
    .leftJoin(queuesTable, eq(schedulesTable.queueId, queuesTable.id))
    .leftJoin(machinesTable, eq(schedulesTable.targetMachineId, machinesTable.id))
    .orderBy(schedulesTable.name);
  res.json(ListSchedulesResponse.parse(serialize(results)));
});

router.post("/schedules", async (req, res): Promise<void> => {
  const parsed = CreateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const webhookToken = parsed.data.triggerType === "webhook" ? randomUUID() : null;
  const [schedule] = await db
    .insert(schedulesTable)
    .values({ ...parsed.data, webhookToken })
    .returning();
  const withQueue = await getScheduleWithQueue(schedule.id);
  res.status(201).json(GetScheduleResponse.parse(serialize(withQueue)));
});

router.get("/schedules/:id", async (req, res): Promise<void> => {
  const params = GetScheduleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const schedule = await getScheduleWithQueue(params.data.id);
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  res.json(GetScheduleResponse.parse(serialize(schedule)));
});

router.patch("/schedules/:id", async (req, res): Promise<void> => {
  const params = UpdateScheduleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(schedulesTable)
    .set(parsed.data)
    .where(eq(schedulesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  const withQueue = await getScheduleWithQueue(updated.id);
  res.json(UpdateScheduleResponse.parse(serialize(withQueue)));
});

router.delete("/schedules/:id", async (req, res): Promise<void> => {
  const params = DeleteScheduleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [schedule] = await db.delete(schedulesTable).where(eq(schedulesTable.id, params.data.id)).returning();
  if (!schedule) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/schedules/:id/toggle", async (req, res): Promise<void> => {
  const params = GetScheduleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ToggleScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(schedulesTable)
    .set({ enabled: parsed.data.enabled })
    .where(eq(schedulesTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Schedule not found" });
    return;
  }
  const withQueue = await getScheduleWithQueue(updated.id);
  res.json(ToggleScheduleResponse.parse(serialize(withQueue)));
});

export default router;
