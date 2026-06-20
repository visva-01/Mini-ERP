import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ID = string;
export const uid = () => Math.random().toString(36).slice(2, 10);
export const now = () => new Date().toISOString();

export type ProcurementType = "purchase" | "manufacturing";

export interface Product {
  id: ID;
  name: string;
  salesPrice: number;
  costPrice: number;
  onHand: number;
  reserved: number;
  procureOnDemand: boolean;
  procurementType: ProcurementType;
  vendor?: string;
  bomId?: ID;
}

export interface BomComponent { productId: ID; quantity: number }
export interface BomOperation { name: string; workCenter: string; durationMin: number }
export interface Bom {
  id: ID;
  name: string;
  productId: ID;
  outputQty: number;
  components: BomComponent[];
  operations: BomOperation[];
}

export type OrderStatus = "draft" | "confirmed" | "partial" | "done" | "cancelled";

export interface SOLine { productId: ID; quantity: number; delivered: number; unitPrice: number }
export interface SalesOrder {
  id: ID;
  reference: string;
  customer: string;
  date: string;
  status: OrderStatus;
  lines: SOLine[];
}

export interface POLine { productId: ID; quantity: number; received: number; unitPrice: number }
export interface PurchaseOrder {
  id: ID;
  reference: string;
  vendor: string;
  date: string;
  status: OrderStatus;
  lines: POLine[];
}

export interface WorkOrder { id: ID; name: string; workCenter: string; durationMin: number; status: "todo" | "in_progress" | "done" }
export interface ManufacturingOrder {
  id: ID;
  reference: string;
  productId: ID;
  quantity: number;
  bomId?: ID;
  assignee?: string;
  date: string;
  status: OrderStatus;
  workOrders: WorkOrder[];
  consumedComponents: BomComponent[]; // snapshot
}

export interface StockMove { id: ID; date: string; productId: ID; quantity: number; reason: string; ref?: string }
export interface AuditEntry { id: ID; date: string; module: string; action: string; ref?: string; detail?: string }

interface ERPState {
  products: Product[];
  boms: Bom[];
  sales: SalesOrder[];
  purchases: PurchaseOrder[];
  mos: ManufacturingOrder[];
  stockMoves: StockMove[];
  audit: AuditEntry[];

  // utils
  getProduct: (id: ID) => Product | undefined;
  freeQty: (id: ID) => number;

  // mutations
  upsertProduct: (p: Partial<Product> & { id?: ID }) => Product;
  deleteProduct: (id: ID) => void;

  upsertBom: (b: Partial<Bom> & { id?: ID }) => Bom;
  deleteBom: (id: ID) => void;

  saveSO: (s: Partial<SalesOrder> & { id?: ID }) => SalesOrder;
  confirmSO: (id: ID) => void;
  deliverSO: (id: ID) => void;
  cancelSO: (id: ID) => void;

  savePO: (p: Partial<PurchaseOrder> & { id?: ID }) => PurchaseOrder;
  confirmPO: (id: ID) => void;
  receivePO: (id: ID) => void;
  cancelPO: (id: ID) => void;

  saveMO: (m: Partial<ManufacturingOrder> & { id?: ID }) => ManufacturingOrder;
  confirmMO: (id: ID) => void;
  startWO: (moId: ID, woId: ID) => void;
  finishWO: (moId: ID, woId: ID) => void;
  completeMO: (id: ID) => void;
  cancelMO: (id: ID) => void;

  seedDemo: () => void;
  reset: () => void;
}

const log = (state: ERPState, e: Omit<AuditEntry, "id" | "date">) => {
  state.audit.unshift({ id: uid(), date: now(), ...e });
};
const move = (state: ERPState, m: Omit<StockMove, "id" | "date">) => {
  state.stockMoves.unshift({ id: uid(), date: now(), ...m });
};

