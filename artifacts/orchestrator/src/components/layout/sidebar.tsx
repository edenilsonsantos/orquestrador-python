import { Link, useLocation } from "wouter";
import { Activity, Server, Users, Layers, PlayCircle, Clock, LayoutGrid, KeyRound, BookOpen, ScrollText, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/machines", label: "Maquinas", icon: Server },
  { href: "/projects", label: "Projetos", icon: LayoutGrid },
  { href: "/automations", label: "Automacoes", icon: Bot },
  { href: "/queues", label: "Filas", icon: Layers },
  { href: "/jobs", label: "Jobs", icon: PlayCircle },
  { href: "/execution-logs", label: "Log de Execucao", icon: ScrollText },
  { href: "/schedules", label: "Agendamentos", icon: Clock },
  { href: "/assets", label: "Assets", icon: KeyRound },
  { href: "/users", label: "Usuarios", icon: Users },
  { href: "/manual", label: "Manual", icon: BookOpen },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <h1 className="text-base font-bold tracking-tight text-primary">PyOrchestrator</h1>
      </div>
      <div className="flex-1 overflow-auto py-3">
        <nav className="grid gap-0.5 px-2">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-2 h-9 text-sm ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`nav-link-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t p-3">
        <p className="text-xs text-muted-foreground text-center">v1.0.0</p>
      </div>
    </div>
  );
}
