# Guia de Orquestração de Scripts Python
> Inspirado no modelo do UiPath Orchestrator — para uso da IA no Replit

---

## 📌 Visão Geral

Este documento descreve os conceitos e a arquitetura de uma ferramenta de **orquestração de scripts Python**, inspirada no UiPath Orchestrator. O objetivo é permitir que scripts Python sejam gerenciados, agendados, monitorados e executados de forma centralizada, com suporte a filas, gatilhos, VMs (máquinas clientes) e projetos.

---

## 🏗️ Arquitetura Geral

```
┌─────────────────────────────────────────────────────┐
│                   ORQUESTRADOR (Backend)             │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Gatilhos │  │  Filas   │  │    Automações    │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │              │                 │             │
│       └──────────────▼─────────────────┘             │
│                   ┌──────┐                           │
│                   │ Jobs │                           │
│                   └──┬───┘                           │
└──────────────────────┼──────────────────────────────┘
                       │ HTTP/WebSocket
        ┌──────────────▼──────────────┐
        │     CLIENT DA VM (Agent)    │
        │  (roda na máquina remota)   │
        │  - Escuta por jobs          │
        │  - Executa scripts Python   │
        │  - Reporta status e logs    │
        └─────────────────────────────┘
```

---

## 🧩 Conceitos Fundamentais

---

### 1. 📁 Projetos (Projects)

Um **Projeto** é a unidade lógica de organização do orquestrador. Ele agrupa automações, filas, gatilhos e agentes relacionados a um mesmo contexto de negócio.

#### Estrutura de um Projeto

```json
{
  "id": "proj_001",
  "nome": "Processamento de Notas Fiscais",
  "descricao": "Automatiza a leitura e validação de NFs",
  "criado_em": "2024-01-10T08:00:00Z",
  "automacoes": ["auto_001", "auto_002"],
  "filas": ["fila_nfs"],
  "agentes": ["vm_servidor_01", "vm_servidor_02"]
}
```

#### Regras de negócio
- Cada automação, fila e agente pertence a **exatamente um projeto**
- Jobs são sempre executados no contexto de um projeto
- Permissões e acesso são controlados por projeto
- Um projeto pode ter múltiplos ambientes (dev, homologação, produção)

---

### 2. ⚙️ Automações (Scripts Python Publicados)

Uma **Automação** é um script Python (ou pacote de scripts) registrado no orquestrador, pronto para ser executado. É o equivalente ao "Process" no UiPath.

#### Estrutura de uma Automação

```json
{
  "id": "auto_001",
  "nome": "processar_nf",
  "descricao": "Lê e valida notas fiscais do diretório de entrada",
  "projeto_id": "proj_001",
  "versao": "1.3.0",
  "entrypoint": "main.py",
  "parametros_entrada": {
    "diretorio": "string",
    "modo_validacao": "string"
  },
  "parametros_saida": {
    "total_processado": "integer",
    "erros": "list"
  },
  "criado_em": "2024-01-15T10:00:00Z",
  "ativo": true
}
```

#### Como publicar uma Automação

1. O desenvolvedor sobe o script (ou `.zip` com dependências) via API ou UI
2. O orquestrador armazena o código versionado (ex: no banco ou no sistema de arquivos)
3. A automação fica disponível para ser associada a gatilhos e executada como Jobs

#### Versionamento
- Cada upload gera uma nova versão (semver ou timestamp)
- É possível fazer rollback para versões anteriores
- Gatilhos e Jobs sempre referenciam uma versão específica

---

### 3. 🖥️ VMs / Agentes (Client da VM)

O **Client da VM** (também chamado de **Agent** ou **Worker**) é um processo que roda na máquina remota (servidor, VM, container) e faz a ponte entre o orquestrador e a execução real dos scripts.

#### Como o Client funciona

```
[Orquestrador] ──── HTTP/WebSocket ────► [Client da VM]
     │                                         │
     │  1. Envia Job para executar             │
     │  2. Client faz download do script       │
     │  3. Client executa: python main.py      │
     │  4. Client envia logs em tempo real     │
     │  5. Client reporta status final         │
     └─────────────────────────────────────────┘
```

