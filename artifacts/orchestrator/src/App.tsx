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
import QueueDetailPage from "@/pages/queue-detail";
import AutomationsPage from "@/pages/automations";
import JobsPage from "@/pages/jobs";
import JobDetailPage from "@/pages/job-detail";
import ExecutionLogsPage from "@/pages/execution-logs";
import SchedulesPage from "@/pages/schedules";
import UsersPage from "@/pages/users";
import AssetsPage from "@/pages/assets";
import ManualPage from "@/pages/manual";

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
        <Route path="/automations" component={AutomationsPage} />
        <Route path="/queues" component={QueuesPage} />
        <Route path="/queues/:id" component={QueueDetailPage} />
        <Route path="/jobs" component={JobsPage} />
        <Route path="/jobs/:id" component={JobDetailPage} />
        <Route path="/execution-logs" component={ExecutionLogsPage} />
        <Route path="/schedules" component={SchedulesPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/assets" component={AssetsPage} />
        <Route path="/manual" component={ManualPage} />
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
