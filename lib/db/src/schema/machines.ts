import { pgTable, text, serial, timestamp, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const machinesTable = pgTable("machines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  hostname: text("hostname").notNull(),
  operatingSystem: text("operating_system").notNull(),
  category: text("category").notNull().default("backend"),
  status: text("status").notNull().default("offline"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }),
  cpuPercent: real("cpu_percent"),
  memoryPercent: real("memory_percent"),
  agentToken: text("agent_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMachineSchema = createInsertSchema(machinesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type Machine = typeof machinesTable.$inferSelect;
