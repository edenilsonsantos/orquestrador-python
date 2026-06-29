import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, executionLogsTable } from "@workspace/db";
import { ListExecutionLogsResponse, IngestExecutionLogBody } from "@workspace/api-zod";
import { serialize } from "../utils/serialize";
import { requireApiKey } from "../lib/api-key-auth";

const router: IRouter = Router();

router.get("/execution-logs", async (req, res): Promise<void> => {
  const idExecucao = req.query.id_execucao !== undefined ? Number(req.query.id_execucao) : undefined;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : 200;

  const rows = await db
    .select()
    .from(executionLogsTable)
    .where(idExecucao !== undefined && Number.isFinite(idExecucao) ? eq(executionLogsTable.id_execucao, idExecucao) : undefined)
    .orderBy(desc(executionLogsTable.createdAt))
    .limit(Number.isFinite(limit) ? limit : 200);

  res.json(ListExecutionLogsResponse.parse(serialize(rows)));
});

router.post("/execution-logs", requireApiKey, async (req, res): Promise<void> => {
  const parsed = IngestExecutionLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db
    .insert(executionLogsTable)
    .values({
      id_execucao: parsed.data.id_execucao,
      id_automacao: parsed.data.id_automacao,
      vm: parsed.data.vm,
      fila: parsed.data.fila,
      fields: (parsed.data.fields ?? null) as Record<string, unknown> | null,
    })
    .returning();
  res.status(201).json(serialize(created));
});

export default router;
