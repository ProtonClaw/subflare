import { PageHeader, Panel } from "@/components/kit";
import { PullLogList } from "@/components/pull-log-list";
import { useSubscriptions } from "@/hooks/use-api";

export function PullLogsPage() {
  const subs = useSubscriptions();
  return (
    <>
      <PageHeader
        title="拉取记录"
        description="每次客户端拉取订阅的时间、IP、地区和客户端，保留 90 天。重置链接后，旧链接的拉取也会记录在这里。"
      />
      <Panel className="max-w-5xl">
        <PullLogList subscriptions={subs.data?.map(({ id, name }) => ({ id, name })) ?? []} />
      </Panel>
    </>
  );
}
