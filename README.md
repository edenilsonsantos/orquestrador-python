# Orquestrador Python

> Plataforma de orquestração de automações em Python — modelo **Cliente / Servidor**, inspirada em UiPath Orchestrator e Prefect, com interface 100% em Português (Brasil).

| | |
|---|---|
| **Status** | 🟡 Em desenvolvimento |
| **URL (release de teste)** | <https://orquestrador-python.com/> |
| **Stack** | React + Vite • Express 5 • PostgreSQL • Drizzle ORM • Python 3.9+ |
| **Idioma da interface** | Português (Brasil) |

---

## 🎯 Objetivo

Gerenciar automações em Python de ponta a ponta:

- 📜 **Gestão de scripts/projetos** — versionamento via ZIP/Git, framework padrão (`projeto.yaml`, `main.py`, `requirements.txt`).
- ⏱️ **Gatilhos** — agendamentos cron e filas de execução sob demanda.
- 👥 **Usuários** — controle de acesso à plataforma.
- 🖥️ **Máquinas** — registro, monitoramento (CPU/RAM/heartbeat), modo manutenção, instalador automático Windows (`.bat` / `.ps1`) com credenciais embutidas.
- 🔐 **Assets** — cofre de credenciais, API keys e textos injetados como variáveis de ambiente nas execuções.
- 📊 **Dashboards** — visão consolidada de execuções, máquinas, filas e desempenho em tempo real.
- 🧾 **Logs e auditoria** — histórico completo de execuções, status, duração, saídas e erros.

---

## 🏗️ Arquitetura

```
┌────────────────────────┐         HTTPS/JSON          ┌─────────────────────┐
│  Frontend React+Vite   │ ◀─────────────────────────▶ │  Express 5 + Drizzle│
│  (interface PT-BR)     │                             │  PostgreSQL         │
└────────────────────────┘                             └──────────┬──────────┘
                                                                  │
                                  Bearer token + heartbeat        │
                ┌─────────────────────────────────────────────────┘
                ▼
   ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
   │  Agente Python (VM 1)  │  │  Agente Python (VM 2)  │  │  Agente Python (VM N)  │
   │  Windows / Linux / Mac │  │  Windows / Linux / Mac │  │  Windows / Linux / Mac │
   └────────────────────────┘  └────────────────────────┘  └────────────────────────┘
```

- **Servidor (orquestrador)** — API REST + UI web, fonte única da verdade.
- **Cliente (agente)** — microsserviço Python rodando em cada máquina, autenticado por token, executa projetos sob demanda e reporta status.

---

## ✨ Funcionalidades principais

| Módulo | Descrição |
|---|---|
| **Projetos** | Cadastro, upload (ZIP), versão, categoria (backend/RPA/ETL/crawler/report). |
| **Filas** | Disparo de execuções com prioridade e parâmetros. |
| **Agendamentos** | Cron jobs por máquina ou pool. |
| **Execuções** | Histórico filtrável, logs em tempo real, retentativas. |
| **Máquinas** | Inventário, status, métricas, token de agente, **instalador Windows um-clique**. |
| **Assets** | Cofre seguro (texto / credencial / API key) com mascaramento na UI. |
| **Usuários** | Cadastro de operadores. |
| **Dashboard** | KPIs consolidados em tempo real. |
| **Manual** | Documentação operacional embutida na própria UI. |

---

## 🚀 Instalação do agente em uma máquina (Windows — modo fácil)

1. No orquestrador, vá em **Máquinas → Adicionar Máquina**.
2. Clique em **Conexão** no card da máquina recém-criada.
3. Baixe o **`install-pyorchestrator-<NOME>.bat`** (ou a versão `.ps1`).
4. Na máquina destino, clique com o botão direito → **Executar como administrador**.
5. Pronto: o instalador cuida de Python, dependências, agente, credenciais e auto-start no logon.

> Linux/macOS: instalação manual (3 comandos) descrita na página **Manual** dentro do orquestrador.

---

## 🛠️ Desenvolvimento

Pré-requisitos: Node.js 20+, pnpm 9+, PostgreSQL.

```bash
pnpm install
pnpm --filter @workspace/db run db:push       # cria schema
pnpm --filter @workspace/db run db:seed       # dados de exemplo
pnpm --filter @workspace/api-server run dev   # API   :8080
pnpm --filter @workspace/orchestrator run dev # Web   :18842
```

Após editar `lib/api-spec/openapi.yaml`, rode o codegen:

```bash
pnpm --filter @workspace/api-spec run codegen
```

---

## 📦 Estrutura do monorepo

```
.
├── artifacts/
│   ├── orchestrator/      # Frontend React + Vite (UI principal)
│   ├── api-server/        # Backend Express 5 + Drizzle
│   │   └── src/agent/     # Cliente Python (agente) distribuído via download
│   └── mockup-sandbox/    # Sandbox de componentes (Vite)
└── lib/
    ├── api-spec/          # OpenAPI 3.1 — fonte da verdade dos contratos
    ├── api-zod/           # Schemas Zod gerados (Orval)
    ├── api-client-react/  # Hooks React Query gerados (Orval)
    └── db/                # Drizzle ORM + migrations + seed
```

---

## 🔒 Segurança

- Token Bearer obrigatório em todos os endpoints `/api/agent/*` (heartbeat, próxima execução, leitura de assets).
- `agentToken` nunca exposto na listagem pública de máquinas — apenas via fetch individual.
- Asset values mascarados na UI (`••••`) e enviados em texto puro somente ao agente autenticado.
- Validação rígida de nomes de máquina (lista branca `[A-Za-z0-9._ -]`) impedindo injeção de comandos nos instaladores Windows gerados.
- Extração de ZIPs no agente protegida contra Zip Slip (path traversal).

---

## 📝 Licença

Projeto privado — em desenvolvimento.

---

**Status atual:** 🟡 Em desenvolvimento — release de teste disponível em <https://orquestrador-python.com/>
