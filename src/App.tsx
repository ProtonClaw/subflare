import { Loader2Icon } from "lucide-react";
import { Dashboard } from "@/components/dashboard";
import { LoginScreen } from "@/components/login";
import { useMe } from "@/hooks/use-api";

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
    return (
      <div className="grid min-h-svh place-items-center p-6 text-sm text-destructive">
        无法连接服务：{me.error.message}
      </div>
    );
  }
  return me.data.authenticated ? <Dashboard /> : <LoginScreen configured={me.data.configured} />;
}