#### Estrutura de registro de um Agente

```json
{
  "id": "agent_001",
  "nome": "vm_servidor_01",
  "projeto_id": "proj_001",
  "token": "eyJhbGc...",
  "hostname": "srv-automatizacao-01",
  "ip": "192.168.1.50",
  "sistema_operacional": "Ubuntu 22.04",
  "python_versao": "3.11.2",
  "status": "online",
  "ultimo_heartbeat": "2024-06-29T14:32:00Z",
  "jobs_em_execucao": 1,
  "capacidade_maxima": 3
}
```

#### Ciclo de vida do Client

```
OFFLINE → REGISTRANDO → ONLINE → OCUPADO → ONLINE
                                    ↑         |
                                    └─────────┘
                                  (após concluir job)
```

#### Heartbeat
- O Client envia um sinal de vida a cada N segundos (ex: 30s)
- Se o orquestrador não receber heartbeat por X tempo (ex: 2 minutos), marca o agente como **OFFLINE**
- Jobs pendentes são reagendados para outro agente disponível

#### Autenticação do Client
- Cada agente possui um **token único** gerado no registro
- O token é enviado no header de todas as requisições: `Authorization: Bearer <token>`
- Tokens podem ser revogados pelo administrador

#### Instalação do Client (exemplo)

```bash
pip install orquestrador-client

orquestrador-client register \
  --server https://meu-orquestrador.com \
  --token SEU_TOKEN_AQUI \
  --nome "vm_servidor_01" \
  --projeto proj_001
```

#### Execução de scripts pelo Client

```python
# O client executa algo equivalente a isso internamente:
import subprocess
import sys

resultado = subprocess.run(
    [sys.executable, "main.py", "--parametro", "valor"],
    capture_output=True,
    text=True,
    cwd="/caminho/do/script"
)

# Captura stdout/stderr e envia para o orquestrador via API
```

---

### 4. 📦 Filas (Queues)

Uma **Fila** é uma coleção de itens de trabalho que serão processados por scripts Python. É ideal para processar grandes volumes de dados de forma distribuída.

#### Estrutura de uma Fila

```json
{
  "id": "fila_001",
  "nome": "fila_nfs",
  "projeto_id": "proj_001",
  "descricao": "Itens de notas fiscais para processar",
  "max_retries": 3,
  "retry_delay_segundos": 60,
  "sla_segundos": 3600,
  "criada_em": "2024-01-10T08:00:00Z"
}
```

#### Estrutura de um Item de Fila

```json
{
  "id": "item_00142",
  "fila_id": "fila_001",
  "prioridade": "high",
  "dados": {
    "numero_nf": "NF-2024-00892",
    "fornecedor": "Empresa XYZ",
    "valor": 15320.00
  },
  "status": "in_progress",
  "tentativas": 1,
  "criado_em": "2024-06-29T09:00:00Z",
  "deadline": "2024-06-29T10:00:00Z",
  "agente_id": "agent_001",
  "job_id": "job_0055"
}
```

#### Ciclo de vida de um Item

```
NEW → IN_PROGRESS → SUCCESSFUL
            │
            └──► FAILED (tentativa < max_retries) → NEW (retry)
                      │
                      └──► ABANDONED (tentativas esgotadas)
```

#### Prioridades
| Prioridade | Valor numérico | Descrição |
|------------|---------------|-----------|
| `high`     | 1             | Processado primeiro |
| `normal`   | 2             | Padrão |
| `low`      | 3             | Processado por último |

#### Como o script Python consome itens da fila

```python
# Exemplo de script que consome itens da fila via SDK/API
import requests

ORQUESTRADOR_URL = "https://meu-orquestrador.com"
TOKEN = "SEU_TOKEN"

def obter_proximo_item(fila_id):
    resp = requests.post(
        f"{ORQUESTRADOR_URL}/api/filas/{fila_id}/dequeue",
        headers={"Authorization": f"Bearer {TOKEN}"}
    )
    return resp.json()

def atualizar_status_item(item_id, status, resultado=None):
    requests.patch(
        f"{ORQUESTRADOR_URL}/api/filas/itens/{item_id}",
        json={"status": status, "resultado": resultado},
        headers={"Authorization": f"Bearer {TOKEN}"}
    )

# Fluxo principal
item = obter_proximo_item("fila_nfs")
if item:
    try:
        # processar o item
        resultado = processar_nota_fiscal(item["dados"])
        atualizar_status_item(item["id"], "successful", resultado)
    except Exception as e:
        atualizar_status_item(item["id"], "failed", {"erro": str(e)})
```

