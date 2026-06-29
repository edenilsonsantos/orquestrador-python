import { sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  db,
  projectsTable,
  machinesTable,
  automationsTable,
  queuesTable,
  queueItemsTable,
  schedulesTable,
  jobsTable,
  assetsTable,
  executionLogsTable,
  apiKeysTable,
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
  credentialAssetId: number;
  apiKeyAssetId: number;
  textAssetId: number;
  executionLogId: number;
  executionLogExecucao: number;
  apiKeyId: number;
  apiKeyPlaintext: string;
}

// Wipes every table the API reads from and re-inserts a deterministic fixture
// graph that exercises the joined fields each endpoint depends on.
export async function resetAndSeed(): Promise<SeededIds> {
  await db.execute(sql`
    TRUNCATE TABLE
      log_lines, execution_logs, queue_items, jobs, schedules,
      automations, queues, machines, projects, assets, api_keys
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

  const [credentialAsset] = await db
    .insert(assetsTable)
    .values({
      name: "Seed Credential",
      type: "credential",
      username: "seed-user",
      value: "super-secret-password",
      description: "seed credential asset",
    })
    .returning();

  const [apiKeyAsset] = await db
    .insert(assetsTable)
    .values({
      name: "Seed API Key Asset",
      type: "api_key",
      value: "sk-1234567890abcdef",
      description: "seed api_key asset",
    })
    .returning();

  const [textAsset] = await db
    .insert(assetsTable)
    .values({
      name: "Seed Text Asset",
      type: "text",
      value: "plain visible text",
    })
    .returning();

  const executionLogExecucao = 42;
  const [executionLog] = await db
    .insert(executionLogsTable)
    .values({
      id_execucao: executionLogExecucao,
      id_automacao: automation.id,
      vm: "seed-vm",
      fila: "seed-fila",
      fields: { step: "start", ok: true },
    })
    .returning();

  const apiKeyPlaintext = "pyo_seedtestkey000000000000000000000000000000000000000000";
  const [apiKey] = await db
    .insert(apiKeysTable)
    .values({
      name: "Seed API Key",
      keyPrefix: apiKeyPlaintext.slice(0, 12),
      keyHash: createHash("sha256").update(apiKeyPlaintext).digest("hex"),
      revoked: false,
    })
    .returning();

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
    credentialAssetId: credentialAsset.id,
    apiKeyAssetId: apiKeyAsset.id,
    textAssetId: textAsset.id,
    executionLogId: executionLog.id,
    executionLogExecucao,
    apiKeyId: apiKey.id,
    apiKeyPlaintext,
  };
}
