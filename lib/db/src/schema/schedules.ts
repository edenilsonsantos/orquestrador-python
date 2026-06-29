import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { queuesTable } from "./queues";
import { automationsTable } from "./automations";
import { machinesTable } from "./machines";

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  automationId: integer("automation_id").references(() => automationsTable.id),
  queueId: integer("queue_id").references(() => queuesTable.id),
  targetMachineId: integer("target_machine_id").references(() => machinesTable.id),
  triggerType: text("trigger_type").notNull().default("cron"),
  cronExpression: text("cron_expression"),
  intervalMinutes: integer("interval_minutes"),
  webhookToken: text("webhook_token"),
  webhookSecret: text("webhook_secret"),
  minItemsToTrigger: integer("min_items_to_trigger").notNull().default(1),
  maxConcurrentAgents: integer("max_concurrent_agents").notNull().default(1),
  itemsPerAgent: integer("items_per_agent").notNull().default(10),
  enabled: boolean("enabled").notNull().default(true),
  lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
