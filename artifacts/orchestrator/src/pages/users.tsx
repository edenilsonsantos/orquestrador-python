import { useState } from "react";
import { useListUsers, useCreateUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Trash2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; className: string }> = {
    admin: { label: "Admin", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    operator: { label: "Operador", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    viewer: { label: "Visualizador", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const s = map[role] ?? { label: role, className: "bg-gray-500/20 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>{s.label}</span>;
}

export default function UsersPage() {
  const { data: users, isLoading } = useListUsers();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const { register, handleSubmit, reset, setValue } = useForm<{
    name: string;
    email: string;
    role: string;
    password: string;
  }>({ defaultValues: { role: "viewer" } });

  function onSubmit(data: { name: string; email: string; role: string; password: string }) {
    createUser.mutate({ data }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setOpen(false);
        reset();
      }
    });
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerenciamento de acesso e permissoes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user"><Plus className="h-4 w-4 mr-2" />Novo Usuario</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Usuario</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input {...register("name")} placeholder="Joao da Silva" data-testid="input-user-name" />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input {...register("email")} type="email" placeholder="joao@empresa.com" data-testid="input-user-email" />
              </div>
              <div>
                <Label>Senha</Label>
                <Input {...register("password")} type="password" data-testid="input-user-password" />
              </div>
              <div>
                <Label>Perfil</Label>
                <Select onValueChange={(v) => setValue("role", v)} defaultValue="viewer">
                  <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operator">Operador</SelectItem>
                    <SelectItem value="viewer">Visualizador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createUser.isPending} data-testid="button-submit-user">
                {createUser.isPending ? "Criando..." : "Criar Usuario"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {(users ?? []).map((user) => (
            <Card key={user.id} className="border border-border" data-testid={`user-card-${user.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <RoleBadge role={user.role} />
                    <Badge variant={user.active ? "default" : "secondary"} className="text-xs">
                      {user.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-destructive hover:text-destructive h-7 w-7 p-0"
                      onClick={() => deleteUser.mutate({ id: user.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() }) })}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(users ?? []).length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum usuario cadastrado</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
