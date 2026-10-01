import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";

/** Platform admin area. Admins are added in SQL: insert into platform_admins (user_id) values (...). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/admin");
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("am_platform_admin");
  if (!isAdmin) notFound();
  return (
    <SimpleShell admin>
      <nav aria-label="Admin" className="mb-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {[["/admin/control", "Control"], ["/pilots", "Pilots"], ["/admin/evidence", "Evidence"], ["/admin/changes", "Approvals"], ["/admin/jobs", "Jobs"], ["/admin/messages", "Messages"], ["/admin/payments", "Payments"], ["/admin/fx", "FX"], ["/admin/certification", "Certification"], ["/admin/scale", "Scale"], ["/admin/commercial", "Commercial"], ["/admin/channels", "Channels"], ["/admin/retention", "Retention"], ["/admin/trust", "Trust"], ["/admin/partners", "Partners"], ["/admin/policies", "Policies"], ["/admin/experiments", "Experiments"], ["/admin/packs", "Packs"], ["/admin/solutions", "Solutions"], ["/admin/learning", "Learning"], ["/admin/intelligence", "Intelligence"], ["/admin/data", "Data"], ["/admin/markets", "Markets"]].map(([href, label]) => (
          <a key={href} href={href} className="font-medium text-muted-foreground hover:text-foreground">{label}</a>
        ))}
      </nav>
      {children}
    </SimpleShell>
  );
}
