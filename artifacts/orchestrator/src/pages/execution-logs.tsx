import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListExecutionLogs,
  getListExecutionLogsQueryKey,
  useListApiKeys,
  getListApiKeysQueryKey,
  useCreateApiKey,
  useRevokeApiKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Plus, Trash2, Copy, KeyRound, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function useExecucaoFilter(): number | undefined {
  const [location] = useLocation();
  const qs = location.includes("?") ? location.split("?")[1] : (typeof window !== "undefined" ? window.location.search.replace(/^\?/, "") : "");
  const params = new URLSearchParams(qs);
  const raw = params.get("execucao");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export default function ExecutionLogsPage() {
  const execucao = useExecucaoFilter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const logParams = execucao !== undefined ? { id_execucao: execucao } : {};
  const { data: logs, isLoading: logsLoading } = useListExecutionLogs(logParams, {
    query: { queryKey: getListExecutionLogsQueryKey(logParams) },
  });

  const { data: apiKeys, isLoading: keysLoading } = useListApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();

  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<{ name: string }>();

  function onCreateKey(data: { name: string }) {
    createKey.mutate(
      { data },
      {
        onSuccess: (res: any) => {
          setCreatedKey(res?.key ?? null);
          qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
          reset();
        },
      },
    );
  }

  function handleRevoke(id: number) {
    revokeKey.mutate(
      { id },
      { onSuccess: () => qc.invalidateQueries({ queryKey: getListApiKeysQueryKey() }) },
    );
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Conteudo copiado para a area de transferencia." });
  }

  const ingestUrl = `${window.location.origin}/api/execution-logs`;
  const curlExample = `curl -X POST "${ingestUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: SUA_CHAVE_AQUI" \\
  -d '{"id_execucao":101,"id_automacao":5,"vm":"VM01","fila":"NotasFiscais","fields":{"step":"start"}}'`;

  return (
    <div className="space-y-6" data-testid="execution-logs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Log de Execucao</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Logs recebidos das automacoes via API
            {execucao !== undefined && (
              <> · filtrando execucao <span className="font-mono text-foreground">#{execucao}</span></>
            )}
          </p>
        </div>
        {execucao !== undefined && (
          <Button variant="outline" size="sm" onClick={() => (window.location.href = `${import.meta.env.BASE_URL}execution-logs`)} data-testid="button-clear-filter">
            <X className="h-3 w-3 mr-1" />Limpar filtro
          </Button>
        )}
      </div>

      {/* LOGS TABLE */}
      <Card className="border border-border">
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="execution-logs-table">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="text-left p-3 pr-4 font-medium">ID</th>
                    <th className="text-left p-3 pr-4 font-medium">Execucao</th>
                    <th className="text-left p-3 pr-4 font-medium">Automacao</th>
                    <th className="text-left p-3 pr-4 font-medium">VM</th>
                    <th className="text-left p-3 pr-4 font-medium">Fila</th>
                    <th className="text-left p-3 pr-4 font-medium">Campos</th>
                    <th className="text-left p-3 font-medium">Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs ?? []).map((log) => (
                    <tr key={log.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 align-top" data-testid={`execution-log-row-${log.id}`}>
                      <td className="p-3 pr-4 text-muted-foreground font-mono">#{log.id}</td>
                      <td className="p-3 pr-4 font-mono text-foreground">{log.id_execucao}</td>
                      <td className="p-3 pr-4 font-mono text-muted-foreground">{log.id_automacao}</td>
                      <td className="p-3 pr-4 text-muted-foreground">{log.vm}</td>
                      <td className="p-3 pr-4 text-muted-foreground">{log.fila}</td>
                      <td className="p-3 pr-4 text-muted-foreground max-w-xs">
                        {log.fields ? (
                          <pre className="text-xs whitespace-pre-wrap break-words font-mono bg-muted/40 rounded p-2 max-h-32 overflow-auto">{JSON.stringify(log.fields, null, 2)}</pre>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                        {format(new Date(log.createdAt), "dd/MM HH:mm:ss")}
                      </td>
                    </tr>
                  ))}
                  {(logs ?? []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nenhum log recebido ainda
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API KEYS MANAGEMENT */}
      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Chaves de API</CardTitle>
          </div>
          <Dialog open={keyDialogOpen} onOpenChange={(o) => { setKeyDialogOpen(o); if (!o) setCreatedKey(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-api-key"><Plus className="h-4 w-4 mr-1" />Gerar Chave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Gerar Chave de API</DialogTitle></DialogHeader>
              {createdKey ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Guarde esta chave agora. Por seguranca, ela <strong>nao sera exibida novamente</strong>.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted rounded p-2 break-all font-mono" data-testid="text-created-key">{createdKey}</code>
                    <Button size="sm" variant="outline" onClick={() => copy(createdKey)} data-testid="button-copy-created-key">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => { setKeyDialogOpen(false); setCreatedKey(null); }} data-testid="button-close-key-dialog">
                      <Check className="h-3 w-3 mr-1" />Pronto
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onCreateKey)} className="space-y-4">
                  <div>
                    <Label>Nome / descricao</Label>
                    <Input {...register("name", { required: true })} placeholder="Agente VM01" data-testid="input-api-key-name" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createKey.isPending} data-testid="button-submit-api-key">
                      {createKey.isPending ? "Gerando..." : "Gerar"}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {keysLoading ? (
            <div className="p-4 space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="api-keys-table">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="text-left p-3 pr-4 font-medium">Nome</th>
                    <th className="text-left p-3 pr-4 font-medium">Prefixo</th>
                    <th className="text-left p-3 pr-4 font-medium">Status</th>
                    <th className="text-left p-3 pr-4 font-medium">Ultimo uso</th>
                    <th className="text-left p-3 pr-4 font-medium">Criada</th>
                    <th className="text-left p-3 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {(apiKeys ?? []).map((k) => (
                    <tr key={k.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20" data-testid={`api-key-row-${k.id}`}>
                      <td className="p-3 pr-4 text-foreground">{k.name}</td>
                      <td className="p-3 pr-4 font-mono text-muted-foreground">{k.keyPrefix}…</td>
                      <td className="p-3 pr-4">
                        <Badge variant={k.revoked ? "secondary" : "default"} className="text-xs">
                          {k.revoked ? "Revogada" : "Ativa"}
                        </Badge>
                      </td>
                      <td className="p-3 pr-4 text-muted-foreground text-xs">
                        {k.lastUsedAt ? format(new Date(k.lastUsedAt), "dd/MM HH:mm") : "—"}
                      </td>
                      <td className="p-3 pr-4 text-muted-foreground text-xs">
                        {format(new Date(k.createdAt), "dd/MM HH:mm")}
                      </td>
                      <td className="p-3">
                        {!k.revoked && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleRevoke(k.id)} data-testid={`button-revoke-api-key-${k.id}`}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(apiKeys ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhuma chave gerada ainda</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CURL EXAMPLE */}
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Como enviar logs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Envie um POST para <code className="text-xs bg-muted rounded px-1 py-0.5 font-mono">/api/execution-logs</code> com o cabecalho <code className="text-xs bg-muted rounded px-1 py-0.5 font-mono">X-API-Key</code>.
          </p>
          <div className="relative">
            <pre className="text-xs bg-muted rounded p-3 overflow-x-auto font-mono" data-testid="text-curl-example">{curlExample}</pre>
            <Button size="sm" variant="outline" className="absolute top-2 right-2 h-7" onClick={() => copy(curlExample)} data-testid="button-copy-curl">
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
