import { useRoute } from "wouter";
import { useGetExecution, useGetExecutionLogs, useRetryExecution, useStopExecution, getGetExecutionQueryKey, getGetExecutionLogsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Square, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: "Concluido", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    running: { label: "Executando", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    pending: { label: "Pendente", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    error: { label: "Erro", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    stopped: { label: "Parado", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>{s.label}</span>;
}

export default function ExecutionDetailPage() {
  const [, params] = useRoute("/executions/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();

  const { data: execution, isLoading } = useGetExecution(id, {
    query: { enabled: !!id, queryKey: getGetExecutionQueryKey(id) }
  });

  const { data: logs, isLoading: logsLoading } = useGetExecutionLogs(id, {
    query: { enabled: !!id, queryKey: getGetExecutionLogsQueryKey(id) }
  });

  const retry = useRetryExecution();
  const stop = useStopExecution();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Execucao nao encontrada</p>
        <Link href="/executions">
          <Button variant="link" className="mt-2">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="execution-detail">
      <div className="flex items-center gap-3">
        <Link href="/executions">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Execucao #{execution.id}</h1>
          <p className="text-sm text-muted-foreground">{execution.projectName} — {execution.queueName}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={execution.status} />
          {execution.status === "error" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => retry.mutate({ id: execution.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetExecutionQueryKey(id) }) })}
              data-testid="button-retry"
            >
              <RotateCcw className="h-4 w-4 mr-2" />Tentar Novamente
            </Button>
          )}
          {execution.status === "running" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => stop.mutate({ id: execution.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetExecutionQueryKey(id) }) })}
              data-testid="button-stop"
            >
              <Square className="h-4 w-4 mr-2" />Interromper
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Maquina", value: execution.machineName ?? "—" },
          { label: "Tentativa", value: `#${execution.attempt}` },
          { label: "Codigo de saida", value: execution.exitCode != null ? String(execution.exitCode) : "—" },
          { label: "Duracao", value: execution.durationSeconds ? `${Math.floor(execution.durationSeconds / 60)}m ${execution.durationSeconds % 60}s` : "—" },
          { label: "Iniciado", value: execution.startedAt ? format(new Date(execution.startedAt), "dd/MM/yyyy HH:mm:ss") : "—" },
          { label: "Finalizado", value: execution.finishedAt ? format(new Date(execution.finishedAt), "dd/MM/yyyy HH:mm:ss") : "—" },
          { label: "Criado", value: format(new Date(execution.createdAt), "dd/MM/yyyy HH:mm:ss") },
        ].map((item) => (
          <Card key={item.label} className="border border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {execution.errorMessage && (
        <Card className="border border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-400">Mensagem de Erro</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-red-300 font-mono">{execution.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Logs de Execucao</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="bg-black/60 rounded p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-0.5"
            data-testid="execution-logs"
          >
            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full bg-white/10" />)}
              </div>
            ) : (logs ?? []).length === 0 ? (
              <p className="text-gray-500">Nenhum log disponivel</p>
            ) : (
              (logs ?? []).map((log) => (
                <div key={log.id} className="flex gap-3" data-testid={`log-line-${log.id}`}>
                  <span className="text-gray-600 flex-shrink-0">
                    {format(new Date(log.timestamp), "HH:mm:ss")}
                  </span>
                  <span className={log.stream === "stderr" ? "text-red-400" : "text-green-300"}>
                    {log.content}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
