import { Router, type IRouter } from "express";
import path from "node:path";
import fs from "node:fs";
import { eq, and, inArray, asc } from "drizzle-orm";
import { db, machinesTable, jobsTable, automationsTable, projectsTable, queuesTable, assetsTable } from "@workspace/db";
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

// ─── WINDOWS INSTALLERS (personalizados por máquina) ─────────────────────

function getOrchestratorBaseUrl(req: any): string {
  // Confia no header X-Forwarded-* (Replit proxy) ou cai para o host da request
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers["host"];
  return `${proto}://${host}`;
}

// Lista branca rígida: nome de máquina e token só podem conter caracteres
// alfanuméricos seguros para .bat / .ps1 / shell. Tokens são UUIDs (já seguros),
// nomes de máquina são limitados a [A-Za-z0-9._ -] no formulário de cadastro.
// Esta validação é a defesa principal contra command injection nos instaladores.
const SAFE_INSTALLER_VALUE = /^[A-Za-z0-9._ -]+$/;

function assertSafeForInstaller(value: string, fieldName: string): void {
  if (!SAFE_INSTALLER_VALUE.test(value)) {
    throw new Error(
      `Valor inválido para ${fieldName}: contém caracteres não permitidos no instalador (somente A-Z, a-z, 0-9, ponto, sublinhado, hífen e espaço).`,
    );
  }
}

function assertSafeUrl(url: string): void {
  // http(s)://host[:port][/path] — sem aspas, espaços ou metacaracteres de shell
  if (!/^https?:\/\/[A-Za-z0-9.\-:/_%?=&]+$/.test(url)) {
    throw new Error(`URL do orquestrador inválida: ${url}`);
  }
}

