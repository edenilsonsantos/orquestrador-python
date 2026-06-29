import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetQueue,
  useListQueueItems,
  useEnqueueItem,
  useUpdateQueueItem,
  getListQueueItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Search, Download, Plus, MoreVertical, Info, ScrollText, ExternalLink, RotateCw, RotateCcw, Ban } from "lucide-react";
import { format } from "date-fns";
import type { QueueItem } from "@workspace/api-client-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    successful: { label: "Sucesso", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    in_progress: { label: "Em progresso", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    new: { label: "Novo", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    failed: { label: "Falhou", className: "bg-red-500/20 text-red-400 border-red-500/30" },
    abandoned: { label: "Abandonado", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const s = map[status] ?? { label: status, className: "bg-gray-500/20 text-gray-400" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium ${s.className}`}>{s.label}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: "Alta",
    normal: "Normal",
    low: "Baixa",
  };
  return <span className="text-muted-foreground">{map[priority] ?? priority}</span>;
}

function fmt(d?: string | null) {
  return d ? format(new Date(d), "dd/MM/yyyy HH:mm:ss") : "—";
}

function parseData(raw?: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const PAGE_SIZE = 15;

export default function QueueDetailPage() {
  const params = useParams();
  const queueId = Number(params.id);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: queue, isLoading: queueLoading } = useGetQueue(queueId);
  const { data: items, isLoading: itemsLoading } = useListQueueItems(queueId);
  const enqueue = useEnqueueItem();
  const updateItem = useUpdateQueueItem();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [priority, setPriority] = useState("normal");
  const [specificData, setSpecificData] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [selected, setSelected] = useState<QueueItem | null>(null);

  const rows = useMemo(() => {
    const all = [...((items ?? []) as QueueItem[])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        String(r.id).includes(q) ||
        (r.reference ?? "").toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q) ||
        (r.machineName ?? "").toLowerCase().includes(q) ||
        (r.exception ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListQueueItemsQueryKey(queueId) });
  }

  function handleAdd() {
    setJsonError(null);
    let data: string | undefined;
    if (specificData.trim()) {
      try {
        data = JSON.stringify(JSON.parse(specificData));
      } catch {
        setJsonError("JSON invalido. Verifique a sintaxe.");
        return;
      }
    }
    enqueue.mutate(
      {
        id: queueId,
        data: {
          reference: reference.trim() || undefined,
          priority,
          data,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setAddOpen(false);
          setReference("");
          setPriority("normal");
          setSpecificData("");
          toast({ title: "Transacao adicionada", description: "Item enviado para a fila." });
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao adicionar item", variant: "destructive" }),
      },
    );
  }

  function handleUpdate(id: number, status: string) {
    updateItem.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Transacao atualizada", description: status === "new" ? "Reenfileirada." : "Abandonada." });
        },
        onError: (e: any) => toast({ title: "Erro", description: e?.message ?? "Falha ao atualizar", variant: "destructive" }),
      },
    );
  }

  function exportCsv() {
    const header = ["Reference", "Status", "Prioridade", "Iniciado", "Finalizado", "Robo", "Excecao", "Criado"];
    const lines = rows.map((r) => [
      r.reference ?? r.id,
      r.status,
      r.priority,
      fmt(r.startedAt),
      fmt(r.endedAt),
      r.machineName ?? "",
      (r.exception ?? "").replace(/"/g, '""'),
      fmt(r.createdAt),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((c) => `"${String(c)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fila-${queueId}-transacoes.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4" data-testid="queue-detail-page">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/queues"><span className="hover:text-foreground cursor-pointer">Filas</span></Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">
          Transacoes: {queueLoading ? "…" : queue?.name ?? `#${queueId}`}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative w-72 max-w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar"
            className="pl-8 h-9"
            data-testid="input-search-transactions"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={invalidate} data-testid="button-refresh-transactions">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} data-testid="button-export-transactions">
            <Download className="h-4 w-4 mr-1" />Exportar
          </Button>
          <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setJsonError(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-transaction"><Plus className="h-4 w-4 mr-1" />Nova Transacao</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Nova Transacao</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Reference (opcional)</Label>
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="REF-001" data-testid="input-transaction-reference" />
                  </div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger data-testid="select-transaction-priority"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="low">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Specific Data (JSON)</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">Dados especificos que a automacao podera consumir.</p>
                  <Textarea
                    value={specificData}
                    onChange={(e) => setSpecificData(e.target.value)}
                    rows={8}
                    placeholder={`{\n  "id_solicitacao": 3456121,\n  "tipo_solicitacao": "CCBR0001",\n  "numero_bp": "150437641"\n}`}
                    className="font-mono text-xs"
                    data-testid="input-specific-data"
                  />
                  {jsonError && <p className="text-xs text-destructive mt-1">{jsonError}</p>}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAdd} disabled={enqueue.isPending} data-testid="button-submit-transaction">
                  {enqueue.isPending ? "Enviando..." : "Adicionar a fila"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="text-row-count">{rows.length} transacoes</p>

      <div className="border border-border rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="transactions-table">
            <thead>
              <tr className="border-b border-border text-muted-foreground bg-muted/30">
                <th className="text-left p-3 pr-4 font-medium">Reference</th>
                <th className="text-left p-3 pr-4 font-medium">Status</th>
                <th className="text-left p-3 pr-4 font-medium">Prioridade</th>
                <th className="text-left p-3 pr-4 font-medium">Iniciado</th>
                <th className="text-left p-3 pr-4 font-medium">Finalizado</th>
                <th className="text-left p-3 pr-4 font-medium">Robo</th>
                <th className="text-left p-3 pr-4 font-medium">Excecao</th>
                <th className="text-right p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {itemsLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-border/50"><td colSpan={8} className="p-3"><Skeleton className="h-6 w-full" /></td></tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Nenhuma transacao encontrada</td></tr>
              ) : (
                pageRows.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20" data-testid={`transaction-row-${item.id}`}>
                    <td className="p-3 pr-4 font-mono text-foreground">{item.reference ?? `#${item.id}`}</td>
                    <td className="p-3 pr-4"><StatusBadge status={item.status} /></td>
                    <td className="p-3 pr-4 text-xs"><PriorityBadge priority={item.priority} /></td>
                    <td className="p-3 pr-4 text-muted-foreground text-xs whitespace-nowrap">{fmt(item.startedAt)}</td>
                    <td className="p-3 pr-4 text-muted-foreground text-xs whitespace-nowrap">{fmt(item.endedAt)}</td>
                    <td className="p-3 pr-4 text-muted-foreground">{item.machineName ?? "—"}</td>
                    <td className="p-3 pr-4 text-muted-foreground text-xs max-w-[200px] truncate">{item.exception ?? "—"}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected(item)} data-testid={`button-view-details-${item.id}`} title="Ver detalhes">
                          <Info className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" data-testid={`button-row-menu-${item.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelected(item)} data-testid={`menu-view-details-${item.id}`}>
                              <Info className="h-4 w-4 mr-2" />Ver detalhes
                            </DropdownMenuItem>
                            {item.status === "failed" && (
                              <DropdownMenuItem onClick={() => handleUpdate(item.id, "new")} data-testid={`menu-retry-${item.id}`}>
                                <RotateCcw className="h-4 w-4 mr-2" />Reenfileirar
                              </DropdownMenuItem>
                            )}
                            {(item.status === "new" || item.status === "failed") && (
                              <DropdownMenuItem onClick={() => handleUpdate(item.id, "abandoned")} data-testid={`menu-abandon-${item.id}`}>
                                <Ban className="h-4 w-4 mr-2" />Abandonar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {item.jobId != null && (
                              <Link href={`/jobs/${item.jobId}`}>
                                <DropdownMenuItem data-testid={`menu-view-job-${item.id}`}>
                                  <ExternalLink className="h-4 w-4 mr-2" />Ver job executor
                                </DropdownMenuItem>
                              </Link>
                            )}
                            <Link href={`/execution-logs?execucao=${item.jobId ?? item.id}`}>
                              <DropdownMenuItem data-testid={`menu-view-log-${item.id}`}>
                                <ScrollText className="h-4 w-4 mr-2" />Ver log de execucao
                              </DropdownMenuItem>
                            </Link>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-3 border-t border-border text-xs text-muted-foreground">
          <span>
            {rows.length === 0 ? "0" : `${(safePage - 1) * PAGE_SIZE + 1} - ${Math.min(safePage * PAGE_SIZE, rows.length)}`} de {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-7" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="button-prev-page">Anterior</Button>
            <span>Pagina {safePage} / {totalPages}</span>
            <Button size="sm" variant="ghost" className="h-7" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} data-testid="button-next-page">Proxima</Button>
          </div>
        </div>
      </div>

      <TransactionDetailSheet item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function TransactionDetailSheet({ item, onClose }: { item: QueueItem | null; onClose: () => void }) {
  const specificData = useMemo(() => (item ? parseData(item.data) : null), [item]);
  const outputData = useMemo(() => (item ? parseData(item.output) : null), [item]);

  return (
    <Sheet open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-[440px] sm:max-w-[440px] overflow-y-auto" data-testid="transaction-detail-sheet">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-sm truncate">Transacao {item.reference ?? `#${item.id}`}</SheetTitle>
            </SheetHeader>
            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" data-testid="tab-details">Detalhes</TabsTrigger>
                <TabsTrigger value="comments" data-testid="tab-comments">Comentarios</TabsTrigger>
                <TabsTrigger value="history" data-testid="tab-history">Historico</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-5 mt-4">
                <div>
                  <p className="text-sm font-semibold mb-2">Specific Data: <span className="font-normal text-muted-foreground">Object</span></p>
                  {specificData ? (
                    <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3" data-testid="specific-data-content">
                      {Object.entries(specificData).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[auto_1fr] gap-2 text-xs">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="text-foreground font-mono break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Empty</p>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold mb-1">Output Data: <span className="font-normal text-muted-foreground">{outputData || item.exception ? "" : "Empty"}</span></p>
                  {outputData && (
                    <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3 text-xs" data-testid="output-data-content">
                      {Object.entries(outputData).map(([k, v]) => (
                        <div key={k} className="grid grid-cols-[auto_1fr] gap-2">
                          <span className="text-muted-foreground">{k}:</span>
                          <span className="font-mono break-all">{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.exception && (
                    <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3 text-xs mt-2">
                      <div className="grid grid-cols-[auto_1fr] gap-2"><span className="text-muted-foreground">exception:</span><span className="font-mono break-all text-red-400">{item.exception}</span></div>
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-border p-3 space-y-1.5 text-xs">
                  <div className="grid grid-cols-[auto_1fr] gap-2"><span className="text-muted-foreground">Status:</span><span><StatusBadge status={item.status} /></span></div>
                  <div className="grid grid-cols-[auto_1fr] gap-2"><span className="text-muted-foreground">Prioridade:</span><span><PriorityBadge priority={item.priority} /></span></div>
                  <div className="grid grid-cols-[auto_1fr] gap-2"><span className="text-muted-foreground">Tentativas:</span><span className="font-mono">{item.attempts}</span></div>
                  <div className="grid grid-cols-[auto_1fr] gap-2"><span className="text-muted-foreground">Robo:</span><span>{item.machineName ?? "—"}</span></div>
                  <div className="grid grid-cols-[auto_1fr] gap-2"><span className="text-muted-foreground">Deadline:</span><span>{fmt(item.deadline)}</span></div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="mt-4">
                <p className="text-xs text-muted-foreground italic">Nenhum comentario.</p>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground mt-1.5" />
                    <div><p className="font-medium text-foreground">Criado</p><p className="text-muted-foreground">{fmt(item.createdAt)}</p></div>
                  </div>
                  {item.startedAt && (
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5" />
                      <div><p className="font-medium text-foreground">Iniciado</p><p className="text-muted-foreground">{fmt(item.startedAt)}</p></div>
                    </div>
                  )}
                  {item.endedAt && (
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5" />
                      <div><p className="font-medium text-foreground">Finalizado</p><p className="text-muted-foreground">{fmt(item.endedAt)}</p></div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
