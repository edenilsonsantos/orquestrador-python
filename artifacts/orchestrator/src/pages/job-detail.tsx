import { useRoute } from "wouter";
import { useGetJob, useGetJobLogs, useRetryJob, useStopJob, getGetJobQueryKey, getGetJobLogsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw, Square, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    successful: { label: "Sucesso", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    running: { label: "Executando", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    pending: { label: "Pendente", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    faulted: { label: "Falhou", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    stopped: { label: "Parado", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    skipped: { label: "Ignorado", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>{s.label}</span>;
}

export default function JobDetailPage() {
  const [, params] = useRoute("/jobs/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();

  const { data: job, isLoading } = useGetJob(id, {
    query: { enabled: !!id, queryKey: getGetJobQueryKey(id) }
  });

  const { data: logs, isLoading: logsLoading } = useGetJobLogs(id, {
    query: { enabled: !!id, queryKey: getGetJobLogsQueryKey(id) }
  });

  const retry = useRetryJob();
  const stop = useStopJob();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Job nao encontrado</p>
        <Link href="/jobs">
          <Button variant="link" className="mt-2">Voltar para lista</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="job-detail">
      <div className="flex items-center gap-3">
        <Link href="/jobs">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Job #{job.id}</h1>
          <p className="text-sm text-muted-foreground">{job.automationName ?? job.projectName ?? "—"}{job.queueName ? ` — ${job.queueName}` : ""}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={job.status} />
          {job.status === "faulted" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => retry.mutate({ id: job.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetJobQueryKey(id) }) })}
              data-testid="button-retry"
            >
              <RotateCcw className="h-4 w-4 mr-2" />Tentar Novamente
            </Button>
          )}
          {job.status === "running" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => stop.mutate({ id: job.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getGetJobQueryKey(id) }) })}
              data-testid="button-stop"
            >
              <Square className="h-4 w-4 mr-2" />Interromper
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Maquina", value: job.machineName ?? "—" },
          { label: "Tentativa", value: `#${job.attempt}` },
          { label: "Codigo de saida", value: job.exitCode != null ? String(job.exitCode) : "—" },
          { label: "Duracao", value: job.durationSeconds ? `${Math.floor(job.durationSeconds / 60)}m ${job.durationSeconds % 60}s` : "—" },
          { label: "Iniciado", value: job.startedAt ? format(new Date(job.startedAt), "dd/MM/yyyy HH:mm:ss") : "—" },
          { label: "Finalizado", value: job.finishedAt ? format(new Date(job.finishedAt), "dd/MM/yyyy HH:mm:ss") : "—" },
          { label: "Criado", value: format(new Date(job.createdAt), "dd/MM/yyyy HH:mm:ss") },
        ].map((item) => (
          <Card key={item.label} className="border border-border">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {job.errorMessage && (
        <Card className="border border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-400">Mensagem de Erro</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-red-300 font-mono">{job.errorMessage}</p>
          </CardContent>
        </Card>
      )}

      {(job.inputData || job.outputData) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {job.inputData && (
            <Card className="border border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Input Data</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-black/60 rounded p-3 font-mono text-xs overflow-x-auto text-green-300" data-testid="job-input-data">{job.inputData}</pre>
              </CardContent>
            </Card>
          )}
          {job.outputData && (
            <Card className="border border-border">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-foreground">Output Data</CardTitle></CardHeader>
              <CardContent>
                <pre className="bg-black/60 rounded p-3 font-mono text-xs overflow-x-auto text-green-300" data-testid="job-output-data">{job.outputData}</pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Logs de Execucao</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="bg-black/60 rounded p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-0.5"
            data-testid="job-logs"
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
