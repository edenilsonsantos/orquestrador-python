import { useState } from "react";
import { useListSchedules, useListQueues, useCreateSchedule, useToggleSchedule, useDeleteSchedule, getListSchedulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";

export default function SchedulesPage() {
  const { data: schedules, isLoading } = useListSchedules();
  const { data: queues } = useListQueues();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const createSchedule = useCreateSchedule();
  const toggleSchedule = useToggleSchedule();
  const deleteSchedule = useDeleteSchedule();
  const { register, handleSubmit, reset, setValue, watch } = useForm<{
    name: string;
    queueId: number;
    triggerType: string;
    cronExpression: string;
    intervalMinutes: number;
  }>({ defaultValues: { triggerType: "cron" } });

  const triggerType = watch("triggerType");

  function onSubmit(data: { name: string; queueId: number; triggerType: string; cronExpression: string; intervalMinutes: number }) {
    createSchedule.mutate({ data }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        setOpen(false);
        reset();
      }
    });
  }

  function handleToggle(id: number, enabled: boolean) {
    toggleSchedule.mutate({ id, data: { enabled } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListSchedulesQueryKey() })
    });
  }

  return (
    <div className="space-y-6" data-testid="schedules-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Agendamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gatilhos e schedulers de execucao</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-schedule"><Plus className="h-4 w-4 mr-2" />Novo Agendamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Agendamento</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input {...register("name")} placeholder="ETL Diario" data-testid="input-schedule-name" />
              </div>
              <div>
                <Label>Fila</Label>
                <Select onValueChange={(v) => setValue("queueId", Number(v))}>
                  <SelectTrigger data-testid="select-schedule-queue"><SelectValue placeholder="Selecione a fila" /></SelectTrigger>
                  <SelectContent>
                    {(queues ?? []).map((q) => (
                      <SelectItem key={q.id} value={String(q.id)}>{q.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de gatilho</Label>
                <Select onValueChange={(v) => setValue("triggerType", v)} defaultValue="cron">
                  <SelectTrigger data-testid="select-trigger-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cron">Cron</SelectItem>
                    <SelectItem value="interval">Intervalo</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {triggerType === "cron" && (
                <div>
                  <Label>Expressao Cron</Label>
                  <Input {...register("cronExpression")} placeholder="0 8 * * *" data-testid="input-cron" />
                </div>
              )}
              {triggerType === "interval" && (
                <div>
                  <Label>Intervalo (minutos)</Label>
                  <Input {...register("intervalMinutes", { valueAsNumber: true })} type="number" min={1} data-testid="input-interval" />
                </div>
              )}
              <Button type="submit" disabled={createSchedule.isPending} data-testid="button-submit-schedule">
                {createSchedule.isPending ? "Criando..." : "Criar Agendamento"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(schedules ?? []).map((schedule) => (
            <Card key={schedule.id} className="border border-border" data-testid={`schedule-card-${schedule.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{schedule.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {schedule.triggerType === "cron" ? "Cron" : schedule.triggerType === "interval" ? "Intervalo" : "Webhook"}
                        </Badge>
                        {schedule.cronExpression && (
                          <span className="text-xs text-muted-foreground font-mono">{schedule.cronExpression}</span>
                        )}
                        {schedule.intervalMinutes && (
                          <span className="text-xs text-muted-foreground">a cada {schedule.intervalMinutes}min</span>
                        )}
                        {schedule.queueName && (
                          <span className="text-xs text-muted-foreground">→ {schedule.queueName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs text-muted-foreground">
                      {schedule.lastTriggeredAt && (
                        <p>Ult: {format(new Date(schedule.lastTriggeredAt), "dd/MM HH:mm")}</p>
                      )}
                      {schedule.nextRunAt && (
                        <p>Prox: {format(new Date(schedule.nextRunAt), "dd/MM HH:mm")}</p>
                      )}
                    </div>
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => handleToggle(schedule.id, checked)}
                      data-testid={`toggle-schedule-${schedule.id}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:text-destructive h-7 w-7 p-0"
                      onClick={() => deleteSchedule.mutate({ id: schedule.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListSchedulesQueryKey() }) })}
                      data-testid={`button-delete-schedule-${schedule.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(schedules ?? []).length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum agendamento configurado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
