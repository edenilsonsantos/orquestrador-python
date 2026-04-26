import { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db, machinesTable, executionsTable, projectsTable, queuesTable, assetsTable } from "@workspace/db";
import { GetAgentInfoResponse as AgentInfoSchema } from "@workspace/api-zod";

const router: IRouter = Router();

const AGENT_VERSION = "1.0.0";
const AGENT_FILENAME = "pyorchestrator-agent.py";

const AGENT_SCRIPT_PATH = path.resolve(__dirname, "agent", "agent.py");

router.get("/agent/info", (_req, res): void => {
  res.json(
    AgentInfoSchema.parse({
      version: AGENT_VERSION,
      downloadUrl: "/api/agent/download",
      filename: AGENT_FILENAME,
      platform: "python>=3.9",
    }),
  );
});

router.get("/agent/download", (_req, res): void => {
  if (!fs.existsSync(AGENT_SCRIPT_PATH)) {
    res.status(500).send("# Agent script not found on server");
    return;
  }
  res.setHeader("Content-Type", "text/x-python; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${AGENT_FILENAME}"`);
  fs.createReadStream(AGENT_SCRIPT_PATH).pipe(res);
});

const FRAMEWORK_TEMPLATE: Record<string, string> = {
  "main.py": `"""
Projeto Python - Template Padrao PyOrchestrator
================================================

Este e o ponto de entrada padrao executado pelo agente quando este projeto
for disparado por uma fila ou agendamento.
"""
import os
import sys


def main() -> int:
    execution_id = os.environ.get("ORCH_EXECUTION_ID", "local")
    print(f"[INFO] Iniciando execucao #{execution_id}")

    # Acesso aos assets globais (vindos do orquestrador via env vars):
    api_key = os.environ.get("MINHA_API_KEY")
    db_user = os.environ.get("BANCO_USER")
    db_pass = os.environ.get("BANCO_PASS")

    # ── Sua logica aqui ────────────────────────────────────────────────
    print("[INFO] Processando...")
    # ───────────────────────────────────────────────────────────────────

    print("[INFO] Concluido com sucesso.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
`,
  "requirements.txt": `# Dependencias do projeto
# Adicione aqui suas bibliotecas, exemplo:
# requests==2.32.3
# pandas==2.2.2
# beautifulsoup4==4.12.3
`,
  "projeto.yaml": `# Configuracao do projeto PyOrchestrator
nome_projeto: meu-projeto
versao: 1.0.0
descricao: Descricao curta do projeto

# Arquivo principal a ser executado pelo agente
entrypoint: main.py

# Categoria do projeto: backend | rpa | etl | crawler | report
categoria: backend

# Lista de assets (variaveis globais cadastradas no orquestrador)
# que serao injetadas como variaveis de ambiente na execucao.
assets:
  - MINHA_API_KEY
  - BANCO_USER
  - BANCO_PASS

# Tempo limite (em segundos) para a execucao
timeout: 3600

# Numero de tentativas em caso de falha
retries: 0
`,
  "README.md": `# meu-projeto

Projeto Python compatível com PyOrchestrator.

## Estrutura

\`\`\`
meu-projeto/
├── main.py              # Ponto de entrada (executado pelo agente)
├── requirements.txt     # Dependências Python
├── projeto.yaml         # Configuração do orquestrador
├── README.md
└── src/                 # Seus módulos auxiliares
    └── __init__.py
\`\`\`

## Como rodar localmente

\`\`\`bash
pip install -r requirements.txt
python main.py
\`\`\`
`,
  "src/__init__.py": "",
};

router.get("/agent/template", (_req, res): void => {
  res.json(FRAMEWORK_TEMPLATE);
});

// ─── RUNTIME ENDPOINTS USED BY agent.py ──────────────────────────────────

function extractBearer(req: any): string | null {
  const h = req.headers["authorization"] || req.headers["Authorization"];
  if (!h || typeof h !== "string") return null;
  const match = h.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function authenticateAgent(machineName: string, token: string | null) {
  if (!token) return null;
  const [m] = await db.select().from(machinesTable).where(eq(machinesTable.name, machineName));
  if (!m) return null;
  if (m.agentToken !== token) return null;
  return m;
}

router.post("/agent/heartbeat", async (req, res): Promise<void> => {
  const { machine, cpuPercent, memoryPercent } = req.body ?? {};
  if (!machine || typeof machine !== "string") {
    res.status(400).json({ error: "machine name required" });
    return;
  }
  const m = await authenticateAgent(machine, extractBearer(req));
  if (!m) {
    res.status(401).json({ error: "invalid agent token" });
    return;
  }
  await db.update(machinesTable).set({
    status: "online",
    lastHeartbeat: new Date(),
    cpuPercent: typeof cpuPercent === "number" ? cpuPercent : null,
    memoryPercent: typeof memoryPercent === "number" ? memoryPercent : null,
  }).where(eq(machinesTable.id, m.id));
  res.json({ ok: true });
});

router.get("/agent/next-execution", async (req, res): Promise<void> => {
  const machine = String(req.query.machine ?? "");
  if (!machine) {
    res.status(400).json({ error: "machine query required" });
    return;
  }
  const m = await authenticateAgent(machine, extractBearer(req));
  if (!m) {
    res.status(401).json({ error: "invalid agent token" });
    return;
  }
  const candidates = await db
    .select({ exec: executionsTable, project: projectsTable, queue: queuesTable })
    .from(executionsTable)
    .leftJoin(projectsTable, eq(executionsTable.projectId, projectsTable.id))
    .leftJoin(queuesTable, eq(executionsTable.queueId, queuesTable.id))
    .where(eq(executionsTable.status, "pending"))
    .orderBy(asc(executionsTable.createdAt))
    .limit(1);

  if (candidates.length === 0) {
    res.status(204).end();
    return;
  }
  const c = candidates[0];
  await db.update(executionsTable).set({ machineId: m.id, status: "running", startedAt: new Date() }).where(eq(executionsTable.id, c.exec.id));

  res.json({
    id: c.exec.id,
    deployMethod: c.project?.deployMethod ?? "zip",
    repositoryUrl: c.project?.repositoryUrl ?? null,
    repositoryBranch: c.project?.repositoryBranch ?? "main",
    activeVersion: c.project?.activeVersion ?? null,
    projectName: c.project?.name ?? null,
    queueName: c.queue?.name ?? null,
    inputData: c.exec.inputData ?? null,
  });
});

router.post("/agent/assets", async (req, res): Promise<void> => {
  const machineName = String(req.headers["x-agent-machine"] ?? "");
  if (!machineName) {
    res.status(400).json({ error: "missing X-Agent-Machine header" });
    return;
  }
  const m = await authenticateAgent(machineName, extractBearer(req));
  if (!m) {
    res.status(401).json({ error: "invalid agent token" });
    return;
  }
  const names = Array.isArray(req.body?.names) ? req.body.names.filter((n: any) => typeof n === "string") : [];
  if (names.length === 0) {
    res.json({});
    return;
  }
  const rows = await db.select().from(assetsTable).where(inArray(assetsTable.name, names));
  const out: Record<string, string> = {};
  for (const a of rows) out[a.name] = a.value;
  res.json(out);
});

export default router;