---

### 5. 🎯 Gatilhos (Triggers)

**Gatilhos** são os mecanismos que disparam a criação de Jobs automaticamente, sem intervenção humana.

#### Tipos de Gatilho

---

##### 5.1 Time Trigger (Agendamento por Tempo)

Dispara uma automação em horários definidos usando **expressão Cron**.

```json
{
  "id": "trig_001",
  "tipo": "time",
  "nome": "processar_nfs_diario",
  "automacao_id": "auto_001",
  "projeto_id": "proj_001",
  "cron": "0 8 * * 1-5",
  "parametros": {
    "diretorio": "/entrada/nfs",
    "modo_validacao": "completo"
  },
  "agente_alvo": "agent_001",
  "ativo": true,
  "proximo_disparo": "2024-07-01T08:00:00Z"
}
```

**Referência de expressões Cron:**

```
┌──────── minuto (0-59)
│ ┌────── hora (0-23)
│ │ ┌──── dia do mês (1-31)
│ │ │ ┌── mês (1-12)
│ │ │ │ ┌ dia da semana (0=Dom, 5=Sex)
│ │ │ │ │
0 8 * * 1-5   → Dias úteis às 8h
*/30 * * * *  → A cada 30 minutos
0 0 1 * *     → Primeiro dia do mês à meia-noite
```

---

##### 5.2 Queue Trigger (Gatilho por Fila)

Dispara automaticamente quando itens chegam em uma fila. Permite escalar o número de agentes dinamicamente.

```json
{
  "id": "trig_002",
  "tipo": "queue",
  "nome": "processar_fila_nfs",
  "automacao_id": "auto_001",
  "fila_id": "fila_001",
  "projeto_id": "proj_001",
  "min_itens_para_disparar": 1,
  "max_agentes_simultaneos": 5,
  "itens_por_agente": 10,
  "ativo": true
}
```

**Lógica de escalonamento:**
```
itens_na_fila = 47
itens_por_agente = 10
max_agentes = 5

agentes_necessarios = min(ceil(47/10), 5) = min(5, 5) = 5 agentes
```

---

##### 5.3 Webhook Trigger (Gatilho por Evento Externo)

Dispara quando um sistema externo faz uma chamada HTTP para o orquestrador.

```json
{
  "id": "trig_003",
  "tipo": "webhook",
  "nome": "trigger_erp",
  "automacao_id": "auto_002",
  "projeto_id": "proj_001",
  "url_webhook": "https://meu-orquestrador.com/webhooks/trig_003",
  "secret": "webhook_secret_hash",
  "ativo": true
}
```

**Exemplo de chamada externa:**
```bash
curl -X POST https://meu-orquestrador.com/webhooks/trig_003 \
  -H "X-Webhook-Secret: webhook_secret_hash" \
  -H "Content-Type: application/json" \
  -d '{"pedido_id": "PED-9981", "cliente": "ABC Ltda"}'
```

---

### 6. 🚀 Jobs

Um **Job** é uma instância de execução de uma automação. Cada vez que uma automação é executada (manualmente, por gatilho, ou via API), um Job é criado.

#### Estrutura de um Job

```json
{
  "id": "job_0055",
  "automacao_id": "auto_001",
  "automacao_versao": "1.3.0",
  "projeto_id": "proj_001",
  "agente_id": "agent_001",
  "gatilho_id": "trig_001",
  "status": "running",
  "parametros_entrada": {
    "diretorio": "/entrada/nfs",
    "modo_validacao": "completo"
  },
  "parametros_saida": null,
  "criado_em": "2024-06-29T08:00:01Z",
  "iniciado_em": "2024-06-29T08:00:03Z",
  "concluido_em": null,
  "duracao_segundos": null,
  "erro": null
}
```

