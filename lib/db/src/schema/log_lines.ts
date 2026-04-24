import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { executionsTable } from "./executions";

export const logLinesTable = pgTable("log_lines", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => executionsTable.id),
  stream: text("stream").notNull().default("stdout"),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLogLineSchema = createInsertSchema(logLinesTable).omit({ id: true });
export type InsertLogLine = z.infer<typeof insertLogLineSchema>;
export type LogLine = typeof logLinesTable.$inferSelect;
