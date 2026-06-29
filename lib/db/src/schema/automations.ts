import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("1.0.0"),
  entrypoint: text("entrypoint").notNull().default("main.py"),
  deployMethod: text("deploy_method").notNull().default("zip"),
  repositoryUrl: text("repository_url"),
  repositoryBranch: text("repository_branch"),
  inputParams: jsonb("input_params").$type<Record<string, unknown>>(),
  outputParams: jsonb("output_params").$type<Record<string, unknown>>(),
  active: boolean("active").notNull().default(true),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automationsTable.$inferSelect;
