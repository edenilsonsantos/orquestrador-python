import { CronExpressionParser } from "cron-parser";
import { and, count, eq, inArray, lte } from "drizzle-orm";
import {
  db,
  schedulesTable,
  automationsTable,
  jobsTable,
  queueItemsTable,
  type Schedule,
} from "@workspace/db";
import { logger } from "./lib/logger";

const TICK_MS = 30_000;
const BOOT_DELAY_MS = 5_000;
const ACTIVE_JOB_STATUSES = ["pending", "running"] as const;

export function computeNextRun(
  schedule: Pick<Schedule, "triggerType" | "intervalMinutes" | "cronExpression">,
  from: Date = new Date(),
): Date | null {
  if (schedule.triggerType === "interval" && schedule.intervalMinutes) {
    return new Date(from.getTime() + schedule.intervalMinutes * 60_000);
  }
  if (schedule.triggerType === "cron" && schedule.cronExpression) {
    try {
      const interval = CronExpressionParser.parse(schedule.cronExpression, {
        currentDate: from,
      });
      return interval.next().toDate();
    } catch (err) {
      logger.warn({ err, cron: schedule.cronExpression }, "invalid cron expression");
      return null;
    }
  }
  return null;
}

export async function createJobFromSchedule(schedule: Schedule): Promise<number | null> {
  if (!schedule.automationId) return null;
  const [automation] = await db
    .select()
    .from(automationsTable)
    .where(eq(automationsTable.id, schedule.automationId));
  if (!automation) {
    logger.warn({ scheduleId: schedule.id }, "schedule references missing automation");
    return null;
  }
  const [job] = await db
    .insert(jobsTable)
    .values({
      automationId: automation.id,
      projectId: automation.projectId,
      scheduleId: schedule.id,
      queueId: schedule.queueId ?? null,
      machineId: schedule.targetMachineId ?? null,
      status: "pending",
    })
    .returning({ id: jobsTable.id });
  return job?.id ?? null;
}

async function hasActiveJobForSchedule(scheduleId: number): Promise<boolean> {
  const [row] = await db
    .select({ c: count() })
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.scheduleId, scheduleId),
        inArray(jobsTable.status, [...ACTIVE_JOB_STATUSES]),
      ),
    );
  return (row?.c ?? 0) > 0;
}

async function processSchedule(schedule: Schedule, now: Date): Promise<void> {
  if (!schedule.automationId) return;

  if (schedule.triggerType === "cron" || schedule.triggerType === "interval") {
    if (!schedule.nextRunAt) {
      const next = computeNextRun(schedule, now);
      await db
        .update(schedulesTable)
        .set({ nextRunAt: next })
        .where(eq(schedulesTable.id, schedule.id));
      return;
    }
    if (schedule.nextRunAt <= now) {
      const jobId = await createJobFromSchedule(schedule);
      const next = computeNextRun(schedule, now);
      await db
        .update(schedulesTable)
        .set({ lastTriggeredAt: now, nextRunAt: next })
        .where(eq(schedulesTable.id, schedule.id));
      if (jobId) {
        logger.info({ scheduleId: schedule.id, jobId, triggerType: schedule.triggerType }, "schedule fired job");
      }
    }
    return;
  }

  if (schedule.triggerType === "queue" && schedule.queueId) {
    if (await hasActiveJobForSchedule(schedule.id)) return;
    const [row] = await db
      .select({ c: count() })
      .from(queueItemsTable)
      .where(
        and(
          eq(queueItemsTable.queueId, schedule.queueId),
          eq(queueItemsTable.status, "new"),
        ),
      );
    const pending = row?.c ?? 0;
    if (pending >= schedule.minItemsToTrigger) {
      const jobId = await createJobFromSchedule(schedule);
      await db
        .update(schedulesTable)
        .set({ lastTriggeredAt: now })
        .where(eq(schedulesTable.id, schedule.id));
      if (jobId) {
        logger.info({ scheduleId: schedule.id, jobId, pending }, "queue threshold fired job");
      }
    }
  }
}

export async function runSchedulerTick(now: Date = new Date()): Promise<void> {
  const schedules = await db
    .select()
    .from(schedulesTable)
    .where(eq(schedulesTable.enabled, true));
  for (const schedule of schedules) {
    try {
      await processSchedule(schedule, now);
    } catch (err) {
      logger.error({ err, scheduleId: schedule.id }, "scheduler failed for schedule");
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (timer) return;
  logger.info({ tickMs: TICK_MS }, "trigger scheduler started");
  timer = setInterval(() => {
    runSchedulerTick().catch((err) => logger.error({ err }, "scheduler tick error"));
  }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  setTimeout(() => {
    runSchedulerTick().catch((err) => logger.error({ err }, "scheduler boot tick error"));
  }, BOOT_DELAY_MS);
}
