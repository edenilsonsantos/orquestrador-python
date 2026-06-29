import { sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  machinesTable,
  automationsTable,
  queuesTable,
  queueItemsTable,
  schedulesTable,
  jobsTable,
} from "@workspace/db";

export interface SeededIds {
  projectId: number;
  machineId: number;
  machineToken: string;
  machineName: string;
  automationId: number;
  queueId: number;
  scheduleId: number;
  cronScheduleId: number;
  jobId: number;
  queueItemNewId: number;
  queueItemDoneId: number;
}

// Wipes every table the API reads from and re-inserts a deterministic fixture
// graph that exercises the joined fields each endpoint depends on.
export async function resetAndSeed(): Promise<SeededIds> {
  await db.execute(sql`
    TRUNCATE TABLE
      log_lines, execution_logs, queue_items, jobs, schedules,
      automations, queues, machines, projects
    RESTART IDENTITY CASCADE
  `);

  const [project] = await db
    .insert(projectsTable)
    .values({ name: "Test Project", description: "seed", category: "backend", status: "active" })
    .returning();

  const machineName = "seed-machine";
  const machineToken = "seed-agent-token";
  const [machine] = await db
    .insert(machinesTable)
    .values({
      name: machineName,
      hostname: "seed.local",
      operatingSystem: "linux",
      category: "backend",
      status: "online",
      agentToken: machineToken,
    })
    .returning();

  const [automation] = await db
    .insert(automationsTable)
    .values({ projectId: project.id, name: "Test Automation", entrypoint: "main.py" })
    .returning();

  const [queue] = await db
    .insert(queuesTable)
    .values({
      name: "Test Queue",
      description: "seed queue",
      projectId: project.id,
      priority: 1,
      maxConcurrency: 1,
      maxRetries: 3,
      retryIntervalSeconds: 300,
      status: "active",
    })
    .returning();

  const [scheduleCron] = await db
    .insert(schedulesTable)
    .values({
      name: "Cron Schedule",
      automationId: automation.id,
      queueId: queue.id,
      targetMachineId: machine.id,
      triggerType: "cron",
      cronExpression: "0 * * * *",
      enabled: true,
    })
    .returning();

  const [scheduleInterval] = await db
    .insert(schedulesTable)
    .values({
      name: "Interval Schedule",
      automationId: automation.id,
      queueId: queue.id,
      triggerType: "interval",
      intervalMinutes: 15,
      enabled: false,
    })
    .returning();

  const [job] = await db
    .insert(jobsTable)
    .values({
      automationId: automation.id,
      projectId: project.id,
      queueId: queue.id,
      machineId: machine.id,
      status: "successful",
      attempt: 1,
      startedAt: new Date(),
      finishedAt: new Date(),
      durationSeconds: 12,
    })
    .returning();

  await db.insert(jobsTable).values({
    automationId: automation.id,
    projectId: project.id,
    queueId: queue.id,
    machineId: machine.id,
    status: "faulted",
    attempt: 1,
    errorMessage: "boom",
  });

  const [itemNew] = await db
    .insert(queueItemsTable)
    .values({
      queueId: queue.id,
      reference: "ref-new",
      data: JSON.stringify({ foo: "bar" }),
      priority: "high",
      status: "new",
    })
    .returning();

  const [itemDone] = await db
    .insert(queueItemsTable)
    .values({
      queueId: queue.id,
      reference: "ref-done",
      data: JSON.stringify({ done: true }),
      priority: "normal",
      status: "successful",
      machineId: machine.id,
      attempts: 1,
      output: JSON.stringify({ ok: true }),
      startedAt: new Date(),
      endedAt: new Date(),
    })
    .returning();

  await db.insert(queueItemsTable).values({
    queueId: queue.id,
    reference: "ref-failed",
    priority: "low",
    status: "failed",
    attempts: 4,
    exception: "kaboom",
  });

  return {
    projectId: project.id,
    machineId: machine.id,
    machineToken,
    machineName,
    automationId: automation.id,
    queueId: queue.id,
    scheduleId: scheduleCron.id,
    cronScheduleId: scheduleCron.id,
    jobId: job.id,
    queueItemNewId: itemNew.id,
    queueItemDoneId: itemDone.id,
  };
}
