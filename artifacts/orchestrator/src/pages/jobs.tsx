import { useState } from "react";
import { useListJobs, useRetryJob, useStopJob, getListJobsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { RotateCcw, Square, ExternalLink } from "lucide-react";
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

export default function JobsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const qc = useQueryClient();

  const params = statusFilter !== "all" ? { status: statusFilter } : {};
  const { data: jobs, isLoading } = useListJobs(params, {
    query: { queryKey: getListJobsQueryKey(params) }
  });

  const retry = useRetryJob();
  const stop = useStopJob();

  function handleRetry(id: number) {
    retry.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListJobsQueryKey(params) }) });
  }

  function handleStop(id: number) {
    stop.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListJobsQueryKey(params) }) });
  }

  return (
    <div className="space-y-6" data-testid="jobs-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">Historico e status de todas as execucoes de automacoes</p>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="running">Executando</SelectItem>
            <SelectItem value="successful">Sucesso</SelectItem>
            <SelectItem value="faulted">Falhou</SelectItem>
            <SelectItem value="stopped">Parado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="jobs-table">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="text-left p-3 pr-4 font-medium">ID</th>
                    <th className="text-left p-3 pr-4 font-medium">Automacao</th>
                    <th className="text-left p-3 pr-4 font-medium">Projeto</th>
                    <th className="text-left p-3 pr-4 font-medium">Fila</th>
                    <th className="text-left p-3 pr-4 font-medium">Maquina</th>
                    <th className="text-left p-3 pr-4 font-medium">Status</th>
                    <th className="text-left p-3 pr-4 font-medium">Duracao</th>
                    <th className="text-left p-3 pr-4 font-medium">Criado</th>
                    <th className="text-left p-3 font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {(jobs ?? []).map((job) => (
                    <tr key={job.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20" data-testid={`job-row-${job.id}`}>
                      <td className="p-3 pr-4 text-muted-foreground font-mono">#{job.id}</td>
                      <td className="p-3 pr-4 text-foreground">{job.automationName ?? "—"}</td>
                      <td className="p-3 pr-4 text-muted-foreground">{job.projectName ?? "—"}</td>
                      <td className="p-3 pr-4 text-muted-foreground">{job.queueName ?? "—"}</td>
                      <td className="p-3 pr-4 text-muted-foreground">{job.machineName ?? "—"}</td>
                      <td className="p-3 pr-4"><StatusBadge status={job.status} /></td>
                      <td className="p-3 pr-4 text-muted-foreground text-xs">
                        {job.durationSeconds ? `${Math.floor(job.durationSeconds / 60)}m ${job.durationSeconds % 60}s` : "—"}
                      </td>
                      <td className="p-3 pr-4 text-muted-foreground text-xs">
                        {format(new Date(job.createdAt), "dd/MM HH:mm")}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Link href={`/jobs/${job.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-view-job-${job.id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </Link>
                          {job.status === "faulted" && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleRetry(job.id)} data-testid={`button-retry-job-${job.id}`}>
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                          {job.status === "running" && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => handleStop(job.id)} data-testid={`button-stop-job-${job.id}`}>
                              <Square className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(jobs ?? []).length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">Nenhum job encontrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
