import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErpLayout, HudButton, HudField, HudInput, HudPanel, HudSelect, PageHeader, StatusBadge } from "@/components/erp-layout";
import { Modal } from "./products";
import { useERP, type POLine, type PurchaseOrder } from "@/lib/erp-store";

export const Route = createFileRoute("/purchase")({
  head: () => ({ meta: [{ title: "Purchase Orders — Shiv ERP" }] }),
  component: PurchasePage,
});

function PurchasePage() {
  const purchases = useERP((s) => s.purchases);
  const products = useERP((s) => s.products);
  const save = useERP((s) => s.savePO);
  const confirm = useERP((s) => s.confirmPO);
  const receive = useERP((s) => s.receivePO);
  const cancel = useERP((s) => s.cancelPO);
  const [editing, setEditing] = useState<Partial<PurchaseOrder> | null>(null);

  return (
    <ErpLayout>
      <PageHeader
        title="Purchase Orders"
        subtitle="Replenish stock. Receive goods. Stock ledger updates automatically."
        actions={<HudButton onClick={() => setEditing({ vendor: "", lines: [] })}>+ New PO</HudButton>}
      />

      <HudPanel>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr><th className="py-2">Reference</th><th>Vendor</th><th>Date</th><th>Lines</th><th>Total</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const total = p.lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
              return (
                <tr key={p.id} className="border-t border-border/60 hover:bg-accent/20">
                  <td className="py-2 text-[color:var(--hud-cyan)]">{p.reference}</td>
                  <td>{p.vendor}</td>
                  <td className="text-muted-foreground">{new Date(p.date).toLocaleDateString()}</td>
                  <td>{p.lines.length}</td>
                  <td>₹{total.toFixed(2)}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    {p.status === "draft" && <button onClick={() => setEditing(p)} className="text-[10px] uppercase text-[color:var(--hud-cyan)] hover:underline">Edit</button>}
                    {p.status === "draft" && <button onClick={() => confirm(p.id)} className="text-[10px] uppercase text-[color:var(--hud-amber)] hover:underline">Confirm</button>}
                    {p.status === "confirmed" && <button onClick={() => receive(p.id)} className="text-[10px] uppercase text-[color:var(--hud-green)] hover:underline">Receive</button>}
                    {p.status !== "done" && p.status !== "cancelled" && <button onClick={() => cancel(p.id)} className="text-[10px] uppercase text-[color:var(--hud-red)] hover:underline">Cancel</button>}
                  </td>
                </tr>
              );
            })}
            {purchases.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No purchase orders.</td></tr>}
          </tbody>
        </table>
      </HudPanel>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? `Edit ${editing.reference}` : "New Purchase Order"}>
          <POForm order={editing} products={products} onChange={setEditing} onCancel={() => setEditing(null)} onSubmit={() => { save(editing); setEditing(null); }} />
        </Modal>
      )}
    </ErpLayout>
  );
}

function POForm({ order, products, onChange, onSubmit, onCancel }: { order: Partial<PurchaseOrder>; products: ReturnType<typeof useERP.getState>["products"]; onChange: (o: Partial<PurchaseOrder>) => void; onSubmit: () => void; onCancel: () => void }) {
  const lines = order.lines ?? [];
  const setLine = (i: number, patch: Partial<POLine>) => onChange({ ...order, lines: lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) });
  const addLine = () => onChange({ ...order, lines: [...lines, { productId: products[0]?.id ?? "", quantity: 1, received: 0, unitPrice: products[0]?.costPrice ?? 0 }] });
  const removeLine = (i: number) => onChange({ ...order, lines: lines.filter((_, idx) => idx !== i) });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <HudField label="Vendor"><HudInput required value={order.vendor ?? ""} onChange={(e) => onChange({ ...order, vendor: e.target.value })} /></HudField>
      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="hud-label">// Order Lines</div>
          <HudButton variant="ghost" onClick={addLine}>+ Line</HudButton>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left"><tr><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Subtotal</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="py-2 pr-2">
                  <HudSelect value={l.productId} onChange={(e) => {
                    const np = products.find((x) => x.id === e.target.value);
                    setLine(i, { productId: e.target.value, unitPrice: np?.costPrice ?? 0 });
                  }}>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </HudSelect>
                </td>
                <td className="pr-2"><HudInput type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></td>
                <td className="pr-2"><HudInput type="number" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} /></td>
                <td>₹{(l.quantity * l.unitPrice).toFixed(2)}</td>
                <td><button type="button" onClick={() => removeLine(i)} className="text-[color:var(--hud-red)] text-lg leading-none">×</button></td>
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">No lines.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="text-right text-sm">Total: <span className="text-[color:var(--hud-cyan)] text-lg ml-2">₹{lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0).toFixed(2)}</span></div>
      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <HudButton variant="ghost" onClick={onCancel}>Cancel</HudButton>
        <HudButton type="submit">Save Draft</HudButton>
      </div>
    </form>
  );
}
