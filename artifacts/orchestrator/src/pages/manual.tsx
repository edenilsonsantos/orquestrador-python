import { useGetAgentInfo } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Server, LayoutGrid, Layers, PlayCircle, Clock, Users, KeyRound,
  Download, BookOpen, FileCode, FolderTree
} from "lucide-react";

const PROJECT_YAML = `# projeto.yaml
nome_projeto: meu-projeto
versao: 1.0.0
descricao: Descricao curta do projeto

# Arquivo principal a ser executado pelo agente
entrypoint: main.py

# Categoria: backend | rpa | etl | crawler | report
categoria: backend

# Lista de assets (variaveis globais cadastradas no orquestrador)
# que serao injetadas como variaveis de ambiente na execucao.
assets:
  - MINHA_API_KEY
  - BANCO_USER
  - BANCO_PASS

# Tempo limite (em segundos)
timeout: 3600

# Numero de tentativas em caso de falha
retries: 0`;

const MAIN_PY = `import os
import sys


def main() -> int:
    execution_id = os.environ.get("ORCH_EXECUTION_ID", "local")
    print(f"[INFO] Iniciando execucao #{execution_id}")

    # Acesso aos assets globais (vindos do orquestrador via env vars):
    api_key = os.environ.get("MINHA_API_KEY")
    db_user = os.environ.get("BANCO_USER")

    # ── Sua logica aqui ────────────────────────────────────────────────
    print("[INFO] Processando...")
    # ───────────────────────────────────────────────────────────────────

    print("[INFO] Concluido com sucesso.")
    return 0


if __name__ == "__main__":
    sys.exit(main())`;

const REQS = `requests==2.32.3
pandas==2.2.2
beautifulsoup4==4.12.3
# adicione suas dependencias aqui`;

const FOLDER_TREE = `meu-projeto/
├── main.py              # Ponto de entrada (executado pelo agente)
├── requirements.txt     # Dependencias Python
├── projeto.yaml         # Configuracao do orquestrador
├── README.md
└── src/                 # Seus modulos auxiliares
    ├── __init__.py
    ├── service.py
    └── utils.py`;

function CodeBlock({ children, lang = "" }: { children: string; lang?: string }) {
  return (
    <pre className="bg-zinc-950/80 border border-border rounded-md p-3 overflow-x-auto text-xs leading-relaxed">
      <code className={`language-${lang} text-zinc-200`}>{children}</code>
    </pre>
  );
}

function MenuRow({ icon: Icon, name, path, desc }: { icon: any; name: string; path: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <Icon className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{name}</span>
          <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{path}</code>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{desc}</p>
      </div>
    </div>
  );
}

