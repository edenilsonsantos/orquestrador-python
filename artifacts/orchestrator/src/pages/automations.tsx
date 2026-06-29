import { useState } from "react";
import {
  useListAutomations,
  useListProjects,
  useListQueues,
  useListMachines,
  useCreateAutomation,
  useDeleteAutomation,
  useRunAutomation,
  getListAutomationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Bot, Plus, Trash2, GitBranch, Archive, Play } from "lucide-react";
import { useForm } from "react-hook-form";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativa", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    inactive: { label: "Inativa", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>{s.label}</span>;
}

type FormValues = {
  projectId: number;
  name: string;
  description: string;
  version: string;
  entrypoint: string;
  deployMethod: string;
  repositoryUrl: string;
  repositoryBranch: string;
};

export default function AutomationsPage() {
  const { data: automations, isLoading } = useListAutomations();
  const { data: projects } = useListProjects();
  const { data: queues } = useListQueues();
  const { data: machines } = useListMachines();
  const [open, setOpen] = useState(false);
  const [runFor, setRunFor] = useState<{ id: number; name: string } | null>(null);
  const [runQueueId, setRunQueueId] = useState<string>("");
  const [runMachineId, setRunMachineId] = useState<string>("");
  const [runInput, setRunInput] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const createAutomation = useCreateAutomation();
  const deleteAutomation = useDeleteAutomation();
  const runAutomation = useRunAutomation();
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    defaultValues: { deployMethod: "zip", version: "1.0.0", entrypoint: "main.py" },
  });

  const deployMethod = watch("deployMethod");

  function onSubmit(data: FormValues) {
    if (!data.projectId) {
      toast({ title: "Erro", description: "Selecione um projeto.", variant: "destructive" });
      return;
    }
    createAutomation.mutate(
      {
        data: {
          projectId: Number(data.projectId),
          name: data.name,
          description: data.description || undefined,
          version: data.version || undefined,
          entrypoint: data.entrypoint || undefined,
          deployMethod: data.deployMethod || undefined,
          repositoryUrl: data.deployMethod === "git" ? data.repositoryUrl || undefined : undefined,
          repositoryBranch: data.deployMethod === "git" ? data.repositoryBranch || undefined : undefined,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getListAutomationsQueryKey() });
          setOpen(false);
          reset();
        },
      },
    );
  }

  function handleRun() {
    setRunError(null);
    if (!runFor) return;
    let inputData: string | undefined;
    if (runInput.trim()) {
      try {
        inputData = JSON.stringify(JSON.parse(runInput));
      } catch {
        setRunError("JSON invalido. Verifique a sintaxe.");
        return;
      }
    }
    runAutomation.mutate(
      {
        id: runFor.id,
        data: {
          queueId: runQueueId ? Number(runQueueId) : null,
          machineId: runMachineId ? Number(runMachineId) : null,
          inputData: inputData ?? null,
        },
      },
      {
        onSuccess: () => {
          setRunFor(null);
          setRunQueueId("");
          setRunMachineId("");
          setRunInput("");
          toast({ title: "Job criado", description: "Automacao enviada para execucao." });
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao executar", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="space-y-6" data-testid="automations-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Automacoes</h1>
          <p className="text-sm text-muted-foreground mt-1">Scripts Python versionados, vinculados a projetos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-automation"><Plus className="h-4 w-4 mr-2" />Nova Automacao</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Automacao</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Projeto</Label>
                <Select onValueChange={(v) => setValue("projectId", Number(v))}>
                  <SelectTrigger data-testid="select-automation-project"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome</Label>
                <Input {...register("name")} placeholder="Extrair-Relatorios" data-testid="input-automation-name" />
              </div>
              <div>
                <Label>Descricao</Label>
                <Textarea {...register("description")} placeholder="Descricao da automacao" data-testid="input-automation-description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Versao</Label>
                  <Input {...register("version")} placeholder="1.0.0" data-testid="input-automation-version" />
                </div>
                <div>
                  <Label>Entrypoint</Label>
                  <Input {...register("entrypoint")} placeholder="main.py" data-testid="input-automation-entrypoint" />
                </div>
              </div>
              <div>
                <Label>Deploy via</Label>
                <Select onValueChange={(v) => setValue("deployMethod", v)} defaultValue="zip">
                  <SelectTrigger data-testid="select-deploy-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zip">Upload ZIP</SelectItem>
                    <SelectItem value="git">GitHub/GitLab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {deployMethod === "git" && (
                <>
                  <div>
                    <Label>URL do Repositorio</Label>
                    <Input {...register("repositoryUrl")} placeholder="https://github.com/..." data-testid="input-repo-url" />
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <Input {...register("repositoryBranch")} placeholder="main" data-testid="input-repo-branch" />
                  </div>
                </>
              )}
              <Button type="submit" disabled={createAutomation.isPending} data-testid="button-submit-automation">
                {createAutomation.isPending ? "Criando..." : "Criar Automacao"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(automations ?? []).map((automation) => (
            <Card key={automation.id} className="border border-border" data-testid={`automation-card-${automation.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{automation.name}</CardTitle>
                  </div>
                  <StatusBadge status={automation.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {automation.description && (
                  <p className="text-xs text-muted-foreground">{automation.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">{automation.projectName ?? "—"}</Badge>
                  <Badge variant="outline" className="text-xs">v{automation.version}</Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    {automation.deployMethod === "git" ? <GitBranch className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    {automation.deployMethod === "git" ? "Git" : "ZIP"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{automation.entrypoint}</p>
                {automation.repositoryUrl && (
                  <p className="text-xs text-muted-foreground truncate">{automation.repositoryUrl}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => setRunFor({ id: automation.id, name: automation.name })}
                    data-testid={`button-run-automation-${automation.id}`}
                  >
                    <Play className="h-3 w-3 mr-1" />Executar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:text-destructive h-7 w-7 p-0"
                    onClick={() => deleteAutomation.mutate({ id: automation.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListAutomationsQueryKey() }) })}
                    data-testid={`button-delete-automation-${automation.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(automations ?? []).length === 0 && (
            <div className="col-span-3 py-12 text-center text-muted-foreground">
              <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma automacao cadastrada</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!runFor} onOpenChange={(o) => { if (!o) { setRunFor(null); setRunError(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Executar: {runFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fila (opcional)</Label>
              <Select value={runQueueId} onValueChange={setRunQueueId}>
                <SelectTrigger data-testid="select-run-queue"><SelectValue placeholder="Sem fila" /></SelectTrigger>
                <SelectContent>
                  {(queues ?? []).map((q) => (
                    <SelectItem key={q.id} value={String(q.id)}>{q.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Maquina (opcional)</Label>
              <Select value={runMachineId} onValueChange={setRunMachineId}>
                <SelectTrigger data-testid="select-run-machine"><SelectValue placeholder="Selecionar automaticamente" /></SelectTrigger>
                <SelectContent>
                  {(machines ?? []).map((m: any) => (
                    <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Input Data (JSON)</Label>
              <Textarea
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                rows={6}
                placeholder={`{\n  "param": "valor"\n}`}
                className="font-mono text-xs"
                data-testid="input-run-data"
              />
              {runError && <p className="text-xs text-destructive mt-1">{runError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRun} disabled={runAutomation.isPending} data-testid="button-submit-run">
              {runAutomation.isPending ? "Enviando..." : "Executar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