router.get("/agent/install/windows/:machineId", async (req, res): Promise<void> => {
  const machineId = Number(req.params.machineId);
  if (!Number.isFinite(machineId)) {
    res.status(400).send("Invalid machineId");
    return;
  }
  const [m] = await db.select().from(machinesTable).where(eq(machinesTable.id, machineId));
  if (!m) {
    res.status(404).send("Machine not found");
    return;
  }
  const orchUrl = getOrchestratorBaseUrl(req);
  try {
    assertSafeUrl(orchUrl);
    assertSafeForInstaller(m.agentToken, "token do agente");
    assertSafeForInstaller(m.name, "nome da máquina");
  } catch (e) {
    res.status(400).send((e as Error).message);
    return;
  }
  const token = m.agentToken;
  const machineName = m.name;
  const url = orchUrl;

  const bat = `@echo off
REM ===================================================================
REM  PyOrchestrator Agent - Instalador automatizado para Windows
REM  Maquina: ${machineName}
REM  Gerado em: ${new Date().toISOString()}
REM ===================================================================
setlocal EnableDelayedExpansion
title Instalador PyOrchestrator Agent - ${machineName}
color 0B

echo.
echo  =====================================================
echo   PyOrchestrator Agent - Instalador Windows
echo   Maquina: ${machineName}
echo  =====================================================
echo.

REM --- 1. Verifica Python ---
echo [1/6] Verificando instalacao do Python...
where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [ERRO] Python nao foi encontrado no PATH.
    echo  Baixe e instale Python 3.9+ em:
    echo     https://www.python.org/downloads/windows/
    echo.
    echo  IMPORTANTE: marque a opcao "Add Python to PATH" durante a instalacao.
    echo.
    start https://www.python.org/downloads/windows/
    pause
    exit /b 1
)
python --version
echo.

REM --- 2. Cria diretorio de instalacao ---
set "INSTALL_DIR=%ProgramData%\\PyOrchestratorAgent"
echo [2/6] Criando diretorio %INSTALL_DIR%...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
cd /d "%INSTALL_DIR%"
echo.

REM --- 3. Baixa o agent.py ---
echo [3/6] Baixando agente do orquestrador...
powershell -Command "try { Invoke-WebRequest -Uri '${url}/api/agent/download' -OutFile 'pyorchestrator-agent.py' -UseBasicParsing -ErrorAction Stop; Write-Host '  OK' -ForegroundColor Green } catch { Write-Host ('  Falha: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }"
if errorlevel 1 (
    echo  [ERRO] Nao foi possivel baixar o agente. Verifique a conexao com ${url}.
    pause
    exit /b 1
)
echo.

REM --- 4. Instala dependencias Python ---
echo [4/6] Instalando dependencias (requests, pyyaml, psutil)...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet requests pyyaml psutil
if errorlevel 1 (
    echo  [ERRO] Falha na instalacao das dependencias.
    pause
    exit /b 1
)
echo.

REM --- 5. Salva configuracao ---
echo [5/6] Gravando configuracao da maquina...
(
    echo @echo off
    echo set "ORCH_URL=${url}"
    echo set "ORCH_TOKEN=${token}"
    echo set "ORCH_MACHINE=${machineName}"
    echo cd /d "%INSTALL_DIR%"
    echo python pyorchestrator-agent.py
) > "%INSTALL_DIR%\\run-agent.bat"
echo.

REM --- 6. Cria tarefa agendada (inicia ao fazer logon do usuario) ---
REM Usa ONLOGON para herdar o PATH do usuario (onde Python normalmente esta instalado).
echo [6/6] Registrando tarefa agendada (inicia ao fazer logon)...
schtasks /Query /TN "PyOrchestratorAgent" >nul 2>&1
if not errorlevel 1 (
    schtasks /Delete /TN "PyOrchestratorAgent" /F >nul 2>&1
)
schtasks /Create /TN "PyOrchestratorAgent" /TR "cmd.exe /c \\"\\"%INSTALL_DIR%\\run-agent.bat\\"\\"" /SC ONLOGON /RU "%USERNAME%" /F >nul 2>&1
if errorlevel 1 (
    echo  [AVISO] Nao foi possivel criar a tarefa agendada.
    echo  O agente ainda funciona, mas voce precisara inicia-lo manualmente.
) else (
    echo  Tarefa "PyOrchestratorAgent" criada com sucesso.
)
echo.

echo  =====================================================
echo   INSTALACAO CONCLUIDA!
echo  =====================================================
echo.
echo   Iniciar agora?  (S/N)
choice /C SN /N /T 10 /D S
if errorlevel 2 goto :done
echo.
echo   Iniciando agente em uma nova janela...
start "PyOrchestrator Agent" cmd /k "%INSTALL_DIR%\\run-agent.bat"

:done
echo.
echo   Para iniciar manualmente:   "%INSTALL_DIR%\\run-agent.bat"
echo   Para parar a tarefa agendada: schtasks /End /TN PyOrchestratorAgent
echo.
pause
endlocal
`;

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="install-pyorchestrator-${m.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.bat"`,
  );
  res.send(bat);
});

router.get("/agent/install/powershell/:machineId", async (req, res): Promise<void> => {
  const machineId = Number(req.params.machineId);
  if (!Number.isFinite(machineId)) {
    res.status(400).send("Invalid machineId");
    return;
  }
  const [m] = await db.select().from(machinesTable).where(eq(machinesTable.id, machineId));
  if (!m) {
    res.status(404).send("Machine not found");
    return;
  }
  const orchUrl = getOrchestratorBaseUrl(req);
  try {
    assertSafeUrl(orchUrl);
    assertSafeForInstaller(m.agentToken, "token do agente");
    assertSafeForInstaller(m.name, "nome da máquina");
  } catch (e) {
    res.status(400).send((e as Error).message);
    return;
  }
  const token = m.agentToken;
  const machineName = m.name;
  const url = orchUrl;

  const ps1 = `# ===================================================================
#  PyOrchestrator Agent - Instalador PowerShell
#  Maquina: ${machineName}
#  Gerado em: ${new Date().toISOString()}
#
#  Como executar (clique direito > "Executar com PowerShell")
#  ou no terminal:
#     powershell -ExecutionPolicy Bypass -File install-pyorchestrator-${m.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.ps1
# ===================================================================

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "Instalador PyOrchestrator - ${machineName}"

function Write-Step([string]$Msg, [int]$Step, [int]$Total) {
    Write-Host ""
    Write-Host ("[$Step/$Total] $Msg") -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Yellow
Write-Host " PyOrchestrator Agent - Instalador PowerShell" -ForegroundColor Yellow
Write-Host " Maquina: ${machineName}" -ForegroundColor Yellow
Write-Host "=====================================================" -ForegroundColor Yellow

# 1. Verifica Python
Write-Step "Verificando Python..." 1 6
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "[ERRO] Python nao encontrado no PATH." -ForegroundColor Red
    Write-Host "Abra https://www.python.org/downloads/windows/ e instale Python 3.9+ marcando 'Add Python to PATH'." -ForegroundColor Yellow
    Start-Process "https://www.python.org/downloads/windows/"
    Read-Host "Pressione ENTER para sair"
    exit 1
}
& python --version

# 2. Diretorio de instalacao
$InstallDir = Join-Path $env:ProgramData "PyOrchestratorAgent"
Write-Step "Criando diretorio $InstallDir..." 2 6
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Set-Location $InstallDir

# 3. Baixa o agent.py
Write-Step "Baixando agente..." 3 6
try {
    Invoke-WebRequest -Uri "${url}/api/agent/download" -OutFile "pyorchestrator-agent.py" -UseBasicParsing
    Write-Host "  OK" -ForegroundColor Green
} catch {
    Write-Host ("[ERRO] Nao foi possivel baixar o agente: " + $_.Exception.Message) -ForegroundColor Red
    Read-Host "Pressione ENTER para sair"
    exit 1
}

# 4. Instala dependencias
Write-Step "Instalando dependencias Python..." 4 6
& python -m pip install --quiet --upgrade pip
& python -m pip install --quiet requests pyyaml psutil
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha ao instalar dependencias." -ForegroundColor Red
    Read-Host "Pressione ENTER para sair"
    exit 1
}

# 5. Grava launcher com credenciais
Write-Step "Gravando configuracao da maquina..." 5 6
$launcher = @"
@echo off
set "ORCH_URL=${url}"
set "ORCH_TOKEN=${token}"
set "ORCH_MACHINE=${machineName}"
cd /d "$InstallDir"
python pyorchestrator-agent.py
"@
Set-Content -Path (Join-Path $InstallDir "run-agent.bat") -Value $launcher -Encoding ASCII

# 6. Cria tarefa agendada
Write-Step "Registrando tarefa agendada (auto-inicia com o Windows)..." 6 6
try {
    # Roda no logon do usuario atual para herdar o PATH (onde o Python esta instalado)
    $launcher = Join-Path $InstallDir "run-agent.bat"
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument ("/c """ + $launcher + """")
    $currentUser = "$env:USERDOMAIN\\$env:USERNAME"
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
    $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    Register-ScheduledTask -TaskName "PyOrchestratorAgent" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "  Tarefa 'PyOrchestratorAgent' registrada (inicia ao fazer logon)." -ForegroundColor Green
} catch {
    Write-Host ("  [AVISO] Nao foi possivel criar tarefa agendada: " + $_.Exception.Message) -ForegroundColor Yellow
    Write-Host "  O agente ainda funciona — basta executar manualmente run-agent.bat." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host " INSTALACAO CONCLUIDA!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
$start = Read-Host "Iniciar o agente agora? (S/N)"
if ($start -match '^[Ss]') {
    Write-Host "Iniciando..." -ForegroundColor Cyan
    Start-Process -FilePath (Join-Path $InstallDir "run-agent.bat")
}
Write-Host ""
Write-Host "Para iniciar manualmente: $InstallDir\\run-agent.bat"
Write-Host ""
Read-Host "Pressione ENTER para sair"
`;

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="install-pyorchestrator-${m.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.ps1"`,
  );
  res.send(ps1);
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
  const claimed = await db.transaction(async (tx) => {
    const candidates = await tx
      .select({ job: jobsTable, automation: automationsTable, project: projectsTable, queue: queuesTable })
      .from(jobsTable)
      .leftJoin(automationsTable, eq(jobsTable.automationId, automationsTable.id))
      .leftJoin(projectsTable, eq(jobsTable.projectId, projectsTable.id))
      .leftJoin(queuesTable, eq(jobsTable.queueId, queuesTable.id))
      .where(eq(jobsTable.status, "pending"))
      .orderBy(asc(jobsTable.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (candidates.length === 0) return null;
    const c = candidates[0];
    await tx
      .update(jobsTable)
      .set({ machineId: m.id, status: "running", startedAt: new Date() })
      .where(eq(jobsTable.id, c.job.id));
    return c;
  });

  if (!claimed) {
    res.status(204).end();
    return;
  }

  res.json({
    id: claimed.job.id,
    deployMethod: claimed.automation?.deployMethod ?? "zip",
    repositoryUrl: claimed.automation?.repositoryUrl ?? null,
    repositoryBranch: claimed.automation?.repositoryBranch ?? "main",
    entrypoint: claimed.automation?.entrypoint ?? "main.py",
    version: claimed.automation?.version ?? null,
    automationName: claimed.automation?.name ?? null,
    projectName: claimed.project?.name ?? null,
    queueName: claimed.queue?.name ?? null,
    inputData: claimed.job.inputData ?? null,
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
