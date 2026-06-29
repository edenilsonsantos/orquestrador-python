import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { queuesTable } from "./queues";
import { machinesTable } from "./machines";
import { jobsTable } from "./jobs";

export const queueItemsTable = pgTable("queue_items", {
  id: serial("id").primaryKey(),
  queueId: integer("queue_id").notNull().references(() => queuesTable.id),
  reference: text("reference"),
  data: text("data"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("new"),
  attempts: integer("attempts").notNull().default(0),
  machineId: integer("machine_id").references(() => machinesTable.id),
  jobId: integer("job_id").references(() => jobsTable.id),
  output: text("output"),
  exception: text("exception"),
  deadline: timestamp("deadline", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQueueItemSchema = createInsertSchema(queueItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQueueItem = z.infer<typeof insertQueueItemSchema>;
export type QueueItem = typeof queueItemsTable.$inferSelect;
