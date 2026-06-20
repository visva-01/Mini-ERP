import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  fetchERPState,
  mutateProduct,
  mutateBom,
  mutateSO,
  mutatePO,
  mutateMO,
  resetERPData,
  seedERPDemo
} from "./erp-server";

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
  initializeERPState: () => Promise<void>;
  upsertProduct: (p: Partial<Product> & { id?: ID }) => Promise<Product>;
  deleteProduct: (id: ID) => Promise<void>;

  upsertBom: (b: Partial<Bom> & { id?: ID }) => Promise<Bom>;
  deleteBom: (id: ID) => Promise<void>;

  saveSO: (s: Partial<SalesOrder> & { id?: ID }) => Promise<SalesOrder>;
  confirmSO: (id: ID) => Promise<void>;
  deliverSO: (id: ID) => Promise<void>;
  cancelSO: (id: ID) => Promise<void>;

  savePO: (p: Partial<PurchaseOrder> & { id?: ID }) => Promise<PurchaseOrder>;
  confirmPO: (id: ID) => Promise<void>;
  receivePO: (id: ID) => Promise<void>;
  cancelPO: (id: ID) => Promise<void>;

  saveMO: (m: Partial<ManufacturingOrder> & { id?: ID }) => Promise<ManufacturingOrder>;
  confirmMO: (id: ID) => Promise<void>;
  startWO: (moId: ID, woId: ID) => Promise<void>;
  finishWO: (moId: ID, woId: ID) => Promise<void>;
  completeMO: (id: ID) => Promise<void>;
  cancelMO: (id: ID) => Promise<void>;

  seedDemo: () => Promise<void>;
  reset: () => Promise<void>;
  theme: "hud" | "minimal";
  toggleTheme: () => void;
  lightMode: boolean;
  toggleLightMode: () => void;
}

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

      initializeERPState: async () => {
        try {
          const data = await fetchERPState();
          set(data);
        } catch (err) {
          console.error("Store initialization failed:", err);
        }
      },

      upsertProduct: async (p) => {
        const finalProduct: Product = {
          id: p.id ?? uid(),
          name: p.name ?? "Unnamed",
          salesPrice: Number(p.salesPrice ?? 0),
          costPrice: Number(p.costPrice ?? 0),
          onHand: Number(p.onHand ?? 0),
          reserved: Number(p.reserved ?? 0),
          procureOnDemand: p.procureOnDemand ?? false,
          procurementType: (p.procurementType ?? "purchase") as ProcurementType,
          vendor: p.vendor,
          bomId: p.bomId,
        };

        try {
          await mutateProduct({
            data: {
              action: "upsert",
              id: finalProduct.id,
              product: { ...finalProduct, isUpdate: !!p.id }
            }
          });
          const data = await fetchERPState();
          set(data);
          return finalProduct;
        } catch (err: any) {
          console.error("Failed to upsert product:", err);
          alert("Failed to save product: " + err.message);
          throw err;
        }
      },

      deleteProduct: async (id) => {
        try {
          await mutateProduct({ data: { action: "delete", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to delete product:", err);
          alert("Failed to delete product: " + err.message);
          throw err;
        }
      },

      upsertBom: async (b) => {
        const finalBom: Bom = {
          id: b.id ?? uid(),
          name: b.name ?? "BoM",
          productId: b.productId ?? "",
          outputQty: Number(b.outputQty ?? 1),
          components: b.components ?? [],
          operations: b.operations ?? [],
        };

        try {
          await mutateBom({
            data: {
              action: "upsert",
              id: finalBom.id,
              bom: finalBom
            }
          });
          const data = await fetchERPState();
          set(data);
          return finalBom;
        } catch (err: any) {
          console.error("Failed to upsert BoM:", err);
          alert("Failed to save BoM: " + err.message);
          throw err;
        }
      },

      deleteBom: async (id) => {
        try {
          await mutateBom({ data: { action: "delete", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to delete BoM:", err);
          alert("Failed to delete BoM: " + err.message);
          throw err;
        }
      },

      saveSO: async (s) => {
        const finalSO: SalesOrder = {
          id: s.id ?? "",
          reference: s.reference ?? "",
          customer: s.customer ?? "",
          date: s.date ?? now(),
          status: (s.status ?? "draft") as OrderStatus,
          lines: (s.lines ?? []).map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity) || 0,
            delivered: Number(l.delivered) || 0,
            unitPrice: Number(l.unitPrice) || 0,
          })),
        };

        try {
          await mutateSO({
            data: {
              action: "save",
              id: finalSO.id,
              order: finalSO
            }
          });
          const data = await fetchERPState();
          set(data);
          return finalSO;
        } catch (err: any) {
          console.error("Failed to save Sales Order:", err);
          alert("Failed to save Sales Order: " + err.message);
          throw err;
        }
      },

      confirmSO: async (id) => {
        try {
          await mutateSO({ data: { action: "confirm", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to confirm Sales Order:", err);
          alert("Failed to confirm Sales Order: " + err.message);
          throw err;
        }
      },

      deliverSO: async (id) => {
        try {
          await mutateSO({ data: { action: "deliver", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to deliver Sales Order:", err);
          alert("Failed to deliver Sales Order: " + err.message);
          throw err;
        }
      },

      cancelSO: async (id) => {
        try {
          await mutateSO({ data: { action: "cancel", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to cancel Sales Order:", err);
          alert("Failed to cancel Sales Order: " + err.message);
          throw err;
        }
      },

      savePO: async (p) => {
        const finalPO: PurchaseOrder = {
          id: p.id ?? "",
          reference: p.reference ?? "",
          vendor: p.vendor ?? "",
          date: p.date ?? now(),
          status: (p.status ?? "draft") as OrderStatus,
          lines: (p.lines ?? []).map((l) => ({
            productId: l.productId,
            quantity: Number(l.quantity) || 0,
            received: Number(l.received) || 0,
            unitPrice: Number(l.unitPrice) || 0,
          })),
        };

        try {
          await mutatePO({
            data: {
              action: "save",
              id: finalPO.id,
              order: finalPO
            }
          });
          const data = await fetchERPState();
          set(data);
          return finalPO;
        } catch (err: any) {
          console.error("Failed to save Purchase Order:", err);
          alert("Failed to save Purchase Order: " + err.message);
          throw err;
        }
      },

      confirmPO: async (id) => {
        try {
          await mutatePO({ data: { action: "confirm", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to confirm Purchase Order:", err);
          alert("Failed to confirm Purchase Order: " + err.message);
          throw err;
        }
      },

      receivePO: async (id) => {
        try {
          await mutatePO({ data: { action: "receive", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to receive Purchase Order:", err);
          alert("Failed to receive Purchase Order: " + err.message);
          throw err;
        }
      },

      cancelPO: async (id) => {
        try {
          await mutatePO({ data: { action: "cancel", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to cancel Purchase Order:", err);
          alert("Failed to cancel Purchase Order: " + err.message);
          throw err;
        }
      },

      saveMO: async (m) => {
        const finalMO: ManufacturingOrder = {
          id: m.id ?? "",
          reference: m.reference ?? "",
          productId: m.productId ?? "",
          quantity: Number(m.quantity ?? 1),
          bomId: m.bomId,
          assignee: m.assignee,
          date: m.date ?? now(),
          status: (m.status ?? "draft") as OrderStatus,
          workOrders: m.workOrders ?? [],
          consumedComponents: m.consumedComponents ?? [],
        };

        try {
          await mutateMO({
            data: {
              action: "save",
              id: finalMO.id,
              order: finalMO
            }
          });
          const data = await fetchERPState();
          set(data);
          return finalMO;
        } catch (err: any) {
          console.error("Failed to save Manufacturing Order:", err);
          alert("Failed to save Manufacturing Order: " + err.message);
          throw err;
        }
      },

      confirmMO: async (id) => {
        try {
          await mutateMO({ data: { action: "confirm", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to confirm Manufacturing Order:", err);
          alert("Failed to confirm Manufacturing Order: " + err.message);
          throw err;
        }
      },

      startWO: async (moId, woId) => {
        try {
          await mutateMO({ data: { action: "startWO", id: moId, woId } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to start Work Order:", err);
          alert("Failed to start Work Order: " + err.message);
          throw err;
        }
      },

      finishWO: async (moId, woId) => {
        try {
          await mutateMO({ data: { action: "finishWO", id: moId, woId } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to finish Work Order:", err);
          alert("Failed to finish Work Order: " + err.message);
          throw err;
        }
      },

      completeMO: async (id) => {
        try {
          await mutateMO({ data: { action: "complete", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to complete Manufacturing Order:", err);
          alert("Failed to complete Manufacturing Order: " + err.message);
          throw err;
        }
      },

      cancelMO: async (id) => {
        try {
          await mutateMO({ data: { action: "cancel", id } });
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to cancel Manufacturing Order:", err);
          alert("Failed to cancel Manufacturing Order: " + err.message);
          throw err;
        }
      },

      seedDemo: async () => {
        try {
          const data = await seedERPDemo();
          set(data);
        } catch (err: any) {
          console.error("Failed to seed demo data:", err);
          alert("Failed to seed demo data: " + err.message);
          throw err;
        }
      },

      reset: async () => {
        try {
          await resetERPData();
          const data = await fetchERPState();
          set(data);
        } catch (err: any) {
          console.error("Failed to reset ERP data:", err);
          alert("Failed to reset ERP data: " + err.message);
          throw err;
        }
      },

      theme: "hud",
      toggleTheme: () => set((s) => ({ theme: s.theme === "hud" ? "minimal" : "hud" })),
      lightMode: false,
      toggleLightMode: () => set((s) => ({ lightMode: !s.lightMode })),
    }),
    {
      name: "shiv-erp-v1",
      partialize: (state) => ({
        theme: state.theme,
        lightMode: state.lightMode,
      }),
    }
  )
);