export default function ManualPage() {
  const { data: agent } = useGetAgentInfo();

  return (
    <div className="space-y-6 max-w-5xl" data-testid="manual-page">
      <div className="flex items-center gap-3">
        <BookOpen className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Manual de Uso</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guia completo dos menus e do framework de projetos Python
          </p>
        </div>
      </div>

      {/* ─────────── Menus ─────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Menus do Orquestrador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MenuRow icon={Activity} name="Dashboard" path="/" desc="Visao geral em tempo real: total de execucoes do dia, taxa de sucesso, maquinas online, filas ativas e grafico dos ultimos 7 dias." />
          <MenuRow icon={Server} name="Maquinas" path="/machines" desc="Cadastro e monitoramento das maquinas (VMs, servidores, RPAs) que executam os projetos. Mostra status (online/offline/manutencao), CPU, RAM e ultimo heartbeat." />
          <MenuRow icon={LayoutGrid} name="Projetos" path="/projects" desc="Cadastro dos projetos Python automatizados. Cada projeto pode ser implantado via repositorio Git (github/gitlab) ou via upload de arquivo ZIP." />
          <MenuRow icon={Layers} name="Filas" path="/queues" desc="Filas de execucao que agrupam projetos por dominio (ETL, Relatorios, RPA, etc.). Cada fila tem prioridade, concorrencia maxima e numero de retries." />
          <MenuRow icon={PlayCircle} name="Execucoes" path="/executions" desc="Historico e status de todas as execucoes. Permite filtrar por status (pendente, executando, concluido, erro), reexecutar e visualizar logs detalhados." />
          <MenuRow icon={Clock} name="Agendamentos" path="/schedules" desc="Triggers que disparam projetos automaticamente. Suporta Cron (ex: '0 6 * * *'), Intervalo (a cada N minutos) e Webhook." />
          <MenuRow icon={Users} name="Usuarios" path="/users" desc="Gerenciamento de acesso. Perfis: Admin (tudo), Operador (executar e monitorar) e Visualizador (apenas leitura)." />
          <MenuRow icon={KeyRound} name="Assets" path="/assets" desc="Variaveis globais compartilhadas entre projetos. Tres tipos: Texto (visivel), Credencial (senha oculta) e Chave de API (parcialmente oculta). Os valores sao injetados como variaveis de ambiente na execucao." />
        </CardContent>
      </Card>

      {/* ─────────── Agente ─────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5" />
            Cliente Agente (Agent)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O <strong className="text-foreground">Agent</strong> e um microsservico Python que roda em cada maquina destino. Ele se conecta ao orquestrador, envia heartbeats periodicos e executa os projetos sob demanda.
          </p>
          <div className="flex items-center gap-3">
            <Button asChild data-testid="button-download-agent">
              <a href="/api/agent/download" download={agent?.filename ?? "pyorchestrator-agent.py"}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Cliente Agente
              </a>
            </Button>
            {agent && (
              <Badge variant="outline" className="text-xs">
                v{agent.version} • {agent.platform}
              </Badge>
            )}
          </div>
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="text-sm font-semibold text-emerald-200 mb-1">
              Modo facil (Windows): instalador automatico
            </p>
            <p className="text-xs text-emerald-100/80">
              Em <strong>Maquinas</strong>, clique em <strong>Conexao</strong> no card da maquina e escolha <strong>"Baixar instalador .bat"</strong>. O arquivo ja vem com URL, token e nome embutidos — basta clicar com botao direito na maquina destino e <strong>"Executar como administrador"</strong>. O instalador cuida de Python, dependencias, agente e auto-start ao ligar o Windows.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-2">Instalacao manual (Linux / macOS / Windows):</p>
            <CodeBlock lang="bash">{`# 1. Instalar dependencias
pip install requests pyyaml psutil

# 2. Rodar o agente (recebido por download)
python pyorchestrator-agent.py \\
  --orchestrator http://seu-host:8080 \\
  --token <agent_token_da_maquina> \\
  --machine "VM-Producao-01"

# Alternativa: usando variaveis de ambiente
export ORCH_URL=http://seu-host:8080
export ORCH_TOKEN=...
export ORCH_MACHINE="VM-Producao-01"
python pyorchestrator-agent.py`}</CodeBlock>
          </div>
        </CardContent>
      </Card>

      {/* ─────────── Framework Python ─────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Framework Python para Projetos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Todo projeto enviado ao orquestrador (via ZIP ou Git) deve seguir esta estrutura padrao para ser reconhecido e executado pelo agente.
          </p>

          <div>
            <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <FolderTree className="h-4 w-4" /> Estrutura de pastas obrigatoria:
            </p>
            <CodeBlock>{FOLDER_TREE}</CodeBlock>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2"><code>main.py</code> — ponto de entrada:</p>
            <CodeBlock lang="python">{MAIN_PY}</CodeBlock>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2"><code>requirements.txt</code> — dependencias:</p>
            <CodeBlock>{REQS}</CodeBlock>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground mb-2"><code>projeto.yaml</code> — configuracao:</p>
            <CodeBlock lang="yaml">{PROJECT_YAML}</CodeBlock>
            <div className="mt-3 text-sm text-muted-foreground space-y-1">
              <p><strong className="text-foreground">nome_projeto</strong>: identificador unico do projeto.</p>
              <p><strong className="text-foreground">versao</strong>: versao semantica (use junto com tags do git).</p>
              <p><strong className="text-foreground">entrypoint</strong>: arquivo que sera executado (default: <code>main.py</code>).</p>
              <p><strong className="text-foreground">categoria</strong>: classifica o projeto na interface (backend, rpa, etl, crawler, report).</p>
              <p><strong className="text-foreground">assets</strong>: lista de nomes de assets cadastrados no menu Assets que serao injetados como variaveis de ambiente.</p>
              <p><strong className="text-foreground">timeout</strong>: dica usada pelo orquestrador ao agendar (a aplicacao pode usar via os.environ).</p>
              <p><strong className="text-foreground">retries</strong>: tentativas em caso de erro - orquestrador re-enfileira a execucao caso falhe.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─────────── Fluxo ─────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fluxo de execucao</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Cadastre as <strong className="text-foreground">Maquinas</strong> que terao o agente instalado (cada uma recebe um token).</li>
            <li>Instale o <strong className="text-foreground">Cliente Agente</strong> na maquina e configure URL + token.</li>
            <li>Cadastre os <strong className="text-foreground">Assets</strong> (credenciais, API keys, variaveis).</li>
            <li>Crie um <strong className="text-foreground">Projeto</strong> apontando para o repositorio Git ou suba um ZIP.</li>
            <li>Crie uma <strong className="text-foreground">Fila</strong> e associe o projeto a ela.</li>
            <li>Crie um <strong className="text-foreground">Agendamento</strong> (cron, intervalo) ou dispare manualmente em <strong className="text-foreground">Filas → Executar Agora</strong>.</li>
            <li>Acompanhe a execucao em <strong className="text-foreground">Execucoes</strong> e veja logs em tempo real.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
