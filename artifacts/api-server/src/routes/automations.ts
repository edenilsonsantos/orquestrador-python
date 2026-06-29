import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, automationsTable, projectsTable, jobsTable } from "@workspace/db";
import {
  CreateAutomationBody,
  GetAutomationParams,
  UpdateAutomationParams,
  UpdateAutomationBody,
  DeleteAutomationParams,
  ListAutomationsQueryParams,
  ListAutomationsResponse,
  GetAutomationResponse,
  UpdateAutomationResponse,
  RunAutomationParams,
  RunAutomationBody,
} from "@workspace/api-zod";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

const automationCols = {
  id: automationsTable.id,
  projectId: automationsTable.projectId,
  name: automationsTable.name,
  description: automationsTable.description,
  version: automationsTable.version,
  entrypoint: automationsTable.entrypoint,
  deployMethod: automationsTable.deployMethod,
  repositoryUrl: automationsTable.repositoryUrl,
  repositoryBranch: automationsTable.repositoryBranch,
  inputParams: automationsTable.inputParams,
  outputParams: automationsTable.outputParams,
  active: automationsTable.active,
  status: automationsTable.status,
  createdAt: automationsTable.createdAt,
  updatedAt: automationsTable.updatedAt,
  projectName: projectsTable.name,
};

async function getAutomationWithProject(id: number) {
  const result = await db
    .select(automationCols)
    .from(automationsTable)
    .leftJoin(projectsTable, eq(automationsTable.projectId, projectsTable.id))
    .where(eq(automationsTable.id, id));
  return result[0] ?? null;
}

router.get("/automations", async (req, res): Promise<void> => {
  const params = ListAutomationsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const conditions = [];
  if (params.data.projectId) conditions.push(eq(automationsTable.projectId, params.data.projectId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const results = await db
    .select(automationCols)
    .from(automationsTable)
    .leftJoin(projectsTable, eq(automationsTable.projectId, projectsTable.id))
    .where(whereClause)
    .orderBy(automationsTable.name);
  res.json(ListAutomationsResponse.parse(serialize(results)));
});

router.post("/automations", async (req, res): Promise<void> => {
  const parsed = CreateAutomationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [automation] = await db.insert(automationsTable).values(parsed.data).returning();
  const withProject = await getAutomationWithProject(automation.id);
  res.status(201).json(GetAutomationResponse.parse(serialize(withProject)));
});

router.get("/automations/:id", async (req, res): Promise<void> => {
  const params = GetAutomationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const automation = await getAutomationWithProject(params.data.id);
  if (!automation) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }
  res.json(GetAutomationResponse.parse(serialize(automation)));
});

router.patch("/automations/:id", async (req, res): Promise<void> => {
  const params = UpdateAutomationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateAutomationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [updated] = await db
    .update(automationsTable)
    .set(parsed.data)
    .where(eq(automationsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }
  const withProject = await getAutomationWithProject(updated.id);
  res.json(UpdateAutomationResponse.parse(serialize(withProject)));
});

router.delete("/automations/:id", async (req, res): Promise<void> => {
  const params = DeleteAutomationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [automation] = await db
    .delete(automationsTable)
    .where(eq(automationsTable.id, params.data.id))
    .returning();
  if (!automation) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/automations/:id/jobs", async (req, res): Promise<void> => {
  const params = RunAutomationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = RunAutomationBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const automation = await getAutomationWithProject(params.data.id);
  if (!automation) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }

  const [job] = await db
    .insert(jobsTable)
    .values({
      automationId: automation.id,
      projectId: automation.projectId,
      queueId: parsed.data.queueId ?? null,
      machineId: parsed.data.machineId ?? null,
      inputData: parsed.data.inputData ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json(
    serialize({
      ...job,
      projectName: automation.projectName,
      automationName: automation.name,
      queueName: null,
      machineName: null,
    }),
  );
});

export default router;