#### Ciclo de vida de um Job

```
PENDING → RUNNING → SUCCESSFUL
    │          │
    │          └──► FAULTED (erro não tratado)
    │          └──► STOPPED (cancelado manualmente)
    │
    └──► SKIPPED (agente indisponível, fila cheia)
```

#### Status dos Jobs

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando agente disponível |
| `running` | Em execução na VM |
| `successful` | Concluído com sucesso |
| `faulted` | Falhou com erro |
| `stopped` | Cancelado pelo usuário |
| `skipped` | Pulado (sem agente disponível) |

#### Logs de um Job

```json
{
  "job_id": "job_0055",
  "logs": [
    {"timestamp": "2024-06-29T08:00:03Z", "nivel": "INFO",  "mensagem": "Job iniciado"},
    {"timestamp": "2024-06-29T08:00:05Z", "nivel": "INFO",  "mensagem": "Lendo diretório /entrada/nfs"},
    {"timestamp": "2024-06-29T08:00:12Z", "nivel": "INFO",  "mensagem": "42 arquivos encontrados"},
    {"timestamp": "2024-06-29T08:05:30Z", "nivel": "WARN",  "mensagem": "NF-2024-00102 com formato inválido"},
    {"timestamp": "2024-06-29T08:10:00Z", "nivel": "INFO",  "mensagem": "Job concluído. 41 NFs processadas"}
  ]
}
```

---

## 🔗 Fluxo de Integração Completo

### Fluxo: Time Trigger → Job → VM → Fila

```
1. [Scheduler interno] detecta que Gatilho "trig_001" deve disparar às 08h
       ↓
2. Cria um Job com status PENDING
       ↓
3. Seleciona agente disponível com capacidade (agent_001)
       ↓
4. Envia Job para o Client da VM via HTTP POST
       ↓
5. Client baixa o script da versão correta
       ↓
6. Client executa: python main.py --diretorio /entrada/nfs
       ↓
7. Script Python consome itens da fila (se houver)
       ↓
8. Client envia logs em tempo real via WebSocket/HTTP
       ↓
9. Script conclui → Client reporta status SUCCESSFUL + outputs
       ↓
10. Orquestrador atualiza o Job, armazena logs e notifica (email/webhook)
```

---

## 🔌 API REST do Orquestrador

### Endpoints principais

#### Projetos
```
GET    /api/projetos              → listar projetos
POST   /api/projetos              → criar projeto
GET    /api/projetos/{id}         → detalhar projeto
PUT    /api/projetos/{id}         → atualizar projeto
DELETE /api/projetos/{id}         → remover projeto
```

#### Automações
```
GET    /api/automacoes            → listar automações
POST   /api/automacoes            → publicar nova automação (upload)
GET    /api/automacoes/{id}       → detalhar automação
POST   /api/automacoes/{id}/jobs  → iniciar job manualmente
```

#### Filas
```
GET    /api/filas                 → listar filas
POST   /api/filas                 → criar fila
POST   /api/filas/{id}/enqueue    → adicionar item à fila
POST   /api/filas/{id}/dequeue    → retirar próximo item (usado pelo script)
PATCH  /api/filas/itens/{id}      → atualizar status do item
GET    /api/filas/{id}/itens      → listar itens com filtros
```

#### Gatilhos
```
GET    /api/gatilhos              → listar gatilhos
POST   /api/gatilhos              → criar gatilho
PUT    /api/gatilhos/{id}         → atualizar gatilho
PATCH  /api/gatilhos/{id}/toggle  → ativar/desativar
```

#### Jobs
```
GET    /api/jobs                  → listar jobs (com filtros de status, data)
GET    /api/jobs/{id}             → detalhar job
GET    /api/jobs/{id}/logs        → buscar logs do job
DELETE /api/jobs/{id}             → cancelar job (se pending/running)
```

#### Agentes (VMs)
```
GET    /api/agentes               → listar agentes e status
POST   /api/agentes/register      → registrar novo agente
DELETE /api/agentes/{id}          → remover agente
POST   /api/agentes/{id}/heartbeat → sinal de vida do client
```

---

## 💻 Client da VM — Protocolo de Comunicação

