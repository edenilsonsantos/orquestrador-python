import { useState } from "react";
import { useListQueues, useListProjects, useCreateQueue, useDeleteQueue, useAddQueueItem, getListQueuesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers, Plus, Trash2, Play } from "lucide-react";
import { useForm } from "react-hook-form";

export default function QueuesPage() {
  const { data: queues, isLoading } = useListQueues();
  const { data: projects } = useListProjects();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const createQueue = useCreateQueue();
  const deleteQueue = useDeleteQueue();
  const addItem = useAddQueueItem();
  const { register, handleSubmit, reset, setValue } = useForm<{
    name: string;
    description: string;
    priority: number;
    maxConcurrency: number;
    maxRetries: number;
    retryIntervalSeconds: number;
    projectId: number;
  }>({ defaultValues: { priority: 1, maxConcurrency: 1, maxRetries: 3, retryIntervalSeconds: 300 } });

  function onSubmit(data: { name: string; description: string; priority: number; maxConcurrency: number; maxRetries: number; retryIntervalSeconds: number; projectId: number }) {
    createQueue.mutate({ data }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListQueuesQueryKey() });
        setOpen(false);
        reset();
      }
    });
  }

  function handleRunNow(queueId: number) {
    addItem.mutate({ id: queueId, data: {} }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListQueuesQueryKey() })
    });
  }

  return (
    <div className="space-y-6" data-testid="queues-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Filas de Execucao</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie filas e configure execucoes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-queue"><Plus className="h-4 w-4 mr-2" />Nova Fila</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Fila</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input {...register("name")} placeholder="Fila-ETL-Principal" data-testid="input-queue-name" />
              </div>
              <div>
                <Label>Projeto</Label>
                <Select onValueChange={(v) => setValue("projectId", Number(v))}>
                  <SelectTrigger data-testid="select-queue-project"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prioridade</Label>
                  <Input {...register("priority", { valueAsNumber: true })} type="number" min={1} data-testid="input-queue-priority" />
                </div>
                <div>
                  <Label>Concorrencia max.</Label>
                  <Input {...register("maxConcurrency", { valueAsNumber: true })} type="number" min={1} data-testid="input-queue-concurrency" />
                </div>
                <div>
                  <Label>Tentativas max.</Label>
                  <Input {...register("maxRetries", { valueAsNumber: true })} type="number" min={0} data-testid="input-queue-retries" />
                </div>
                <div>
                  <Label>Intervalo retry (s)</Label>
                  <Input {...register("retryIntervalSeconds", { valueAsNumber: true })} type="number" min={0} data-testid="input-queue-retry-interval" />
                </div>
              </div>
              <Button type="submit" disabled={createQueue.isPending} data-testid="button-submit-queue">
                {createQueue.isPending ? "Criando..." : "Criar Fila"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(queues ?? []).map((queue) => (
            <Card key={queue.id} className="border border-border" data-testid={`queue-card-${queue.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{queue.name}</CardTitle>
                  </div>
                  <Badge variant={queue.status === "active" ? "default" : "secondary"} className="text-xs">
                    {queue.status === "active" ? "Ativa" : "Pausada"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {queue.description && <p className="text-xs text-muted-foreground">{queue.description}</p>}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-yellow-500/10 rounded p-2">
                    <p className="text-lg font-bold text-yellow-400">{queue.pendingCount}</p>
                    <p className="text-xs text-muted-foreground">Pendente</p>
                  </div>
                  <div className="bg-blue-500/10 rounded p-2">
                    <p className="text-lg font-bold text-blue-400">{queue.runningCount}</p>
                    <p className="text-xs text-muted-foreground">Executando</p>
                  </div>
                  <div className="bg-emerald-500/10 rounded p-2">
                    <p className="text-lg font-bold text-emerald-400">{queue.completedCount}</p>
                    <p className="text-xs text-muted-foreground">Concluido</p>
                  </div>
                  <div className="bg-red-500/10 rounded p-2">
                    <p className="text-lg font-bold text-red-400">{queue.errorCount}</p>
                    <p className="text-xs text-muted-foreground">Erro</p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>Prioridade: {queue.priority}</span>
                  <span>·</span>
                  <span>Concorr.: {queue.maxConcurrency}</span>
                  <span>·</span>
                  <span>Retries: {queue.maxRetries}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleRunNow(queue.id)}
                    disabled={addItem.isPending}
                    data-testid={`button-run-queue-${queue.id}`}
                  >
                    <Play className="h-3 w-3 mr-1" />Executar Agora
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteQueue.mutate({ id: queue.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListQueuesQueryKey() }) })}
                    data-testid={`button-delete-queue-${queue.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(queues ?? []).length === 0 && (
            <div className="col-span-2 py-12 text-center text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma fila configurada</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
