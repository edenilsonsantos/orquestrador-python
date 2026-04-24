import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/components/layout/main-layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import MachinesPage from "@/pages/machines";
import ProjectsPage from "@/pages/projects";
import QueuesPage from "@/pages/queues";
import ExecutionsPage from "@/pages/executions";
import ExecutionDetailPage from "@/pages/execution-detail";
import SchedulesPage from "@/pages/schedules";
import UsersPage from "@/pages/users";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/machines" component={MachinesPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/queues" component={QueuesPage} />
        <Route path="/executions" component={ExecutionsPage} />
        <Route path="/executions/:id" component={ExecutionDetailPage} />
        <Route path="/schedules" component={SchedulesPage} />
        <Route path="/users" component={UsersPage} />
        <Route component={NotFound} />
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
