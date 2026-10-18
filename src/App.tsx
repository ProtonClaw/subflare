import { Loader2Icon } from "lucide-react";
import { Redirect, Route, Switch } from "wouter";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login";
import { useMe } from "@/hooks/use-api";
import { DashboardPage } from "@/pages/dashboard";
import { SettingsPage } from "@/pages/settings";
import { SubscriptionDetailPage } from "@/pages/subscription-detail";
import { SubscriptionEditPage } from "@/pages/subscription-edit";
import { SubscriptionNodesPage } from "@/pages/subscription-nodes";
import { SubscriptionsPage } from "@/pages/subscriptions";
import { TemplateEditPage } from "@/pages/template-edit";
import { BuiltinTemplatePage, TemplatesPage } from "@/pages/templates";

export default function App() {
  const me = useMe();

  if (me.isPending) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (me.isError) {
    return <div className="grid min-h-svh place-items-center p-6 text-sm text-destructive">无法连接服务：{me.error.message}</div>;
  }
  if (!me.data.authenticated) return <LoginScreen configured={me.data.configured} />;

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/subscriptions" component={SubscriptionsPage} />
        <Route path="/subscriptions/new">{() => <SubscriptionEditPage />}</Route>
        <Route path="/subscriptions/:id/edit">{(p) => <SubscriptionEditPage id={p.id} />}</Route>
        <Route path="/subscriptions/:id/nodes">{(p) => <SubscriptionNodesPage id={p.id} />}</Route>
        <Route path="/subscriptions/:id">{(p) => <SubscriptionDetailPage id={p.id} />}</Route>
        <Route path="/templates" component={TemplatesPage} />
        <Route path="/templates/new">{() => <TemplateEditPage />}</Route>
        <Route path="/templates/builtin/:id">{(p) => <BuiltinTemplatePage id={p.id} />}</Route>
        <Route path="/templates/:id">{(p) => <TemplateEditPage id={p.id} />}</Route>
        <Route path="/settings" component={SettingsPage} />
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
    </AppShell>
  );
}
