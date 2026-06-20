import { createFileRoute } from "@tanstack/react-router";
import { ErpLayout, HudPanel, PageHeader } from "@/components/erp-layout";
import { useERP } from "@/lib/erp-store";

export const Route = createFileRoute("/audit")({
  head: () => ({ meta: [{ title: "Audit Logs — Shiv ERP" }] }),
  component: AuditPage,
});

function AuditPage() {
  const audit = useERP((s) => s.audit);

  return (
    <ErpLayout>
      <PageHeader title="Audit Logs" subtitle="Full traceability of every status change, creation and consumption event." />
      <HudPanel>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr><th className="py-2">Timestamp</th><th>Module</th><th>Action</th><th>Reference</th></tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id} className="border-t border-border/60">
                <td className="py-2 text-muted-foreground">{new Date(a.date).toLocaleString()}</td>
                <td className="text-[color:var(--hud-cyan)]">[{a.module}]</td>
                <td>{a.action}</td>
                <td className="text-muted-foreground">{a.ref ?? "—"}</td>
              </tr>
            ))}
            {audit.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No events yet.</td></tr>}
          </tbody>
        </table>
      </HudPanel>
    </ErpLayout>
  );
}
