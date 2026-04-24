import { useState } from "react";
import { useListProjects, useCreateProject, useDeleteProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Layers, Plus, Trash2, GitBranch, Archive } from "lucide-react";
import { useForm } from "react-hook-form";

function ProjectStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Ativo", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    inactive: { label: "Inativo", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    deploying: { label: "Implantando", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>{s.label}</span>;
}

export default function ProjectsPage() {
  const { data: projects, isLoading } = useListProjects();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const { register, handleSubmit, reset, setValue, watch } = useForm<{
    name: string;
    description: string;
    category: string;
    deployMethod: string;
    repositoryUrl: string;
    repositoryBranch: string;
  }>({ defaultValues: { category: "backend", deployMethod: "zip" } });

  const deployMethod = watch("deployMethod");

  function onSubmit(data: { name: string; description: string; category: string; deployMethod: string; repositoryUrl: string; repositoryBranch: string }) {
    createProject.mutate({ data }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        setOpen(false);
        reset();
      }
    });
  }

  return (
    <div className="space-y-6" data-testid="projects-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">Automações Python gerenciadas pelo orquestrador</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-project"><Plus className="h-4 w-4 mr-2" />Novo Projeto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Projeto</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input {...register("name")} placeholder="ETL-Financeiro" data-testid="input-project-name" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea {...register("description")} placeholder="Descrição do projeto" data-testid="input-project-description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Categoria</Label>
                  <Select onValueChange={(v) => setValue("category", v)} defaultValue="backend">
                    <SelectTrigger data-testid="select-project-category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backend">Backend</SelectItem>
                      <SelectItem value="rpa">RPA</SelectItem>
                    </SelectContent>
                  </Select>
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
              </div>
              {deployMethod === "git" && (
                <>
                  <div>
                    <Label>URL do Repositório</Label>
                    <Input {...register("repositoryUrl")} placeholder="https://github.com/..." data-testid="input-repo-url" />
                  </div>
                  <div>
                    <Label>Branch</Label>
                    <Input {...register("repositoryBranch")} placeholder="main" data-testid="input-repo-branch" />
                  </div>
                </>
              )}
              <Button type="submit" disabled={createProject.isPending} data-testid="button-submit-project">
                {createProject.isPending ? "Criando..." : "Criar Projeto"}
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
          {(projects ?? []).map((project) => (
            <Card key={project.id} className="border border-border" data-testid={`project-card-${project.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{project.name}</CardTitle>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {project.description && (
                  <p className="text-xs text-muted-foreground">{project.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{project.category === "rpa" ? "RPA" : "Backend"}</Badge>
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    {project.deployMethod === "git" ? <GitBranch className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                    {project.deployMethod === "git" ? "Git" : "ZIP"}
                  </Badge>
                </div>
                {project.activeVersion && (
                  <p className="text-xs text-muted-foreground">Versão: {project.activeVersion}</p>
                )}
                {project.repositoryUrl && (
                  <p className="text-xs text-muted-foreground truncate">{project.repositoryUrl}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteProject.mutate({ id: project.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListProjectsQueryKey() }) })}
                    data-testid={`button-delete-project-${project.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(projects ?? []).length === 0 && (
            <div className="col-span-3 py-12 text-center text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum projeto cadastrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
