import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErpLayout, HudButton, HudField, HudInput, HudPanel, HudSelect, PageHeader } from "@/components/erp-layout";
import { Modal } from "./products";
import { useERP, type Bom, type BomComponent, type BomOperation } from "@/lib/erp-store";

export const Route = createFileRoute("/bom")({
  head: () => ({ meta: [{ title: "Bill of Materials — Shiv ERP" }] }),
  component: BomPage,
});

function BomPage() {
  const boms = useERP((s) => s.boms);
  const products = useERP((s) => s.products);
  const save = useERP((s) => s.upsertBom);
  const del = useERP((s) => s.deleteBom);
  const [editing, setEditing] = useState<Partial<Bom> | null>(null);

  return (
    <ErpLayout>
      <PageHeader
        title="Bill of Materials"
        subtitle="Define components, quantities and operations needed to manufacture a product."
        actions={<HudButton onClick={() => setEditing({ name: "", outputQty: 1, components: [], operations: [] })}>+ New BoM</HudButton>}
      />

      <div className="grid md:grid-cols-2 gap-4">
        {boms.map((b) => {
          const product = products.find((p) => p.id === b.productId);
          return (
            <HudPanel key={b.id}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="hud-label">BoM</div>
                  <h3 className="text-lg font-bold text-[color:var(--hud-cyan)]">{b.name}</h3>
                  <div className="text-xs text-muted-foreground">→ {product?.name ?? "—"} × {b.outputQty}</div>
                </div>
                <div className="space-x-2">
                  <button onClick={() => setEditing(b)} className="text-[10px] uppercase text-[color:var(--hud-cyan)]">Edit</button>
                  <button onClick={() => confirm("Delete?") && del(b.id)} className="text-[10px] uppercase text-[color:var(--hud-red)]">Del</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="hud-label mb-1">Components</div>
                  <ul className="text-xs space-y-1">
                    {b.components.map((c, i) => (
                      <li key={i} className="flex justify-between border-b border-border/40 pb-1">
                        <span>{products.find((p) => p.id === c.productId)?.name ?? "?"}</span>
                        <span className="text-[color:var(--hud-amber)]">× {c.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="hud-label mb-1">Operations</div>
                  <ul className="text-xs space-y-1">
                    {b.operations.map((o, i) => (
                      <li key={i} className="border-b border-border/40 pb-1">
                        <div>{o.name}</div>
                        <div className="text-[10px] text-muted-foreground">{o.workCenter} · {o.durationMin}m</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </HudPanel>
          );
        })}
        {boms.length === 0 && <HudPanel className="md:col-span-2 text-center text-muted-foreground text-sm">No BoMs yet.</HudPanel>}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? "Edit BoM" : "New BoM"}>
          <BomForm bom={editing} onChange={setEditing} products={products} onCancel={() => setEditing(null)} onSubmit={() => { save(editing); setEditing(null); }} />
        </Modal>
      )}
    </ErpLayout>
  );
}

function BomForm({ bom, onChange, products, onSubmit, onCancel }: { bom: Partial<Bom>; onChange: (b: Partial<Bom>) => void; products: ReturnType<typeof useERP.getState>["products"]; onSubmit: () => void; onCancel: () => void }) {
  const comps = bom.components ?? [];
  const ops = bom.operations ?? [];
  const setComp = (i: number, patch: Partial<BomComponent>) => onChange({ ...bom, components: comps.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const addComp = () => onChange({ ...bom, components: [...comps, { productId: products[0]?.id ?? "", quantity: 1 }] });
  const delComp = (i: number) => onChange({ ...bom, components: comps.filter((_, idx) => idx !== i) });
  const setOp = (i: number, patch: Partial<BomOperation>) => onChange({ ...bom, operations: ops.map((o, idx) => idx === i ? { ...o, ...patch } : o) });
  const addOp = () => onChange({ ...bom, operations: [...ops, { name: "", workCenter: "", durationMin: 30 }] });
  const delOp = (i: number) => onChange({ ...bom, operations: ops.filter((_, idx) => idx !== i) });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2"><HudField label="BoM Name"><HudInput required value={bom.name ?? ""} onChange={(e) => onChange({ ...bom, name: e.target.value })} /></HudField></div>
        <HudField label="Output Qty"><HudInput type="number" min={1} value={bom.outputQty ?? 1} onChange={(e) => onChange({ ...bom, outputQty: Number(e.target.value) })} /></HudField>
        <div className="col-span-3"><HudField label="Finished Product">
          <HudSelect required value={bom.productId ?? ""} onChange={(e) => onChange({ ...bom, productId: e.target.value })}>
            <option value="">— select —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </HudSelect>
        </HudField></div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2"><div className="hud-label">// Components</div><HudButton variant="ghost" onClick={addComp}>+ Component</HudButton></div>
        <table className="w-full text-xs">
          <tbody>
            {comps.map((c, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="py-1 pr-2 w-2/3">
                  <HudSelect value={c.productId} onChange={(e) => setComp(i, { productId: e.target.value })}>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </HudSelect>
                </td>
                <td className="pr-2"><HudInput type="number" min={1} value={c.quantity} onChange={(e) => setComp(i, { quantity: Number(e.target.value) })} /></td>
                <td><button type="button" onClick={() => delComp(i)} className="text-[color:var(--hud-red)] text-lg">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2"><div className="hud-label">// Operations</div><HudButton variant="ghost" onClick={addOp}>+ Operation</HudButton></div>
        <table className="w-full text-xs">
          <tbody>
            {ops.map((o, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="py-1 pr-2"><HudInput placeholder="Operation" value={o.name} onChange={(e) => setOp(i, { name: e.target.value })} /></td>
                <td className="pr-2"><HudInput placeholder="Work Center" value={o.workCenter} onChange={(e) => setOp(i, { workCenter: e.target.value })} /></td>
                <td className="pr-2 w-24"><HudInput type="number" value={o.durationMin} onChange={(e) => setOp(i, { durationMin: Number(e.target.value) })} /></td>
                <td><button type="button" onClick={() => delOp(i)} className="text-[color:var(--hud-red)] text-lg">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <HudButton variant="ghost" onClick={onCancel}>Cancel</HudButton>
        <HudButton type="submit">Save</HudButton>
      </div>
    </form>
  );
}