export const useERP = create<ERPState>()(
  persist(
    (set, get) => ({
      products: [],
      boms: [],
      sales: [],
      purchases: [],
      mos: [],
      stockMoves: [],
      audit: [],

      getProduct: (id) => get().products.find((p) => p.id === id),
      freeQty: (id) => {
        const p = get().products.find((x) => x.id === id);
        return p ? p.onHand - p.reserved : 0;
      },

      upsertProduct: (p) => {
        const existing = p.id ? get().products.find((x) => x.id === p.id) : undefined;
        const next: Product = {
          id: existing?.id ?? uid(),
          name: p.name ?? existing?.name ?? "Unnamed",
          salesPrice: Number(p.salesPrice ?? existing?.salesPrice ?? 0),
          costPrice: Number(p.costPrice ?? existing?.costPrice ?? 0),
          onHand: Number(p.onHand ?? existing?.onHand ?? 0),
          reserved: Number(p.reserved ?? existing?.reserved ?? 0),
          procureOnDemand: p.procureOnDemand ?? existing?.procureOnDemand ?? false,
          procurementType: (p.procurementType ?? existing?.procurementType ?? "purchase") as ProcurementType,
          vendor: p.vendor ?? existing?.vendor,
          bomId: p.bomId ?? existing?.bomId,
        };
        set((s) => {
          const products = existing
            ? s.products.map((x) => (x.id === next.id ? next : x))
            : [...s.products, next];
          const audit = [...s.audit];
          audit.unshift({ id: uid(), date: now(), module: "Product", action: existing ? "Updated" : "Created", ref: next.name });
          return { products, audit };
        });
        return next;
      },
      deleteProduct: (id) => set((s) => ({
        products: s.products.filter((p) => p.id !== id),
        audit: [{ id: uid(), date: now(), module: "Product", action: "Deleted", ref: id }, ...s.audit],
      })),

      upsertBom: (b) => {
        const existing = b.id ? get().boms.find((x) => x.id === b.id) : undefined;
        const next: Bom = {
          id: existing?.id ?? uid(),
          name: b.name ?? existing?.name ?? "BoM",
          productId: b.productId ?? existing?.productId ?? "",
          outputQty: Number(b.outputQty ?? existing?.outputQty ?? 1),
          components: b.components ?? existing?.components ?? [],
          operations: b.operations ?? existing?.operations ?? [],
        };
        set((s) => ({
          boms: existing ? s.boms.map((x) => (x.id === next.id ? next : x)) : [...s.boms, next],
          audit: [{ id: uid(), date: now(), module: "BoM", action: existing ? "Updated" : "Created", ref: next.name }, ...s.audit],
        }));
        return next;
      },
      deleteBom: (id) => set((s) => ({ boms: s.boms.filter((b) => b.id !== id) })),

      saveSO: (s) => {
        const existing = s.id ? get().sales.find((x) => x.id === s.id) : undefined;
        const next: SalesOrder = {
          id: existing?.id ?? uid(),
          reference: existing?.reference ?? `SO-${String(get().sales.length + 1).padStart(4, "0")}`,
          customer: s.customer ?? existing?.customer ?? "",
          date: existing?.date ?? now(),
          status: existing?.status ?? "draft",
          lines: (s.lines ?? existing?.lines ?? []).map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity) || 0,
            delivered: Number(l.delivered) || 0,
            unitPrice: Number(l.unitPrice) || 0,
          })),
        };
        set((st) => ({
          sales: existing ? st.sales.map((x) => (x.id === next.id ? next : x)) : [next, ...st.sales],
          audit: [{ id: uid(), date: now(), module: "Sales", action: existing ? "Updated" : "Created", ref: next.reference }, ...st.audit],
        }));
        return next;
      },
      confirmSO: (id) => set((st) => {
        const so = st.sales.find((s) => s.id === id);
        if (!so || so.status !== "draft") return st;
        const products = st.products.map((p) => ({ ...p }));
        const newPOs: PurchaseOrder[] = [];
        const newMOs: ManufacturingOrder[] = [];
        for (const line of so.lines) {
          const p = products.find((x) => x.id === line.productId);
          if (!p) continue;
          const free = p.onHand - p.reserved;
          const reserveQty = Math.min(free, line.quantity);
          p.reserved += reserveQty;
          const shortage = line.quantity - reserveQty;
          if (shortage > 0 && p.procureOnDemand) {
            if (p.procurementType === "purchase") {
              newPOs.push({
                id: uid(),
                reference: `PO-${String(st.purchases.length + newPOs.length + 1).padStart(4, "0")}`,
                vendor: p.vendor || "Auto Vendor",
                date: now(),
                status: "draft",
                lines: [{ productId: p.id, quantity: shortage, received: 0, unitPrice: p.costPrice }],
              });
            } else {
              newMOs.push({
                id: uid(),
                reference: `MO-${String(st.mos.length + newMOs.length + 1).padStart(4, "0")}`,
                productId: p.id,
                quantity: shortage,
                bomId: p.bomId,
                date: now(),
                status: "draft",
                workOrders: [],
                consumedComponents: [],
              });
            }
          }
        }
        const audit = [{ id: uid(), date: now(), module: "Sales", action: "Confirmed", ref: so.reference }, ...st.audit];
        if (newPOs.length) audit.unshift({ id: uid(), date: now(), module: "Procurement", action: `Auto-created ${newPOs.length} PO`, ref: so.reference });
        if (newMOs.length) audit.unshift({ id: uid(), date: now(), module: "Procurement", action: `Auto-created ${newMOs.length} MO`, ref: so.reference });
        return {
          products,
          sales: st.sales.map((s) => (s.id === id ? { ...so, status: "confirmed" } : s)),
          purchases: [...newPOs, ...st.purchases],
          mos: [...newMOs, ...st.mos],
          audit,
        };
      }),
      deliverSO: (id) => set((st) => {
        const so = st.sales.find((s) => s.id === id);
        if (!so || so.status === "done" || so.status === "cancelled") return st;
        const products = st.products.map((p) => ({ ...p }));
        const moves: StockMove[] = [];
        let allDone = true;
        const newLines = so.lines.map((l) => {
          const p = products.find((x) => x.id === l.productId);
          if (!p) { allDone = false; return l; }
          const deliverable = Math.min(l.quantity - l.delivered, p.onHand);
          if (deliverable > 0) {
            p.onHand -= deliverable;
            p.reserved = Math.max(0, p.reserved - deliverable);
            moves.push({ id: uid(), date: now(), productId: p.id, quantity: -deliverable, reason: "Sales delivery", ref: so.reference });
          }
          const delivered = l.delivered + deliverable;
          if (delivered < l.quantity) allDone = false;
          return { ...l, delivered };
        });
        const status: OrderStatus = allDone ? "done" : "partial";
        return {
          products,
          sales: st.sales.map((s) => (s.id === id ? { ...so, lines: newLines, status } : s)),
          stockMoves: [...moves, ...st.stockMoves],
          audit: [{ id: uid(), date: now(), module: "Sales", action: allDone ? "Delivered" : "Partial delivery", ref: so.reference }, ...st.audit],
        };
      }),
      cancelSO: (id) => set((st) => {
        const so = st.sales.find((s) => s.id === id);
        if (!so) return st;
        const products = st.products.map((p) => ({ ...p }));
        if (so.status === "confirmed" || so.status === "partial") {
          for (const l of so.lines) {
            const p = products.find((x) => x.id === l.productId);
            if (p) p.reserved = Math.max(0, p.reserved - (l.quantity - l.delivered));
          }
        }
        return {
          products,
          sales: st.sales.map((s) => (s.id === id ? { ...so, status: "cancelled" } : s)),
          audit: [{ id: uid(), date: now(), module: "Sales", action: "Cancelled", ref: so.reference }, ...st.audit],
        };
      }),

      savePO: (p) => {
        const existing = p.id ? get().purchases.find((x) => x.id === p.id) : undefined;
        const next: PurchaseOrder = {
          id: existing?.id ?? uid(),
          reference: existing?.reference ?? `PO-${String(get().purchases.length + 1).padStart(4, "0")}`,
          vendor: p.vendor ?? existing?.vendor ?? "",
          date: existing?.date ?? now(),
          status: existing?.status ?? "draft",
          lines: (p.lines ?? existing?.lines ?? []).map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity) || 0,
            received: Number(l.received) || 0,
            unitPrice: Number(l.unitPrice) || 0,
          })),
        };
        set((st) => ({
          purchases: existing ? st.purchases.map((x) => (x.id === next.id ? next : x)) : [next, ...st.purchases],
          audit: [{ id: uid(), date: now(), module: "Purchase", action: existing ? "Updated" : "Created", ref: next.reference }, ...st.audit],
        }));
        return next;
      },
      confirmPO: (id) => set((st) => {
        const po = st.purchases.find((p) => p.id === id);
        if (!po || po.status !== "draft") return st;
        return {
          purchases: st.purchases.map((p) => (p.id === id ? { ...po, status: "confirmed" } : p)),
          audit: [{ id: uid(), date: now(), module: "Purchase", action: "Confirmed", ref: po.reference }, ...st.audit],
        };
      }),
      receivePO: (id) => set((st) => {
        const po = st.purchases.find((p) => p.id === id);
        if (!po || po.status === "done" || po.status === "cancelled") return st;
        const products = st.products.map((p) => ({ ...p }));
        const moves: StockMove[] = [];
        const newLines = po.lines.map((l) => {
          const remaining = l.quantity - l.received;
          if (remaining <= 0) return l;
          const p = products.find((x) => x.id === l.productId);
          if (p) {
            p.onHand += remaining;
            moves.push({ id: uid(), date: now(), productId: p.id, quantity: remaining, reason: "Purchase receipt", ref: po.reference });
          }
          return { ...l, received: l.quantity };
        });
        return {
          products,
          purchases: st.purchases.map((p) => (p.id === id ? { ...po, lines: newLines, status: "done" } : p)),
          stockMoves: [...moves, ...st.stockMoves],
          audit: [{ id: uid(), date: now(), module: "Purchase", action: "Received", ref: po.reference }, ...st.audit],
        };
      }),
      cancelPO: (id) => set((st) => ({
        purchases: st.purchases.map((p) => (p.id === id ? { ...p, status: "cancelled" } : p)),
        audit: [{ id: uid(), date: now(), module: "Purchase", action: "Cancelled", ref: id }, ...st.audit],
      })),

      saveMO: (m) => {
        const existing = m.id ? get().mos.find((x) => x.id === m.id) : undefined;
        const bom = (m.bomId ?? existing?.bomId) ? get().boms.find((b) => b.id === (m.bomId ?? existing?.bomId)) : undefined;
        const qty = Number(m.quantity ?? existing?.quantity ?? 1);
        const workOrders: WorkOrder[] = existing?.workOrders.length
          ? existing.workOrders
          : bom?.operations.map((op) => ({
              id: uid(), name: op.name, workCenter: op.workCenter,
              durationMin: op.durationMin * qty, status: "todo" as const,
            })) ?? [];
        const consumed: BomComponent[] = bom
          ? bom.components.map((c) => ({ productId: c.productId, quantity: c.quantity * qty }))
          : (existing?.consumedComponents ?? []);
        const next: ManufacturingOrder = {
          id: existing?.id ?? uid(),
          reference: existing?.reference ?? `MO-${String(get().mos.length + 1).padStart(4, "0")}`,
          productId: m.productId ?? existing?.productId ?? "",
          quantity: qty,
          bomId: m.bomId ?? existing?.bomId,
          assignee: m.assignee ?? existing?.assignee,
          date: existing?.date ?? now(),
          status: existing?.status ?? "draft",
          workOrders,
          consumedComponents: consumed,
        };
        set((st) => ({
          mos: existing ? st.mos.map((x) => (x.id === next.id ? next : x)) : [next, ...st.mos],
          audit: [{ id: uid(), date: now(), module: "Manufacturing", action: existing ? "Updated" : "Created", ref: next.reference }, ...st.audit],
        }));
        return next;
      },
      confirmMO: (id) => set((st) => {
        const mo = st.mos.find((m) => m.id === id);
        if (!mo || mo.status !== "draft") return st;
        const products = st.products.map((p) => ({ ...p }));
        for (const c of mo.consumedComponents) {
          const p = products.find((x) => x.id === c.productId);
          if (p) p.reserved += c.quantity;
        }
        return {
          products,
          mos: st.mos.map((m) => (m.id === id ? { ...mo, status: "confirmed" } : m)),
          audit: [{ id: uid(), date: now(), module: "Manufacturing", action: "Confirmed", ref: mo.reference }, ...st.audit],
        };
      }),
      startWO: (moId, woId) => set((st) => ({
        mos: st.mos.map((m) => m.id !== moId ? m : { ...m, workOrders: m.workOrders.map((w) => w.id === woId ? { ...w, status: "in_progress" } : w) }),
      })),
      finishWO: (moId, woId) => set((st) => ({
        mos: st.mos.map((m) => m.id !== moId ? m : { ...m, workOrders: m.workOrders.map((w) => w.id === woId ? { ...w, status: "done" } : w) }),
      })),
      completeMO: (id) => set((st) => {
        const mo = st.mos.find((m) => m.id === id);
        if (!mo || mo.status === "done" || mo.status === "cancelled") return st;
        const products = st.products.map((p) => ({ ...p }));
        const moves: StockMove[] = [];
        for (const c of mo.consumedComponents) {
          const p = products.find((x) => x.id === c.productId);
          if (p) {
            p.onHand = Math.max(0, p.onHand - c.quantity);
            p.reserved = Math.max(0, p.reserved - c.quantity);
            moves.push({ id: uid(), date: now(), productId: p.id, quantity: -c.quantity, reason: "MO consumption", ref: mo.reference });
          }
        }
        const fp = products.find((x) => x.id === mo.productId);
        if (fp) {
          fp.onHand += mo.quantity;
          moves.push({ id: uid(), date: now(), productId: fp.id, quantity: mo.quantity, reason: "MO production", ref: mo.reference });
        }
        return {
          products,
          mos: st.mos.map((m) => m.id === id ? { ...mo, status: "done", workOrders: mo.workOrders.map((w) => ({ ...w, status: "done" as const })) } : m),
          stockMoves: [...moves, ...st.stockMoves],
          audit: [{ id: uid(), date: now(), module: "Manufacturing", action: "Completed", ref: mo.reference }, ...st.audit],
        };
      }),
      cancelMO: (id) => set((st) => {
        const mo = st.mos.find((m) => m.id === id);
        if (!mo) return st;
        const products = st.products.map((p) => ({ ...p }));
        if (mo.status === "confirmed") {
          for (const c of mo.consumedComponents) {
            const p = products.find((x) => x.id === c.productId);
            if (p) p.reserved = Math.max(0, p.reserved - c.quantity);
          }
        }
        return {
          products,
          mos: st.mos.map((m) => m.id === id ? { ...mo, status: "cancelled" } : m),
          audit: [{ id: uid(), date: now(), module: "Manufacturing", action: "Cancelled", ref: mo.reference }, ...st.audit],
        };
      }),

      seedDemo: () => {
        const legs: Product = { id: uid(), name: "Wooden Legs", salesPrice: 80, costPrice: 50, onHand: 200, reserved: 0, procureOnDemand: true, procurementType: "purchase", vendor: "TimberCo" };
        const top: Product = { id: uid(), name: "Wooden Top", salesPrice: 600, costPrice: 400, onHand: 30, reserved: 0, procureOnDemand: true, procurementType: "purchase", vendor: "TimberCo" };
        const screws: Product = { id: uid(), name: "Screws (pack)", salesPrice: 5, costPrice: 2, onHand: 1000, reserved: 0, procureOnDemand: true, procurementType: "purchase", vendor: "FastenerHub" };
        const table: Product = { id: uid(), name: "Dining Table", salesPrice: 4500, costPrice: 2200, onHand: 5, reserved: 0, procureOnDemand: true, procurementType: "manufacturing" };
        const chair: Product = { id: uid(), name: "Office Chair", salesPrice: 2200, costPrice: 1100, onHand: 12, reserved: 0, procureOnDemand: false, procurementType: "manufacturing" };
        const bom: Bom = {
          id: uid(), name: "Dining Table BoM", productId: table.id, outputQty: 1,
          components: [
            { productId: legs.id, quantity: 4 },
            { productId: top.id, quantity: 1 },
            { productId: screws.id, quantity: 12 },
          ],
          operations: [
            { name: "Assembly", workCenter: "Assembly Line", durationMin: 60 },
            { name: "Painting", workCenter: "Paint Floor", durationMin: 30 },
            { name: "Packing", workCenter: "Packaging Unit", durationMin: 20 },
          ],
        };
        table.bomId = bom.id;
        set((s) => ({
          ...s,
          products: [legs, top, screws, table, chair],
          boms: [bom],
          audit: [{ id: uid(), date: now(), module: "System", action: "Demo data seeded" }, ...s.audit],
        }));
      },
      reset: () => set({ products: [], boms: [], sales: [], purchases: [], mos: [], stockMoves: [], audit: [] }),
    }),
    { name: "shiv-erp-v1" }
  )
);
