import { pgTable, serial, timestamp, integer, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const executionLogsTable = pgTable("execution_logs", {
  id: serial("id").primaryKey(),
  id_execucao: integer("id_execucao").notNull(),
  id_automacao: integer("id_automacao").notNull(),
  vm: text("vm").notNull(),
  fila: text("fila").notNull(),
  fields: jsonb("fields").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExecutionLogSchema = createInsertSchema(executionLogsTable).omit({ id: true, createdAt: true });
export type InsertExecutionLog = z.infer<typeof insertExecutionLogSchema>;
export type ExecutionLog = typeof executionLogsTable.$inferSelect;
