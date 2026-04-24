import { useState } from "react";
import { useListAssets, useCreateAsset, useDeleteAsset, getListAssetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, Plus, Trash2, Lock, FileText, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    credential: { label: "Credencial", className: "bg-red-500/20 text-red-400 border-red-500/30", icon: <Lock className="h-3 w-3" /> },
    api_key: { label: "Chave API", className: "bg-amber-500/20 text-amber-400 border-amber-500/30", icon: <KeyRound className="h-3 w-3" /> },
    text: { label: "Texto", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", icon: <FileText className="h-3 w-3" /> },
  };
  const s = map[type] ?? { label: type, className: "bg-gray-500/20 text-gray-400", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>
      {s.icon}{s.label}
    </span>
  );
}

export default function AssetsPage() {
  const { data: assets, isLoading } = useListAssets();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const createAsset = useCreateAsset();
  const deleteAsset = useDeleteAsset();
  const { register, handleSubmit, reset, setValue, watch } = useForm<{
    name: string; type: string; username: string; value: string; description: string;
  }>({ defaultValues: { type: "text" } });

  const selectedType = watch("type");

  function onSubmit(data: any) {
    const payload: any = { name: data.name, type: data.type, value: data.value, description: data.description };
    if (data.type === "credential" && data.username) payload.username = data.username;
    createAsset.mutate({ data: payload }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAssetsQueryKey() });
        setOpen(false);
        reset({ type: "text" });
      }
    });
  }

  function onDelete(id: number) {
    if (!confirm("Excluir este asset?")) return;
    deleteAsset.mutate({ id }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListAssetsQueryKey() })
    });
  }

  return (
    <div className="space-y-6" data-testid="assets-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Variaveis globais, credenciais e chaves de API compartilhadas entre projetos
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-asset"><Plus className="h-4 w-4 mr-2" />Novo Asset</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Asset</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Tipo</Label>
                <Select onValueChange={(v) => setValue("type", v)} defaultValue="text">
                  <SelectTrigger data-testid="select-asset-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto (variavel global)</SelectItem>
                    <SelectItem value="credential">Credencial (usuario + senha)</SelectItem>
                    <SelectItem value="api_key">Chave de API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nome</Label>
                <Input {...register("name")} placeholder="MINHA_VARIAVEL" data-testid="input-asset-name" />
                <p className="text-xs text-muted-foreground mt-1">Use letras maiusculas e _ (sera exposto como variavel de ambiente)</p>
              </div>
              {selectedType === "credential" && (
                <div>
                  <Label>Usuario</Label>
                  <Input {...register("username")} placeholder="usuario_sistema" data-testid="input-asset-username" />
                </div>
              )}
              <div>
                <Label>{selectedType === "credential" ? "Senha" : selectedType === "api_key" ? "Chave" : "Valor"}</Label>
                <Input
                  {...register("value")}
                  type={selectedType === "credential" ? "password" : "text"}
                  data-testid="input-asset-value"
                />
              </div>
              <div>
                <Label>Descricao</Label>
                <Textarea {...register("description")} placeholder="Descreva o uso" data-testid="input-asset-description" />
              </div>
              <Button type="submit" className="w-full" disabled={createAsset.isPending} data-testid="button-submit-asset">
                {createAsset.isPending ? "Salvando..." : "Cadastrar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Total: {assets?.length ?? 0}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 px-4 font-medium">Nome</th>
                  <th className="py-2 px-4 font-medium">Tipo</th>
                  <th className="py-2 px-4 font-medium">Usuario</th>
                  <th className="py-2 px-4 font-medium">Valor</th>
                  <th className="py-2 px-4 font-medium">Descricao</th>
                  <th className="py-2 px-4 font-medium text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {assets?.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30" data-testid={`row-asset-${a.id}`}>
                    <td className="py-3 px-4 font-mono text-xs font-medium">{a.name}</td>
                    <td className="py-3 px-4"><TypeBadge type={a.type} /></td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{a.username ?? "—"}</td>
                    <td className="py-3 px-4 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[260px]" data-testid={`value-asset-${a.id}`}>{a.value}</span>
                        {a.type !== "text" && (
                          <span title="Valor mascarado - so e injetado em texto claro nas execucoes via variaveis de ambiente">
                            <ShieldAlert className="h-3 w-3 text-muted-foreground" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">{a.description ?? "—"}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => onDelete(a.id)}
                        data-testid={`button-delete-asset-${a.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {assets?.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum asset cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
