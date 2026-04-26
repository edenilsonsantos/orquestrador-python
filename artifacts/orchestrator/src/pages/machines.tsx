import { useState } from "react";
import { useListMachines, useCreateMachine, useToggleMachineMaintenance, useDeleteMachine, getListMachinesQueryKey, getGetMachineQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, Plus, Wrench, Trash2, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { MachineConnectionDialog } from "@/components/machines/connection-dialog";

function MachineStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    online: { label: "Online", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    offline: { label: "Offline", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    maintenance: { label: "Manutenção", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>{s.label}</span>;
}

export default function MachinesPage() {
  const { data: machines, isLoading } = useListMachines();
  const [open, setOpen] = useState(false);
  const [connectionMachineId, setConnectionMachineId] = useState<number | null>(null);
  const qc = useQueryClient();
  const createMachine = useCreateMachine();
  const toggleMaintenance = useToggleMachineMaintenance();
  const deleteMachine = useDeleteMachine();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<{ name: string; hostname: string; operatingSystem: string; category: string }>({
    defaultValues: { category: "backend" },
  });

  function onSubmit(data: { name: string; hostname: string; operatingSystem: string; category: string }) {
    createMachine.mutate({ data }, {
      onSuccess: (created) => {
        qc.invalidateQueries({ queryKey: getListMachinesQueryKey() });
        setOpen(false);
        reset();
        // Seed the single-machine cache with the freshly returned token so the dialog renders instantly
        qc.setQueryData(getGetMachineQueryKey(created.id), created);
        setConnectionMachineId(created.id);
      }
    });
  }

  function handleToggleMaintenance(id: number, enabled: boolean) {
    toggleMaintenance.mutate({ id, data: { enabled } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListMachinesQueryKey() })
    });
  }

  function handleDelete(id: number) {
    deleteMachine.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListMachinesQueryKey() })
    });
  }

  return (
    <div className="space-y-6" data-testid="machines-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Máquinas</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciamento de computadores e agentes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-machine"><Plus className="h-4 w-4 mr-2" />Adicionar Máquina</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Máquina</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  {...register("name", {
                    required: "Nome é obrigatório",
                    pattern: {
                      value: /^[A-Za-z0-9._ -]{1,64}$/,
                      message: "Use apenas letras, números, ponto, sublinhado, hífen e espaço (1 a 64 caracteres).",
                    },
                  })}
                  placeholder="VM-Producao-01"
                  data-testid="input-machine-name"
                />
                {errors?.name?.message && (
                  <p className="text-xs text-destructive mt-1" data-testid="error-machine-name">
                    {String(errors.name.message)}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Apenas letras, números, ponto, sublinhado, hífen e espaço — usado no instalador Windows.
                </p>
              </div>
              <div>
                <Label>Hostname / IP</Label>
                <Input {...register("hostname")} placeholder="192.168.1.100" data-testid="input-machine-hostname" />
              </div>
              <div>
                <Label>Sistema Operacional</Label>
                <Input {...register("operatingSystem")} placeholder="Ubuntu 22.04" data-testid="input-machine-os" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select onValueChange={(v) => setValue("category", v)} defaultValue="backend">
                  <SelectTrigger data-testid="select-machine-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backend">Backend (APIs/ETL/dados)</SelectItem>
                    <SelectItem value="rpa">Automacoes Graficas (RPA/UI)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMachine.isPending} data-testid="button-submit-machine">
                {createMachine.isPending ? "Cadastrando..." : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(machines ?? []).map((machine) => (
            <Card key={machine.id} className="border border-border" data-testid={`machine-card-${machine.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{machine.name}</CardTitle>
                  </div>
                  <MachineStatusBadge status={machine.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground font-mono">{machine.hostname}</p>
                <p className="text-xs text-muted-foreground">{machine.operatingSystem}</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">{machine.category === "rpa" ? "RPA" : "Backend"}</Badge>
                </div>
                {machine.cpuPercent != null && (
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>CPU: {machine.cpuPercent.toFixed(1)}%</span>
                    <span>RAM: {machine.memoryPercent?.toFixed(1)}%</span>
                  </div>
                )}
                {machine.lastHeartbeat && (
                  <p className="text-xs text-muted-foreground">
                    Último heartbeat: {format(new Date(machine.lastHeartbeat), "dd/MM HH:mm:ss")}
                  </p>
                )}
                <div className="flex gap-2 pt-1 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => setConnectionMachineId(machine.id)}
                    data-testid={`button-connection-${machine.id}`}
                  >
                    <KeyRound className="h-3 w-3 mr-1" />
                    Conexão
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => handleToggleMaintenance(machine.id, !machine.maintenanceMode)}
                    data-testid={`button-maintenance-${machine.id}`}
                  >
                    <Wrench className="h-3 w-3 mr-1" />
                    {machine.maintenanceMode ? "Reativar" : "Manutenção"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => handleDelete(machine.id)}
                    data-testid={`button-delete-machine-${machine.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(machines ?? []).length === 0 && (
            <div className="col-span-3 py-12 text-center text-muted-foreground">
              <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma máquina cadastrada</p>
            </div>
          )}
        </div>
      )}

      <MachineConnectionDialog
        machineId={connectionMachineId}
        open={connectionMachineId != null}
        onOpenChange={(v) => !v && setConnectionMachineId(null)}
      />
    </div>
  );
}
