import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { queuesTable } from "./queues";
import { projectsTable } from "./projects";
import { machinesTable } from "./machines";
import { automationsTable } from "./automations";
import { schedulesTable } from "./schedules";

export const jobsTable = pgTable("jobs", {
  id: serial("id").primaryKey(),
  automationId: integer("automation_id").references(() => automationsTable.id),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  queueId: integer("queue_id").references(() => queuesTable.id),
  machineId: integer("machine_id").references(() => machinesTable.id),
  scheduleId: integer("schedule_id").references(() => schedulesTable.id),
  status: text("status").notNull().default("pending"),
  attempt: integer("attempt").notNull().default(1),
  inputData: text("input_data"),
  outputData: text("output_data"),
  exitCode: integer("exit_code"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
