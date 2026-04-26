import { useState } from "react";
import { useGetMachine } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Check, Download, Terminal, KeyRound, Server } from "lucide-react";

function CopyField({ value, testid }: { value: string; testid: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-center gap-2 bg-muted/40 border border-border rounded px-3 py-2 font-mono text-xs">
      <span className="flex-1 truncate" data-testid={testid}>{value}</span>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={copy} data-testid={`${testid}-copy`}>
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

function CodeBlock({ code, testid }: { code: string; testid: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative">
      <pre className="bg-zinc-950 border border-border rounded-md p-3 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre" data-testid={testid}>
        {code}
      </pre>
      <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={copy} data-testid={`${testid}-copy`}>
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </Button>
    </div>
  );
}

interface Props {
  machineId: number | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function MachineConnectionDialog({ machineId, open, onOpenChange }: Props) {
  const { data: machine, isLoading } = useGetMachine(machineId ?? 0, {
    query: { enabled: open && machineId != null },
  });

  const orchUrl = `${window.location.protocol}//${window.location.host}`;
  const downloadUrl = `${orchUrl}/api/agent/download`;
  const installCmd = `pip install requests pyyaml psutil`;
  const downloadCmd = `curl -O ${downloadUrl}`;

  const runCmd = machine
    ? `python pyorchestrator-agent.py \\
  --orchestrator ${orchUrl} \\
  --token ${machine.agentToken} \\
  --machine "${machine.name}"`
    : "";
  const envCmd = machine
    ? `export ORCH_URL=${orchUrl}
export ORCH_TOKEN=${machine.agentToken}
export ORCH_MACHINE="${machine.name}"
python pyorchestrator-agent.py`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="machine-connection-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Conexão do agente {machine ? `— ${machine.name}` : ""}
          </DialogTitle>
          <DialogDescription>
            Use as credenciais e comandos abaixo para conectar o cliente agente nesta máquina ao orquestrador.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !machine ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <KeyRound className="h-4 w-4" />Credenciais de conexão
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">URL do orquestrador</p>
                  <CopyField value={orchUrl} testid="conn-orch-url" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Nome da máquina (--machine)</p>
                  <CopyField value={machine.name} testid="conn-machine-name" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Token do agente (--token)</p>
                  <CopyField value={machine.agentToken} testid="conn-agent-token" />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Terminal className="h-4 w-4" />1. Instalar dependências (Python 3.9+)
              </h3>
              <CodeBlock code={installCmd} testid="conn-install-cmd" />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Download className="h-4 w-4" />2. Baixar o cliente agente
              </h3>
              <CodeBlock code={downloadCmd} testid="conn-download-cmd" />
              <p className="text-xs text-muted-foreground">
                Ou clique para baixar:{" "}
                <a href={downloadUrl} className="text-primary hover:underline" data-testid="conn-download-link">
                  pyorchestrator-agent.py
                </a>
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Terminal className="h-4 w-4" />3. Executar o agente
              </h3>
              <CodeBlock code={runCmd} testid="conn-run-cmd" />
              <p className="text-xs text-muted-foreground">Alternativa via variáveis de ambiente:</p>
              <CodeBlock code={envCmd} testid="conn-env-cmd" />
            </section>

            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <strong className="block mb-1">⚠ Guarde o token com segurança</strong>
              Esse token autentica esta máquina específica. Não compartilhe — se vazar, exclua a máquina e cadastre novamente para gerar um novo.
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
