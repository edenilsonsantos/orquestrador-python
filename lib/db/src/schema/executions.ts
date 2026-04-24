import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { queuesTable } from "./queues";
import { projectsTable } from "./projects";
import { machinesTable } from "./machines";

export const executionsTable = pgTable("executions", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").notNull().references(() => queuesTable.id),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  machineId: integer("machine_id").references(() => machinesTable.id),
  status: text("status").notNull().default("pending"),
  attempt: integer("attempt").notNull().default(1),
  inputData: text("input_data"),
  exitCode: integer("exit_code"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertExecutionSchema = createInsertSchema(executionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executionsTable.$inferSelect;
