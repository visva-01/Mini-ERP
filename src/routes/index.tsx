import { createFileRoute, Link } from "@tanstack/react-router";
import { ErpLayout, HudPanel, PageHeader, StatusBadge } from "@/components/erp-layout";
import { useERP } from "@/lib/erp-store";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — Shiv ERP" }] }),
  component: Dashboard,
});

function Stat({ label, value, accent, hint }: { label: string; value: string | number; accent: string; hint?: string }) {
  return (
    <HudPanel>
      <div className="hud-label">{label}</div>
      <div className={`text-4xl font-bold mt-2 ${accent} hud-text-glow`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-2 tracking-wider">{hint}</div>}
    </HudPanel>
  );
}

function Dashboard() {
  const sales = useERP((s) => s.sales);
  const purchases = useERP((s) => s.purchases);
  const mos = useERP((s) => s.mos);
  const products = useERP((s) => s.products);
  const audit = useERP((s) => s.audit);

  const pendingDeliv = sales.filter((s) => s.status === "confirmed" || s.status === "partial").length;
  const partialReceipts = purchases.filter((p) => p.status === "partial" || p.status === "confirmed").length;
  const moActive = mos.filter((m) => m.status !== "done" && m.status !== "cancelled").length;
  const delayed = sales.filter((s) => s.status === "partial").length;
  const lowStock = products.filter((p) => p.onHand - p.reserved <= 5).length;

  return (
    <ErpLayout>
      <PageHeader title="Mission Control" subtitle="Real-time operational telemetry across all modules." />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Sales Orders" value={sales.length} accent="text-[color:var(--hud-cyan)]" hint={`${pendingDeliv} pending`} />
        <Stat label="Purchase Orders" value={purchases.length} accent="text-[color:var(--hud-amber)]" hint={`${partialReceipts} open`} />
        <Stat label="MO Active" value={moActive} accent="text-[color:var(--hud-magenta)]" hint={`${mos.length} total`} />
        <Stat label="Pending Deliv." value={pendingDeliv} accent="text-[color:var(--hud-green)]" />
        <Stat label="Delayed" value={delayed} accent="text-[color:var(--hud-red)]" hint="partial dispatch" />
        <Stat label="Low Stock SKUs" value={lowStock} accent="text-[color:var(--hud-amber)]" hint="free ≤ 5" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <HudPanel className="lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <div className="hud-label">// Inventory Snapshot</div>
            <Link to="/products" className="text-[10px] uppercase tracking-widest text-[color:var(--hud-cyan)] hover:underline">View all →</Link>
          </div>
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2">Product</th>
                <th className="text-right">On Hand</th>
                <th className="text-right">Reserved</th>
                <th className="text-right">Free</th>
                <th className="text-right">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 8).map((p) => {
                const free = p.onHand - p.reserved;
                return (
                  <tr key={p.id} className="border-t border-border/60">
                    <td className="py-2">{p.name}</td>
                    <td className="text-right">{p.onHand}</td>
                    <td className="text-right text-[color:var(--hud-amber)]">{p.reserved}</td>
                    <td className={`text-right ${free <= 5 ? "text-[color:var(--hud-red)]" : "text-[color:var(--hud-green)]"}`}>{free}</td>
                    <td className="text-right text-muted-foreground uppercase text-[10px]">{p.procureOnDemand ? p.procurementType : "MTS"}</td>
                  </tr>
                );
              })}
              {products.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No products.</td></tr>}
            </tbody>
          </table>
        </HudPanel>

        <HudPanel>
          <div className="hud-label mb-3">// Audit Stream</div>
          <ul className="space-y-2 text-xs max-h-80 overflow-y-auto pr-1">
            {audit.slice(0, 14).map((a) => (
              <li key={a.id} className="flex items-start gap-2 border-l-2 border-[color:var(--hud-cyan)]/40 pl-2">
                <span className="text-[9px] text-muted-foreground w-20 shrink-0">{new Date(a.date).toLocaleTimeString()}</span>
                <span>
                  <span className="text-[color:var(--hud-cyan)]">[{a.module}]</span> {a.action} {a.ref && <span className="text-muted-foreground">· {a.ref}</span>}
                </span>
              </li>
            ))}
            {audit.length === 0 && <li className="text-muted-foreground">No events.</li>}
          </ul>
        </HudPanel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        <HudPanel>
          <div className="hud-label mb-3">// Recent Sales</div>
          {sales.slice(0, 5).map((s) => (
            <div key={s.id} className="flex justify-between items-center text-xs py-1 border-b border-border/40 last:border-0">
              <span>{s.reference}</span><span className="text-muted-foreground">{s.customer}</span><StatusBadge status={s.status} />
            </div>
          ))}
          {sales.length === 0 && <div className="text-muted-foreground text-xs">No sales.</div>}
        </HudPanel>
        <HudPanel>
          <div className="hud-label mb-3">// Recent Purchases</div>
          {purchases.slice(0, 5).map((s) => (
            <div key={s.id} className="flex justify-between items-center text-xs py-1 border-b border-border/40 last:border-0">
              <span>{s.reference}</span><span className="text-muted-foreground">{s.vendor}</span><StatusBadge status={s.status} />
            </div>
          ))}
          {purchases.length === 0 && <div className="text-muted-foreground text-xs">No purchases.</div>}
        </HudPanel>
        <HudPanel>
          <div className="hud-label mb-3">// Manufacturing Queue</div>
          {mos.slice(0, 5).map((m) => (
            <div key={m.id} className="flex justify-between items-center text-xs py-1 border-b border-border/40 last:border-0">
              <span>{m.reference}</span><span className="text-muted-foreground">×{m.quantity}</span><StatusBadge status={m.status} />
            </div>
          ))}
          {mos.length === 0 && <div className="text-muted-foreground text-xs">No orders.</div>}
        </HudPanel>
      </div>
    </ErpLayout>
  );
}
