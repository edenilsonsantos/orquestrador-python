import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const queuesTable = pgTable("queues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  priority: integer("priority").notNull().default(1),
  maxConcurrency: integer("max_concurrency").notNull().default(1),
  maxRetries: integer("max_retries").notNull().default(3),
  retryIntervalSeconds: integer("retry_interval_seconds").notNull().default(300),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQueueSchema = createInsertSchema(queuesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type Queue = typeof queuesTable.$inferSelect;
