import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, machinesTable } from "@workspace/db";
import {
  CreateMachineBody,
  GetMachineParams,
  UpdateMachineParams,
  UpdateMachineBody,
  DeleteMachineParams,
  ToggleMachineMaintenanceParams,
  ToggleMachineMaintenanceBody,
  ListMachinesResponse,
  GetMachineResponse,
  UpdateMachineResponse,
  ToggleMachineMaintenanceResponse,
} from "@workspace/api-zod";
import { randomUUID } from "crypto";
import { serialize } from "../utils/serialize";

const router: IRouter = Router();

// Restrição: o nome da máquina é embutido em scripts .bat/.ps1 baixáveis
// (instalador Windows). Permitir apenas caracteres simples evita qualquer
// chance de injeção de comandos no shell do alvo.
const MACHINE_NAME_RE = /^[A-Za-z0-9._ -]{1,64}$/;
function validateMachineName(name?: string): string | null {
  if (typeof name !== "string") return null;
  if (!MACHINE_NAME_RE.test(name)) {
    return 'Nome da máquina inválido. Use apenas letras (A-Z, a-z), números, ponto, sublinhado, hífen e espaço (1 a 64 caracteres).';
  }
  return null;
}

router.get("/machines", async (req, res): Promise<void> => {
  const machines = await db.select().from(machinesTable).orderBy(machinesTable.name);
  // Strip agentToken from listing — only exposed via single-machine fetch
  const safe = machines.map(({ agentToken: _t, ...rest }) => rest);
  res.json(ListMachinesResponse.parse(serialize(safe)));
});

router.post("/machines", async (req, res): Promise<void> => {
  const parsed = CreateMachineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const nameError = validateMachineName(parsed.data.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }
  const [machine] = await db
    .insert(machinesTable)
    .values({ ...parsed.data, agentToken: randomUUID() })
    .returning();
  res.status(201).json(GetMachineResponse.parse(serialize(machine)));
});

router.get("/machines/:id", async (req, res): Promise<void> => {
  const params = GetMachineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [machine] = await db.select().from(machinesTable).where(eq(machinesTable.id, params.data.id));
  if (!machine) {
    res.status(404).json({ error: "Machine not found" });
    return;
  }
  res.json(GetMachineResponse.parse(serialize(machine)));
});

router.patch("/machines/:id", async (req, res): Promise<void> => {
  const params = UpdateMachineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMachineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const nameError = validateMachineName(parsed.data.name);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }
  const [machine] = await db
    .update(machinesTable)
    .set(parsed.data)
    .where(eq(machinesTable.id, params.data.id))
    .returning();
  if (!machine) {
    res.status(404).json({ error: "Machine not found" });
    return;
  }
  res.json(UpdateMachineResponse.parse(serialize(machine)));
});

router.delete("/machines/:id", async (req, res): Promise<void> => {
  const params = DeleteMachineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [machine] = await db.delete(machinesTable).where(eq(machinesTable.id, params.data.id)).returning();
  if (!machine) {
    res.status(404).json({ error: "Machine not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/machines/:id/maintenance", async (req, res): Promise<void> => {
  const params = ToggleMachineMaintenanceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ToggleMachineMaintenanceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const newStatus = parsed.data.enabled ? "maintenance" : "offline";
  const [machine] = await db
    .update(machinesTable)
    .set({ maintenanceMode: parsed.data.enabled, status: newStatus })
    .where(eq(machinesTable.id, params.data.id))
    .returning();
  if (!machine) {
    res.status(404).json({ error: "Machine not found" });
    return;
  }
  res.json(ToggleMachineMaintenanceResponse.parse(serialize(machine)));
});

export default router;
