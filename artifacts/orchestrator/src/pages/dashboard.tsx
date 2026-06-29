import { useGetDashboardSummary, useGetJobStats, useGetQueueHealth, useGetRecentJobs } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Monitor, Play, CheckCircle, AlertCircle, Clock, Server, Layers, Users } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    successful: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    faulted: "bg-red-500/20 text-red-400 border-red-500/30",
    stopped: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    skipped: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  const labels: Record<string, string> = {
    successful: "Sucesso",
    running: "Executando",
    pending: "Pendente",
    faulted: "Falhou",
    stopped: "Parado",
    skipped: "Ignorado",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${variants[status] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: stats, isLoading: statsLoading } = useGetJobStats();
  const { data: queueHealth, isLoading: queueLoading } = useGetQueueHealth();
  const { data: recentJobs, isLoading: recentLoading } = useGetRecentJobs();

  const metricCards = [
    {
      title: "Jobs Hoje",
      value: summary?.jobsToday ?? 0,
      icon: Play,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      title: "Em Execução",
      value: summary?.jobsRunning ?? 0,
      icon: Monitor,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Taxa de Sucesso",
      value: `${summary?.successRate ?? 0}%`,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Erros Hoje",
      value: summary?.errorsToday ?? 0,
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      title: "Máquinas Online",
      value: `${summary?.machinesOnline ?? 0}/${summary?.machinesTotal ?? 0}`,
      icon: Server,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      title: "Itens Pendentes",
      value: summary?.pendingItems ?? 0,
      icon: Clock,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
    },
    {
      title: "Filas Ativas",
      value: summary?.queuesActive ?? 0,
      icon: Layers,
      color: "text-indigo-400",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Projetos",
      value: summary?.projectsTotal ?? 0,
      icon: Users,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral do sistema de automação</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="border border-border" data-testid={`metric-${card.title}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{card.title}</p>
                    {summaryLoading ? (
                      <Skeleton className="h-7 w-16 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                    )}
                  </div>
                  <div className={`p-2.5 rounded-lg ${card.bg}`}>
                    <Icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execution Chart */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Jobs — Últimos 7 dias</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats ?? []} barSize={20} barGap={4}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="completed" name="Concluídas" fill="hsl(152 69% 49%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="errors" name="Erros" fill="hsl(0 84% 60%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Queue Health */}
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Saúde das Filas</CardTitle>
          </CardHeader>
          <CardContent>
            {queueLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2">
                {(queueHealth ?? []).map((q) => (
                  <div key={q.queueId} className="flex items-center justify-between py-2 border-b border-border last:border-0" data-testid={`queue-health-${q.queueId}`}>
                    <div>
                      <p className="text-sm font-medium text-foreground">{q.queueName}</p>
                      <p className="text-xs text-muted-foreground">
                        {q.pending} pendentes · {q.running} executando
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-emerald-400">{q.completed} ok</span>
                      {q.errors > 0 && <span className="text-xs text-red-400">{q.errors} erros</span>}
                      <Badge variant={q.status === "active" ? "default" : "secondary"} className="text-xs">
                        {q.status === "active" ? "Ativa" : "Pausada"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {(queueHealth ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma fila configurada</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Jobs Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="recent-jobs-table">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left pb-2 pr-4 font-medium">ID</th>
                    <th className="text-left pb-2 pr-4 font-medium">Automação</th>
                    <th className="text-left pb-2 pr-4 font-medium">Fila</th>
                    <th className="text-left pb-2 pr-4 font-medium">Máquina</th>
                    <th className="text-left pb-2 pr-4 font-medium">Status</th>
                    <th className="text-left pb-2 font-medium">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {(recentJobs ?? []).map((job) => (
                    <tr key={job.id} className="border-b border-border/50 last:border-0" data-testid={`job-row-${job.id}`}>
                      <td className="py-2 pr-4 text-muted-foreground font-mono">#{job.id}</td>
                      <td className="py-2 pr-4 text-foreground">{job.automationName ?? job.projectName ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{job.queueName ?? "—"}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{job.machineName ?? "—"}</td>
                      <td className="py-2 pr-4"><StatusBadge status={job.status} /></td>
                      <td className="py-2 text-muted-foreground text-xs">
                        {format(new Date(job.createdAt), "dd/MM HH:mm")}
                      </td>
                    </tr>
                  ))}
                  {(recentJobs ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted-foreground">Nenhum job encontrado</td>
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
