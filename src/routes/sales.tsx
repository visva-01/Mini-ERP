import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErpLayout, HudButton, HudField, HudInput, HudPanel, HudSelect, PageHeader, StatusBadge } from "@/components/erp-layout";
import { Modal } from "./products";
import { useERP, type SalesOrder, type SOLine } from "@/lib/erp-store";

export const Route = createFileRoute("/sales")({
  head: () => ({ meta: [{ title: "Sales Orders — Shiv ERP" }] }),
  component: SalesPage,
});

const blank = (): Partial<SalesOrder> => ({ customer: "", lines: [] });

function SalesPage() {
  const sales = useERP((s) => s.sales);
  const products = useERP((s) => s.products);
  const save = useERP((s) => s.saveSO);
  const confirm = useERP((s) => s.confirmSO);
  const deliver = useERP((s) => s.deliverSO);
  const cancel = useERP((s) => s.cancelSO);
  const [editing, setEditing] = useState<Partial<SalesOrder> | null>(null);

  return (
    <ErpLayout>
      <PageHeader
        title="Sales Orders"
        subtitle="Capture demand. Confirm to reserve stock. Auto-trigger procurement on shortage."
        actions={<HudButton onClick={() => setEditing(blank())}>+ New SO</HudButton>}
      />

      <HudPanel>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr><th className="py-2">Reference</th><th>Customer</th><th>Date</th><th>Lines</th><th>Total</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {sales.map((s) => {
              const total = s.lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
              return (
                <tr key={s.id} className="border-t border-border/60 hover:bg-accent/20">
                  <td className="py-2 text-[color:var(--hud-cyan)]">{s.reference}</td>
                  <td>{s.customer}</td>
                  <td className="text-muted-foreground">{new Date(s.date).toLocaleDateString()}</td>
                  <td>{s.lines.length}</td>
                  <td>₹{total.toFixed(2)}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td className="text-right space-x-2 whitespace-nowrap">
                    {s.status === "draft" && <button onClick={() => setEditing(s)} className="text-[10px] uppercase text-[color:var(--hud-cyan)] hover:underline">Edit</button>}
                    {s.status === "draft" && <button onClick={() => confirm(s.id)} className="text-[10px] uppercase text-[color:var(--hud-amber)] hover:underline">Confirm</button>}
                    {(s.status === "confirmed" || s.status === "partial") && <button onClick={() => deliver(s.id)} className="text-[10px] uppercase text-[color:var(--hud-green)] hover:underline">Deliver</button>}
                    {s.status !== "done" && s.status !== "cancelled" && <button onClick={() => cancel(s.id)} className="text-[10px] uppercase text-[color:var(--hud-red)] hover:underline">Cancel</button>}
                  </td>
                </tr>
              );
            })}
            {sales.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No sales orders.</td></tr>}
          </tbody>
        </table>
      </HudPanel>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? `Edit ${editing.reference}` : "New Sales Order"}>
          <OrderForm
            order={editing}
            products={products}
            onChange={setEditing}
            onSubmit={() => { save(editing); setEditing(null); }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </ErpLayout>
  );
}

function OrderForm({
  order, products, onChange, onSubmit, onCancel,
}: {
  order: Partial<SalesOrder>;
  products: ReturnType<typeof useERP.getState>["products"];
  onChange: (o: Partial<SalesOrder>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const lines = order.lines ?? [];
  const setLine = (i: number, patch: Partial<SOLine>) => {
    const next = lines.map((l, idx) => idx === i ? { ...l, ...patch } : l);
    onChange({ ...order, lines: next });
  };
  const addLine = () => onChange({ ...order, lines: [...lines, { productId: products[0]?.id ?? "", quantity: 1, delivered: 0, unitPrice: products[0]?.salesPrice ?? 0 }] });
  const removeLine = (i: number) => onChange({ ...order, lines: lines.filter((_, idx) => idx !== i) });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <HudField label="Customer">
        <HudInput required value={order.customer ?? ""} onChange={(e) => onChange({ ...order, customer: e.target.value })} />
      </HudField>

      <div>
        <div className="flex justify-between items-center mb-2">
          <div className="hud-label">// Order Lines</div>
          <HudButton variant="ghost" onClick={addLine}>+ Line</HudButton>
        </div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr><th>Product</th><th>Available</th><th>Qty</th><th>Unit</th><th>Subtotal</th><th /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId);
              const free = p ? p.onHand - p.reserved : 0;
              return (
                <tr key={i} className="border-t border-border/60">
                  <td className="py-2 pr-2">
                    <HudSelect value={l.productId} onChange={(e) => {
                      const np = products.find((x) => x.id === e.target.value);
                      setLine(i, { productId: e.target.value, unitPrice: np?.salesPrice ?? 0 });
                    }}>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </HudSelect>
                  </td>
                  <td className={`pr-2 ${free < l.quantity ? "text-[color:var(--hud-red)]" : "text-[color:var(--hud-green)]"}`}>{free}</td>
                  <td className="pr-2"><HudInput type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></td>
                  <td className="pr-2"><HudInput type="number" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} /></td>
                  <td>₹{(l.quantity * l.unitPrice).toFixed(2)}</td>
                  <td><button type="button" onClick={() => removeLine(i)} className="text-[color:var(--hud-red)] text-lg leading-none">×</button></td>
                </tr>
              );
            })}
            {lines.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No lines. Add one.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="text-right text-sm">
        Total: <span className="text-[color:var(--hud-cyan)] text-lg ml-2">₹{lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0).toFixed(2)}</span>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <HudButton variant="ghost" onClick={onCancel}>Cancel</HudButton>
        <HudButton type="submit">Save Draft</HudButton>
      </div>
    </form>
  );
}