### Registro do Agente

```python
# Passo 1: Registrar o agente no orquestrador
POST /api/agentes/register
Body: {
  "nome": "vm_servidor_01",
  "projeto_id": "proj_001",
  "hostname": "srv-01",
  "python_versao": "3.11.2",
  "capacidade_maxima": 3
}
Response: {
  "id": "agent_001",
  "token": "eyJhbGc..."  # salvar este token localmente
}
```

### Loop principal do Client

```python
import time
import requests

ORQUESTRADOR = "https://meu-orquestrador.com"
TOKEN = carregar_token_salvo()

def loop_principal():
    while True:
        # 1. Heartbeat
        requests.post(
            f"{ORQUESTRADOR}/api/agentes/{AGENT_ID}/heartbeat",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )

        # 2. Verificar se há jobs atribuídos
        resp = requests.get(
            f"{ORQUESTRADOR}/api/agentes/{AGENT_ID}/jobs/pendentes",
            headers={"Authorization": f"Bearer {TOKEN}"}
        )
        jobs = resp.json()

        # 3. Executar jobs disponíveis
        for job in jobs:
            executar_job(job)

        time.sleep(10)  # aguardar 10 segundos antes do próximo ciclo
```

### Execução de um Job pelo Client

```python
import subprocess
import threading

def executar_job(job):
    # 1. Download do script
    baixar_script(job["automacao_id"], job["automacao_versao"])

    # 2. Marcar job como RUNNING
    atualizar_job_status(job["id"], "running")

    # 3. Montar comando de execução
    cmd = ["python", "main.py"] + montar_parametros(job["parametros_entrada"])

    # 4. Executar e capturar logs em tempo real
    processo = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )

    # 5. Enviar logs linha a linha
    for linha in processo.stdout:
        enviar_log(job["id"], linha.strip())

    processo.wait()

    # 6. Reportar status final
    if processo.returncode == 0:
        atualizar_job_status(job["id"], "successful")
    else:
        atualizar_job_status(job["id"], "faulted", erro="Exit code != 0")
```

---

## 🗄️ Modelo de Dados (Banco de Dados)

```sql
-- Projetos
CREATE TABLE projetos (
    id          TEXT PRIMARY KEY,
    nome        TEXT NOT NULL,
    descricao   TEXT,
    criado_em   TIMESTAMP DEFAULT NOW()
);

-- Automações
CREATE TABLE automacoes (
    id          TEXT PRIMARY KEY,
    projeto_id  TEXT REFERENCES projetos(id),
    nome        TEXT NOT NULL,
    versao      TEXT NOT NULL,
    entrypoint  TEXT NOT NULL,
    script_path TEXT NOT NULL,
    parametros  JSONB,
    ativo       BOOLEAN DEFAULT TRUE,
    criado_em   TIMESTAMP DEFAULT NOW()
);

-- Agentes (VMs)
CREATE TABLE agentes (
    id                TEXT PRIMARY KEY,
    projeto_id        TEXT REFERENCES projetos(id),
    nome              TEXT NOT NULL,
    token_hash        TEXT NOT NULL,
    hostname          TEXT,
    status            TEXT DEFAULT 'offline',
    ultimo_heartbeat  TIMESTAMP,
    capacidade_maxima INTEGER DEFAULT 1,
    criado_em         TIMESTAMP DEFAULT NOW()
);

-- Filas
CREATE TABLE filas (
    id          TEXT PRIMARY KEY,
    projeto_id  TEXT REFERENCES projetos(id),
    nome        TEXT NOT NULL,
    max_retries INTEGER DEFAULT 3,
    sla_segundos INTEGER
);

-- Itens de Fila
CREATE TABLE fila_itens (
    id          TEXT PRIMARY KEY,
    fila_id     TEXT REFERENCES filas(id),
    dados       JSONB NOT NULL,
    prioridade  TEXT DEFAULT 'normal',
    status      TEXT DEFAULT 'new',
    tentativas  INTEGER DEFAULT 0,
    agente_id   TEXT,
    job_id      TEXT,
    criado_em   TIMESTAMP DEFAULT NOW(),
    deadline    TIMESTAMP
);

-- Gatilhos
CREATE TABLE gatilhos (
    id              TEXT PRIMARY KEY,
    projeto_id      TEXT REFERENCES projetos(id),
    automacao_id    TEXT REFERENCES automacoes(id),
    tipo            TEXT NOT NULL,   -- 'time', 'queue', 'webhook'
    configuracao    JSONB NOT NULL,  -- cron, fila_id, etc.
    ativo           BOOLEAN DEFAULT TRUE,
    ultimo_disparo  TIMESTAMP,
    proximo_disparo TIMESTAMP
);

-- Jobs
CREATE TABLE jobs (
    id                  TEXT PRIMARY KEY,
    projeto_id          TEXT REFERENCES projetos(id),
    automacao_id        TEXT REFERENCES automacoes(id),
    agente_id           TEXT REFERENCES agentes(id),
    gatilho_id          TEXT REFERENCES gatilhos(id),
    status              TEXT DEFAULT 'pending',
    parametros_entrada  JSONB,
    parametros_saida    JSONB,
    criado_em           TIMESTAMP DEFAULT NOW(),
    iniciado_em         TIMESTAMP,
    concluido_em        TIMESTAMP,
    erro                TEXT
);

-- Logs de Jobs
CREATE TABLE job_logs (
    id         SERIAL PRIMARY KEY,
    job_id     TEXT REFERENCES jobs(id),
    nivel      TEXT,
    mensagem   TEXT,
    timestamp  TIMESTAMP DEFAULT NOW()
);
```

