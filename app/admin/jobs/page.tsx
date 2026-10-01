import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { requeueJob } from "../actions";

export const metadata: Metadata = { title: "Jobs" };

type O = { by_type: { type: string; queued: number; running: number; succeeded: number; failed_retrying: number; dead: number; avg_attempts: number }[];
  dead: { id: string; type: string; attempts: number; last_error: string | null; at: string }[]; deliveries: Record<string, number> };

export default async function JobsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("job_overview", { p_hours: 24 });
  const o = data as unknown as O;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Jobs and failures" description="Every background task with its retries. Dead jobs keep their last error and can be requeued (audited)." />
      <Card className="mb-6" aria-label="Jobs by type">
        <CardHeader><CardTitle>Last 24 hours</CardTitle><CardDescription>Webhook deliveries failed: {o.deliveries.webhooks_failed_24h}</CardDescription></CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Type</th><th>Queued</th><th>Running</th><th>Done</th><th>Retrying</th><th>Dead</th><th>Avg attempts</th></tr></thead>
          <tbody>{o.by_type.map((t) => <tr key={t.type}><td>{t.type}</td><td>{t.queued}</td><td>{t.running}</td><td>{t.succeeded}</td><td>{t.failed_retrying}</td><td>{t.dead}</td><td>{t.avg_attempts}</td></tr>)}</tbody></table>
      </Card>
      <Card aria-label="Dead jobs">
        <CardHeader><CardTitle>Dead jobs</CardTitle></CardHeader>
        <ul className="divide-y text-sm">{o.dead.map((j) => (
          <li key={j.id} className="flex flex-wrap items-center gap-2 py-2" aria-label={`Dead job ${j.type}`}>
            <span className="flex-1">{j.type} · {j.attempts} attempts · {formatDate(j.at)}<span className="block text-xs text-muted-foreground">{j.last_error}</span></span>
            <form action={requeueJob}><input type="hidden" name="id" value={j.id} /><Button size="sm" variant="outline">Requeue</Button></form>
          </li>))}
          {!o.dead.length && <li className="py-2 text-muted-foreground">None.</li>}</ul>
      </Card>
    </>
  );
}
