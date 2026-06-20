import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErpLayout, HudButton, HudField, HudInput, HudPanel, HudSelect, PageHeader } from "@/components/erp-layout";
import { useERP, type Product, type ProcurementType } from "@/lib/erp-store";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "Products — Shiv ERP" }] }),
  component: ProductsPage,
});

const empty = (): Partial<Product> => ({
  name: "", salesPrice: 0, costPrice: 0, onHand: 0, reserved: 0,
  procureOnDemand: false, procurementType: "purchase" as ProcurementType,
});

function ProductsPage() {
  const products = useERP((s) => s.products);
  const boms = useERP((s) => s.boms);
  const upsert = useERP((s) => s.upsertProduct);
  const del = useERP((s) => s.deleteProduct);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [q, setQ] = useState("");

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ErpLayout>
      <PageHeader
        title="Products"
        subtitle="Central inventory model. Each SKU drives stock, sales, purchase and manufacturing."
        actions={<HudButton onClick={() => setEditing(empty())}>+ New Product</HudButton>}
      />

      <HudPanel className="mb-4">
        <HudInput placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
      </HudPanel>

      <HudPanel>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="text-left">
              <th className="py-2">Name</th>
              <th className="text-right">Sales</th>
              <th className="text-right">Cost</th>
              <th className="text-right">On Hand</th>
              <th className="text-right">Reserved</th>
              <th className="text-right">Free</th>
              <th>Strategy</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const free = p.onHand - p.reserved;
              return (
                <tr key={p.id} className="border-t border-border/60 hover:bg-accent/20">
                  <td className="py-2">{p.name}</td>
                  <td className="text-right">₹{p.salesPrice}</td>
                  <td className="text-right text-muted-foreground">₹{p.costPrice}</td>
                  <td className="text-right">{p.onHand}</td>
                  <td className="text-right text-[color:var(--hud-amber)]">{p.reserved}</td>
                  <td className={`text-right ${free <= 5 ? "text-[color:var(--hud-red)]" : "text-[color:var(--hud-green)]"}`}>{free}</td>
                  <td className="text-[10px] uppercase tracking-widest">
                    {p.procureOnDemand ? (
                      <span className="text-[color:var(--hud-cyan)]">MTO · {p.procurementType}</span>
                    ) : (
                      <span className="text-muted-foreground">MTS</span>
                    )}
                  </td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    <button onClick={() => setEditing(p)} className="text-[10px] uppercase tracking-widest text-[color:var(--hud-cyan)] hover:underline">Edit</button>
                    <button onClick={() => confirm("Delete?") && del(p.id)} className="text-[10px] uppercase tracking-widest text-[color:var(--hud-red)] hover:underline">Del</button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No products.</td></tr>}
          </tbody>
        </table>
      </HudPanel>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit Product" : "New Product"}>
          <form
            onSubmit={(e) => { e.preventDefault(); upsert(editing); setEditing(null); }}
            className="grid grid-cols-2 gap-4"
          >
            <div className="col-span-2"><HudField label="Name"><HudInput required value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></HudField></div>
            <HudField label="Sales Price"><HudInput type="number" step="0.01" value={editing.salesPrice ?? 0} onChange={(e) => setEditing({ ...editing, salesPrice: Number(e.target.value) })} /></HudField>
            <HudField label="Cost Price"><HudInput type="number" step="0.01" value={editing.costPrice ?? 0} onChange={(e) => setEditing({ ...editing, costPrice: Number(e.target.value) })} /></HudField>
            <HudField label="On Hand Qty"><HudInput type="number" value={editing.onHand ?? 0} onChange={(e) => setEditing({ ...editing, onHand: Number(e.target.value) })} /></HudField>
            <HudField label="Reserved Qty"><HudInput type="number" value={editing.reserved ?? 0} onChange={(e) => setEditing({ ...editing, reserved: Number(e.target.value) })} /></HudField>

            <div className="col-span-2 mt-2 border-t border-border pt-3">
              <div className="hud-label mb-2">// Procurement</div>
              <label className="flex items-center gap-2 text-xs mb-3">
                <input type="checkbox" checked={!!editing.procureOnDemand} onChange={(e) => setEditing({ ...editing, procureOnDemand: e.target.checked })} />
                <span>Procure on demand (MTO) — auto trigger PO / MO when stock insufficient</span>
              </label>
            </div>
            <HudField label="Procurement Type">
              <HudSelect value={editing.procurementType ?? "purchase"} onChange={(e) => setEditing({ ...editing, procurementType: e.target.value as ProcurementType })}>
                <option value="purchase">Purchase</option>
                <option value="manufacturing">Manufacturing</option>
              </HudSelect>
            </HudField>
            {editing.procurementType === "purchase" ? (
              <HudField label="Default Vendor"><HudInput value={editing.vendor ?? ""} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} /></HudField>
            ) : (
              <HudField label="Bill of Materials">
                <HudSelect value={editing.bomId ?? ""} onChange={(e) => setEditing({ ...editing, bomId: e.target.value || undefined })}>
                  <option value="">—</option>
                  {boms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </HudSelect>
              </HudField>
            )}

            <div className="col-span-2 flex justify-end gap-2 mt-3">
              <HudButton variant="ghost" onClick={() => setEditing(null)}>Cancel</HudButton>
              <HudButton type="submit">Save</HudButton>
            </div>
          </form>
        </Modal>
      )}
    </ErpLayout>
  );
}

export function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="hud-panel hud-glow max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-border">
          <h3 className="text-lg font-bold tracking-widest uppercase text-[color:var(--hud-cyan)] hud-text-glow">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-[color:var(--hud-red)] text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