---

## ⚠️ Boas Práticas para Implementação

### Idempotência
- Sempre verifique se um Job já foi criado antes de criar outro (evitar duplicatas por retry de gatilho)
- Itens de fila devem ter uma chave de referência externa para deduplicação

### Tratamento de falhas
- Jobs travados (running há mais de X minutos sem heartbeat do agente) devem ser marcados como `faulted` automaticamente
- Implementar dead letter queue para itens que esgotaram os retries

### Segurança
- Tokens de agentes devem ser armazenados como hash (bcrypt/sha256)
- Validar assinatura de webhooks com HMAC-SHA256
- Isolar execução de scripts por projeto (usuários de SO diferentes, se possível)

### Escalabilidade
- Queue Triggers devem usar um lock distribuído para evitar que múltiplos agentes peguem o mesmo item
- Usar `SELECT ... FOR UPDATE SKIP LOCKED` no PostgreSQL para dequeue seguro

### Monitoramento
- Expor métricas: jobs por status, tempo médio de execução, itens na fila, agentes online
- Alertas automáticos: fila acima de X itens, agente offline, job faulted

---

## 📋 Checklist de Implementação

### Backend (Orquestrador)
- [ ] CRUD de Projetos
- [ ] Upload e versionamento de Automações
- [ ] Registro e autenticação de Agentes (token)
- [ ] Sistema de Heartbeat e detecção de agentes offline
- [ ] CRUD de Filas e gerenciamento de Itens (enqueue/dequeue seguro)
- [ ] Criação e execução de Jobs (manual e por gatilho)
- [ ] Scheduler para Time Triggers (usando APScheduler ou Celery Beat)
- [ ] Listener de Queue Triggers
- [ ] Endpoint de Webhook
- [ ] Streaming de logs por Job
- [ ] API REST documentada (Swagger/OpenAPI)

### Client da VM (Agent)
- [ ] Comando de registro com geração e armazenamento de token
- [ ] Loop de heartbeat
- [ ] Poll de jobs pendentes (ou WebSocket para push)
- [ ] Download de scripts do orquestrador
- [ ] Execução de scripts com captura de stdout/stderr
- [ ] Envio de logs em tempo real
- [ ] Report de status final (successful/faulted)
- [ ] SDK para consumo de filas dentro dos scripts

### Frontend (Dashboard)
- [ ] Listagem de projetos e automações
- [ ] Monitor de Jobs (tabela com filtros e status em tempo real)
- [ ] Visualização de logs por Job
- [ ] Gerenciador de Filas (adicionar itens, ver progresso)
- [ ] Configuração de Gatilhos
- [ ] Status de Agentes (online/offline/ocupado)
