import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErpLayout, HudButton, HudField, HudInput, HudPanel, HudSelect, PageHeader, StatusBadge } from "@/components/erp-layout";
import { Modal } from "./products";
import { useERP, type ManufacturingOrder } from "@/lib/erp-store";

export const Route = createFileRoute("/manufacturing")({
  head: () => ({ meta: [{ title: "Manufacturing — Shiv ERP" }] }),
  component: ManufPage,
});

function ManufPage() {
  const mos = useERP((s) => s.mos);
  const products = useERP((s) => s.products);
  const boms = useERP((s) => s.boms);
  const save = useERP((s) => s.saveMO);
  const confirmMO = useERP((s) => s.confirmMO);
  const startWO = useERP((s) => s.startWO);
  const finishWO = useERP((s) => s.finishWO);
  const completeMO = useERP((s) => s.completeMO);
  const cancelMO = useERP((s) => s.cancelMO);
  const [editing, setEditing] = useState<Partial<ManufacturingOrder> | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  const viewMO = mos.find((m) => m.id === viewing);

  return (
    <ErpLayout>
      <PageHeader
        title="Manufacturing"
        subtitle="Convert raw materials into finished goods via BoMs and work orders."
        actions={<HudButton onClick={() => setEditing({ quantity: 1 })}>+ New MO</HudButton>}
      />

      <HudPanel>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr><th className="py-2">Reference</th><th>Product</th><th>Qty</th><th>Assignee</th><th>Date</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {mos.map((m) => {
              const prod = products.find((p) => p.id === m.productId);
              return (
                <tr key={m.id} className="border-t border-border/60 hover:bg-accent/20 cursor-pointer" onClick={() => setViewing(m.id)}>
                  <td className="py-2 text-[color:var(--hud-cyan)]">{m.reference}</td>
                  <td>{prod?.name ?? "—"}</td>
                  <td>{m.quantity}</td>
                  <td className="text-muted-foreground">{m.assignee ?? "—"}</td>
                  <td className="text-muted-foreground">{new Date(m.date).toLocaleDateString()}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td className="text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {m.status === "draft" && <button onClick={() => setEditing(m)} className="text-[10px] uppercase text-[color:var(--hud-cyan)] hover:underline">Edit</button>}
                    {m.status === "draft" && <button onClick={() => confirmMO(m.id)} className="text-[10px] uppercase text-[color:var(--hud-amber)] hover:underline">Confirm</button>}
                    {m.status === "confirmed" && <button onClick={() => completeMO(m.id)} className="text-[10px] uppercase text-[color:var(--hud-green)] hover:underline">Complete</button>}
                    {m.status !== "done" && m.status !== "cancelled" && <button onClick={() => cancelMO(m.id)} className="text-[10px] uppercase text-[color:var(--hud-red)] hover:underline">Cancel</button>}
                  </td>
                </tr>
              );
            })}
            {mos.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No manufacturing orders.</td></tr>}
          </tbody>
        </table>
      </HudPanel>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? `Edit ${editing.reference}` : "New Manufacturing Order"}>
          <form onSubmit={(e) => { e.preventDefault(); save(editing); setEditing(null); }} className="grid grid-cols-2 gap-4">
            <HudField label="Finished Product">
              <HudSelect required value={editing.productId ?? ""} onChange={(e) => {
                const pid = e.target.value;
                const prod = products.find((p) => p.id === pid);
                setEditing({ ...editing, productId: pid, bomId: prod?.bomId });
              }}>
                <option value="">— select —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </HudSelect>
            </HudField>
            <HudField label="Quantity"><HudInput type="number" min={1} value={editing.quantity ?? 1} onChange={(e) => setEditing({ ...editing, quantity: Number(e.target.value) })} /></HudField>
            <HudField label="Bill of Materials">
              <HudSelect value={editing.bomId ?? ""} onChange={(e) => setEditing({ ...editing, bomId: e.target.value || undefined })}>
                <option value="">—</option>
                {boms.filter((b) => !editing.productId || b.productId === editing.productId).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </HudSelect>
            </HudField>
            <HudField label="Assignee"><HudInput value={editing.assignee ?? ""} onChange={(e) => setEditing({ ...editing, assignee: e.target.value })} /></HudField>
            <div className="col-span-2 flex justify-end gap-2 pt-3 border-t border-border">
              <HudButton variant="ghost" onClick={() => setEditing(null)}>Cancel</HudButton>
              <HudButton type="submit">Save Draft</HudButton>
            </div>
          </form>
        </Modal>
      )}

      {viewMO && (
        <Modal onClose={() => setViewing(null)} title={`${viewMO.reference} · ${products.find((p) => p.id === viewMO.productId)?.name ?? ""}`}>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="hud-label mb-2">// Components (planned consumption)</div>
              <table className="w-full text-xs">
                <thead className="text-muted-foreground text-left"><tr><th>Material</th><th className="text-right">Required</th><th className="text-right">Available</th></tr></thead>
                <tbody>
                  {viewMO.consumedComponents.map((c, i) => {
                    const p = products.find((x) => x.id === c.productId);
                    const free = p ? p.onHand - p.reserved : 0;
                    return (
                      <tr key={i} className="border-t border-border/60">
                        <td className="py-1">{p?.name ?? c.productId}</td>
                        <td className="text-right">{c.quantity}</td>
                        <td className={`text-right ${free < c.quantity ? "text-[color:var(--hud-red)]" : "text-[color:var(--hud-green)]"}`}>{free}</td>
                      </tr>
                    );
                  })}
                  {viewMO.consumedComponents.length === 0 && <tr><td colSpan={3} className="py-3 text-center text-muted-foreground">No BoM linked.</td></tr>}
                </tbody>
              </table>
            </div>
            <div>
              <div className="hud-label mb-2">// Work Orders</div>
              <div className="space-y-2">
                {viewMO.workOrders.map((w) => (
                  <div key={w.id} className="border border-border p-2 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold">{w.name}</div>
                      <div className="text-muted-foreground text-[10px]">{w.workCenter} · {w.durationMin}m</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={w.status} />
                      {viewMO.status === "confirmed" && w.status === "todo" && <button onClick={() => startWO(viewMO.id, w.id)} className="text-[10px] uppercase text-[color:var(--hud-amber)]">Start</button>}
                      {viewMO.status === "confirmed" && w.status === "in_progress" && <button onClick={() => finishWO(viewMO.id, w.id)} className="text-[10px] uppercase text-[color:var(--hud-green)]">Finish</button>}
                    </div>
                  </div>
                ))}
                {viewMO.workOrders.length === 0 && <div className="text-muted-foreground text-xs">No work orders.</div>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </ErpLayout>
  );
}
