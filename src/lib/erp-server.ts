import { createServerFn } from "@tanstack/react-start";
import { query } from "./db";
import { z } from "zod";

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

/**
 * Helper to fetch all rows from database and map them to frontend model camelCase structure.
 */
async function getERPStateFromDB() {
  const productsRes = await query("SELECT * FROM products ORDER BY name ASC;");
  const bomsRes = await query("SELECT * FROM boms ORDER BY name ASC;");
  const salesRes = await query("SELECT * FROM sales_orders ORDER BY date DESC;");
  const purchasesRes = await query("SELECT * FROM purchase_orders ORDER BY date DESC;");
  const mosRes = await query("SELECT * FROM manufacturing_orders ORDER BY date DESC;");
  const stockMovesRes = await query("SELECT * FROM stock_moves ORDER BY date DESC;");
  const auditRes = await query("SELECT * FROM audit_log ORDER BY date DESC;");

  const products = productsRes.rows.map((r) => ({
    id: r.id,
    name: r.name,
    salesPrice: Number(r.sales_price),
    costPrice: Number(r.cost_price),
    onHand: Number(r.on_hand),
    reserved: Number(r.reserved),
    procureOnDemand: Boolean(r.procure_on_demand),
    procurementType: r.procurement_type,
    vendor: r.vendor || undefined,
    bomId: r.bom_id || undefined,
  }));

  const boms = bomsRes.rows.map((r) => ({
    id: r.id,
    name: r.name,
    productId: r.product_id,
    outputQty: Number(r.output_qty),
    components: r.components,
    operations: r.operations,
  }));

  const sales = salesRes.rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    customer: r.customer,
    date: r.date instanceof Date ? r.date.toISOString() : r.date,
    status: r.status,
    lines: r.lines,
  }));

  const purchases = purchasesRes.rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    vendor: r.vendor,
    date: r.date instanceof Date ? r.date.toISOString() : r.date,
    status: r.status,
    lines: r.lines,
  }));

  const mos = mosRes.rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    productId: r.product_id,
    quantity: Number(r.quantity),
    bomId: r.bom_id || undefined,
    assignee: r.assignee || undefined,
    date: r.date instanceof Date ? r.date.toISOString() : r.date,
    status: r.status,
    workOrders: r.work_orders,
    consumedComponents: r.consumed_components,
  }));

  const stockMoves = stockMovesRes.rows.map((r) => ({
    id: r.id,
    date: r.date instanceof Date ? r.date.toISOString() : r.date,
    productId: r.product_id,
    quantity: Number(r.quantity),
    reason: r.reason,
    ref: r.ref || undefined,
  }));

  const audit = auditRes.rows.map((r) => ({
    id: r.id,
    date: r.date instanceof Date ? r.date.toISOString() : r.date,
    module: r.module,
    action: r.action,
    ref: r.ref || undefined,
    detail: r.detail || undefined,
  }));

  return { products, boms, sales, purchases, mos, stockMoves, audit };
}

/**
 * GET Server Function to fetch entire database state.
 */
export const fetchERPState = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      return await getERPStateFromDB();
    } catch (e: any) {
      console.error("Failed to fetch ERP state:", e);
      throw new Error("Failed to load ERP state: " + e.message);
    }
  });

/**
 * Mutates Product records (upsert / delete).
 */
export const mutateProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({
      action: z.enum(["upsert", "delete"]),
      id: z.string(),
      product: z.any().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { action, id, product } = data;
    console.log(`[RPC] mutateProduct called: ${action} for id: ${id}`);
    try {
      if (action === "delete") {
        await query("DELETE FROM products WHERE id = $1;", [id]);
        await query(
          "INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Product', 'Deleted', $2);",
          [uid(), id]
        );
      } else if (action === "upsert" && product) {
        // Check if updating
        const check = await query("SELECT id FROM products WHERE id = $1;", [product.id]);
        const isUpdate = check.rows.length > 0;

        await query(`
          INSERT INTO products (id, name, sales_price, cost_price, on_hand, reserved, procure_on_demand, procurement_type, vendor, bom_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            sales_price = EXCLUDED.sales_price,
            cost_price = EXCLUDED.cost_price,
            on_hand = EXCLUDED.on_hand,
            reserved = EXCLUDED.reserved,
            procure_on_demand = EXCLUDED.procure_on_demand,
            procurement_type = EXCLUDED.procurement_type,
            vendor = EXCLUDED.vendor,
            bom_id = EXCLUDED.bom_id;
        `, [
          product.id,
          product.name,
          product.salesPrice,
          product.costPrice,
          product.onHand,
          product.reserved,
          product.procureOnDemand,
          product.procurementType,
          product.vendor || null,
          product.bomId || null
        ]);

        await query(
          "INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Product', $2, $3);",
          [uid(), isUpdate ? "Updated" : "Created", product.name]
        );
      }
      return { success: true };
    } catch (e: any) {
      console.error("mutateProduct failed on server:", e);
      throw new Error("Product update failed: " + e.message);
    }
  });

/**
 * Mutates BoM records.
 */
export const mutateBom = createServerFn({ method: "POST" })
  .validator(
    z.object({
      action: z.enum(["upsert", "delete"]),
      id: z.string(),
      bom: z.any().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { action, id, bom } = data;
    console.log(`[RPC] mutateBom called: ${action} for id: ${id}`);
    try {
      if (action === "delete") {
        await query("DELETE FROM boms WHERE id = $1;", [id]);
        await query(
          "INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'BoM', 'Deleted', $2);",
          [uid(), id]
        );
      } else if (action === "upsert" && bom) {
        const check = await query("SELECT id FROM boms WHERE id = $1;", [bom.id]);
        const isUpdate = check.rows.length > 0;

        await query(`
          INSERT INTO boms (id, name, product_id, output_qty, components, operations)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            product_id = EXCLUDED.product_id,
            output_qty = EXCLUDED.output_qty,
            components = EXCLUDED.components,
            operations = EXCLUDED.operations;
        `, [
          bom.id,
          bom.name,
          bom.productId,
          bom.outputQty,
          JSON.stringify(bom.components),
          JSON.stringify(bom.operations),
        ]);

        await query(
          "INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'BoM', $2, $3);",
          [uid(), isUpdate ? "Updated" : "Created", bom.name]
        );
      }
      return { success: true };
    } catch (e: any) {
      console.error("mutateBom failed on server:", e);
      throw new Error("BoM update failed: " + e.message);
    }
  });

/**
 * Mutates Sales Orders.
 */
export const mutateSO = createServerFn({ method: "POST" })
  .validator(
    z.object({
      action: z.enum(["save", "confirm", "deliver", "cancel"]),
      id: z.string(),
      order: z.any().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { action, id, order } = data;
    console.log(`[RPC] mutateSO called: ${action} for id: ${id}`);
    try {
      if (action === "save" && order) {
        const isNew = !order.id;
        const finalId = order.id || uid();
        let reference = order.reference;
        if (isNew || !reference) {
          const countRes = await query("SELECT COUNT(*) FROM sales_orders;");
          const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
          reference = `SO-${String(nextNum).padStart(4, "0")}`;
        }

        await query(`
          INSERT INTO sales_orders (id, reference, customer, date, status, lines)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            customer = EXCLUDED.customer,
            status = EXCLUDED.status,
            lines = EXCLUDED.lines;
        `, [
          finalId,
          reference,
          order.customer,
          order.date || now(),
          order.status || "draft",
          JSON.stringify(order.lines)
        ]);

        await query(
          "INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Sales', $2, $3);",
          [uid(), isNew ? "Created" : "Updated", reference]
        );
      } else if (action === "confirm") {
        const soRes = await query("SELECT * FROM sales_orders WHERE id = $1;", [id]);
        if (soRes.rows.length === 0) throw new Error("SO not found");
        const so = soRes.rows[0];
        if (so.status !== "draft") return { success: true };

        const productsRes = await query("SELECT * FROM products;");
        const products = productsRes.rows;

        const newPOs: any[] = [];
        const newMOs: any[] = [];

        const poCountRes = await query("SELECT COUNT(*) FROM purchase_orders;");
        let poCount = parseInt(poCountRes.rows[0].count, 10);
        const moCountRes = await query("SELECT COUNT(*) FROM manufacturing_orders;");
        let moCount = parseInt(moCountRes.rows[0].count, 10);

        for (const line of so.lines) {
          const p = products.find((x) => x.id === line.productId);
          if (!p) continue;

          const free = Number(p.on_hand) - Number(p.reserved);
          const reserveQty = Math.min(free, line.quantity);
          const newReserved = Number(p.reserved) + reserveQty;
          
          await query("UPDATE products SET reserved = $1 WHERE id = $2;", [newReserved, p.id]);

          const shortage = line.quantity - reserveQty;
          if (shortage > 0 && p.procure_on_demand) {
            if (p.procurement_type === "purchase") {
              poCount++;
              newPOs.push({
                id: uid(),
                reference: `PO-${String(poCount).padStart(4, "0")}`,
                vendor: p.vendor || "Auto Vendor",
                date: now(),
                status: "draft",
                lines: [{ productId: p.id, quantity: shortage, received: 0, unitPrice: Number(p.cost_price) }],
              });
            } else {
              moCount++;
              const bomRes = await query("SELECT * FROM boms WHERE product_id = $1;", [p.id]);
              let workOrders: any[] = [];
              let consumedComponents: any[] = [];

              if (bomRes.rows.length > 0) {
                const bom = bomRes.rows[0];
                workOrders = bom.operations.map((op: any) => ({
                  id: uid(),
                  name: op.name,
                  workCenter: op.workCenter,
                  durationMin: op.durationMin * shortage,
                  status: "todo",
                }));
                consumedComponents = bom.components.map((c: any) => ({
                  productId: c.productId,
                  quantity: c.quantity * shortage,
                }));
              }

              newMOs.push({
                id: uid(),
                reference: `MO-${String(moCount).padStart(4, "0")}`,
                productId: p.id,
                quantity: shortage,
                bomId: p.bom_id,
                date: now(),
                status: "draft",
                workOrders,
                consumedComponents,
              });
            }
          }
        }

        for (const po of newPOs) {
          await query(`
            INSERT INTO purchase_orders (id, reference, vendor, date, status, lines)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb);
          `, [po.id, po.reference, po.vendor, po.date, po.status, JSON.stringify(po.lines)]);
        }

        for (const mo of newMOs) {
          await query(`
            INSERT INTO manufacturing_orders (id, reference, product_id, quantity, bom_id, assignee, date, status, work_orders, consumed_components)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb);
          `, [mo.id, mo.reference, mo.productId, mo.quantity, mo.bomId, null, mo.date, mo.status, JSON.stringify(mo.workOrders), JSON.stringify(mo.consumedComponents)]);
        }

        await query("UPDATE sales_orders SET status = 'confirmed' WHERE id = $1;", [id]);

        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Sales', 'Confirmed', $2);", [uid(), so.reference]);
        if (newPOs.length) {
          await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Procurement', $2, $3);", [uid(), `Auto-created ${newPOs.length} PO`, so.reference]);
        }
        if (newMOs.length) {
          await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Procurement', $2, $3);", [uid(), `Auto-created ${newMOs.length} MO`, so.reference]);
        }
      } else if (action === "deliver") {
        const soRes = await query("SELECT * FROM sales_orders WHERE id = $1;", [id]);
        if (soRes.rows.length === 0) throw new Error("SO not found");
        const so = soRes.rows[0];
        if (so.status === "done" || so.status === "cancelled") return { success: true };

        const productsRes = await query("SELECT * FROM products;");
        const products = productsRes.rows;

        const moves: any[] = [];
        let allDone = true;

        const updatedLines = [];
        for (const l of so.lines) {
          const p = products.find((x) => x.id === l.productId);
          if (!p) {
            allDone = false;
            updatedLines.push(l);
            continue;
          }
          const deliverable = Math.min(l.quantity - l.delivered, Number(p.on_hand));
          if (deliverable > 0) {
            const nextOnHand = Number(p.on_hand) - deliverable;
            const nextReserved = Math.max(0, Number(p.reserved) - deliverable);
            await query("UPDATE products SET on_hand = $1, reserved = $2 WHERE id = $3;", [nextOnHand, nextReserved, p.id]);
            moves.push({
              id: uid(),
              productId: p.id,
              quantity: -deliverable,
              reason: "Sales delivery",
              ref: so.reference,
            });
          }
          const delivered = l.delivered + deliverable;
          if (delivered < l.quantity) allDone = false;
          updatedLines.push({ ...l, delivered });
        }

        const nextStatus = allDone ? "done" : "partial";
        await query("UPDATE sales_orders SET lines = $1::jsonb, status = $2 WHERE id = $3;", [JSON.stringify(updatedLines), nextStatus, id]);

        for (const m of moves) {
          await query("INSERT INTO stock_moves (id, date, product_id, quantity, reason, ref) VALUES ($1, NOW(), $2, $3, $4, $5);", [m.id, m.productId, m.quantity, m.reason, m.ref]);
        }

        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Sales', $2, $3);", [uid(), allDone ? "Delivered" : "Partial delivery", so.reference]);
      } else if (action === "cancel") {
        const soRes = await query("SELECT * FROM sales_orders WHERE id = $1;", [id]);
        if (soRes.rows.length === 0) throw new Error("SO not found");
        const so = soRes.rows[0];

        if (so.status === "confirmed" || so.status === "partial") {
          for (const l of so.lines) {
            const pRes = await query("SELECT reserved FROM products WHERE id = $1;", [l.productId]);
            if (pRes.rows.length > 0) {
              const currentReserved = Number(pRes.rows[0].reserved);
              const nextReserved = Math.max(0, currentReserved - (l.quantity - l.delivered));
              await query("UPDATE products SET reserved = $1 WHERE id = $2;", [nextReserved, l.productId]);
            }
          }
        }
        await query("UPDATE sales_orders SET status = 'cancelled' WHERE id = $1;", [id]);
        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Sales', 'Cancelled', $2);", [uid(), so.reference]);
      }
      return { success: true };
    } catch (e: any) {
      console.error("mutateSO failed on server:", e);
      throw new Error("Sales order update failed: " + e.message);
    }
  });

/**
 * Mutates Purchase Orders.
 */
export const mutatePO = createServerFn({ method: "POST" })
  .validator(
    z.object({
      action: z.enum(["save", "confirm", "receive", "cancel"]),
      id: z.string(),
      order: z.any().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { action, id, order } = data;
    console.log(`[RPC] mutatePO called: ${action} for id: ${id}`);
    try {
      if (action === "save" && order) {
        const isNew = !order.id;
        const finalId = order.id || uid();
        let reference = order.reference;
        if (isNew || !reference) {
          const countRes = await query("SELECT COUNT(*) FROM purchase_orders;");
          const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
          reference = `PO-${String(nextNum).padStart(4, "0")}`;
        }

        await query(`
          INSERT INTO purchase_orders (id, reference, vendor, date, status, lines)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            vendor = EXCLUDED.vendor,
            status = EXCLUDED.status,
            lines = EXCLUDED.lines;
        `, [
          finalId,
          reference,
          order.vendor,
          order.date || now(),
          order.status || "draft",
          JSON.stringify(order.lines)
        ]);

        await query(
          "INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Purchase', $2, $3);",
          [uid(), isNew ? "Created" : "Updated", reference]
        );
      } else if (action === "confirm") {
        const poRes = await query("SELECT * FROM purchase_orders WHERE id = $1;", [id]);
        if (poRes.rows.length === 0) throw new Error("PO not found");
        const po = poRes.rows[0];
        if (po.status !== "draft") return { success: true };

        await query("UPDATE purchase_orders SET status = 'confirmed' WHERE id = $1;", [id]);
        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Purchase', 'Confirmed', $2);", [uid(), po.reference]);
      } else if (action === "receive") {
        const poRes = await query("SELECT * FROM purchase_orders WHERE id = $1;", [id]);
        if (poRes.rows.length === 0) throw new Error("PO not found");
        const po = poRes.rows[0];
        if (po.status === "done" || po.status === "cancelled") return { success: true };

        const moves: any[] = [];
        const updatedLines = [];

        for (const l of po.lines) {
          const remaining = l.quantity - l.received;
          if (remaining > 0) {
            const pRes = await query("SELECT on_hand FROM products WHERE id = $1;", [l.productId]);
            if (pRes.rows.length > 0) {
              const currentOnHand = Number(pRes.rows[0].on_hand);
              await query("UPDATE products SET on_hand = $1 WHERE id = $2;", [currentOnHand + remaining, l.productId]);
              moves.push({
                id: uid(),
                productId: l.productId,
                quantity: remaining,
                reason: "Purchase receipt",
                ref: po.reference,
              });
            }
          }
          updatedLines.push({ ...l, received: l.quantity });
        }

        await query("UPDATE purchase_orders SET lines = $1::jsonb, status = 'done' WHERE id = $2;", [JSON.stringify(updatedLines), id]);

        for (const m of moves) {
          await query("INSERT INTO stock_moves (id, date, product_id, quantity, reason, ref) VALUES ($1, NOW(), $2, $3, $4, $5);", [m.id, m.productId, m.quantity, m.reason, m.ref]);
        }

        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Purchase', 'Received', $2);", [uid(), po.reference]);
      } else if (action === "cancel") {
        await query("UPDATE purchase_orders SET status = 'cancelled' WHERE id = $1;", [id]);
        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Purchase', 'Cancelled', $2);", [uid(), id]);
      }
      return { success: true };
    } catch (e: any) {
      console.error("mutatePO failed on server:", e);
      throw new Error("Purchase order update failed: " + e.message);
    }
  });

/**
 * Mutates Manufacturing Orders.
 */
export const mutateMO = createServerFn({ method: "POST" })
  .validator(
    z.object({
      action: z.enum(["save", "confirm", "startWO", "finishWO", "complete", "cancel"]),
      id: z.string(),
      order: z.any().optional(),
      woId: z.string().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { action, id, order, woId } = data;
    console.log(`[RPC] mutateMO called: ${action} for id: ${id}`);
    try {
      if (action === "save" && order) {
        const isNew = !order.id;
        const finalId = order.id || uid();
        let reference = order.reference;
        if (isNew || !reference) {
          const countRes = await query("SELECT COUNT(*) FROM manufacturing_orders;");
          const nextNum = parseInt(countRes.rows[0].count, 10) + 1;
          reference = `MO-${String(nextNum).padStart(4, "0")}`;
        }

        const bomRes = order.bomId ? await query("SELECT * FROM boms WHERE id = $1;", [order.bomId]) : { rows: [] };
        const bom = bomRes.rows[0];
        const qty = Number(order.quantity || 1);

        const workOrders = order.workOrders && order.workOrders.length > 0
          ? order.workOrders
          : bom?.operations.map((op: any) => ({
              id: uid(),
              name: op.name,
              workCenter: op.workCenter,
              durationMin: op.durationMin * qty,
              status: "todo",
            })) || [];

        const consumed = bom
          ? bom.components.map((c: any) => ({ productId: c.productId, quantity: c.quantity * qty }))
          : (order.consumedComponents || []);

        await query(`
          INSERT INTO manufacturing_orders (id, reference, product_id, quantity, bom_id, assignee, date, status, work_orders, consumed_components)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
          ON CONFLICT (id) DO UPDATE SET
            product_id = EXCLUDED.product_id,
            quantity = EXCLUDED.quantity,
            bom_id = EXCLUDED.bom_id,
            assignee = EXCLUDED.assignee,
            status = EXCLUDED.status,
            work_orders = EXCLUDED.work_orders,
            consumed_components = EXCLUDED.consumed_components;
        `, [
          finalId,
          reference,
          order.productId,
          qty,
          order.bomId || null,
          order.assignee || null,
          order.date || now(),
          order.status || "draft",
          JSON.stringify(workOrders),
          JSON.stringify(consumed)
        ]);

        await query(
          "INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Manufacturing', $2, $3);",
          [uid(), isNew ? "Created" : "Updated", reference]
        );
      } else if (action === "confirm") {
        const moRes = await query("SELECT * FROM manufacturing_orders WHERE id = $1;", [id]);
        if (moRes.rows.length === 0) throw new Error("MO not found");
        const mo = moRes.rows[0];
        if (mo.status !== "draft") return { success: true };

        for (const c of mo.consumed_components) {
          const pRes = await query("SELECT reserved FROM products WHERE id = $1;", [c.productId]);
          if (pRes.rows.length > 0) {
            const currentReserved = Number(pRes.rows[0].reserved);
            await query("UPDATE products SET reserved = $1 WHERE id = $2;", [currentReserved + c.quantity, c.productId]);
          }
        }

        await query("UPDATE manufacturing_orders SET status = 'confirmed' WHERE id = $1;", [id]);
        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Manufacturing', 'Confirmed', $2);", [uid(), mo.reference]);
      } else if (action === "startWO" && woId) {
        const moRes = await query("SELECT work_orders FROM manufacturing_orders WHERE id = $1;", [id]);
        if (moRes.rows.length > 0) {
          const workOrders = moRes.rows[0].work_orders.map((w: any) =>
            w.id === woId ? { ...w, status: "in_progress" } : w
          );
          await query("UPDATE manufacturing_orders SET work_orders = $1::jsonb WHERE id = $2;", [JSON.stringify(workOrders), id]);
        }
      } else if (action === "finishWO" && woId) {
        const moRes = await query("SELECT work_orders FROM manufacturing_orders WHERE id = $1;", [id]);
        if (moRes.rows.length > 0) {
          const workOrders = moRes.rows[0].work_orders.map((w: any) =>
            w.id === woId ? { ...w, status: "done" } : w
          );
          await query("UPDATE manufacturing_orders SET work_orders = $1::jsonb WHERE id = $2;", [JSON.stringify(workOrders), id]);
        }
      } else if (action === "complete") {
        const moRes = await query("SELECT * FROM manufacturing_orders WHERE id = $1;", [id]);
        if (moRes.rows.length === 0) throw new Error("MO not found");
        const mo = moRes.rows[0];
        if (mo.status === "done" || mo.status === "cancelled") return { success: true };

        const moves: any[] = [];

        for (const c of mo.consumed_components) {
          const pRes = await query("SELECT on_hand, reserved FROM products WHERE id = $1;", [c.productId]);
          if (pRes.rows.length > 0) {
            const p = pRes.rows[0];
            const nextOnHand = Math.max(0, Number(p.on_hand) - c.quantity);
            const nextReserved = Math.max(0, Number(p.reserved) - c.quantity);
            await query("UPDATE products SET on_hand = $1, reserved = $2 WHERE id = $3;", [nextOnHand, nextReserved, c.productId]);
            moves.push({
              id: uid(),
              productId: c.productId,
              quantity: -c.quantity,
              reason: "MO consumption",
              ref: mo.reference,
            });
          }
        }

        const fpRes = await query("SELECT on_hand FROM products WHERE id = $1;", [mo.product_id]);
        if (fpRes.rows.length > 0) {
          const currentOnHand = Number(fpRes.rows[0].on_hand);
          await query("UPDATE products SET on_hand = $1 WHERE id = $2;", [currentOnHand + Number(mo.quantity), mo.product_id]);
          moves.push({
            id: uid(),
            productId: mo.product_id,
            quantity: Number(mo.quantity),
            reason: "MO production",
            ref: mo.reference,
          });
        }

        const workOrders = mo.work_orders.map((w: any) => ({ ...w, status: "done" }));

        await query(`
          UPDATE manufacturing_orders 
          SET status = 'done', work_orders = $1::jsonb 
          WHERE id = $2;
        `, [JSON.stringify(workOrders), id]);

        for (const m of moves) {
          await query("INSERT INTO stock_moves (id, date, product_id, quantity, reason, ref) VALUES ($1, NOW(), $2, $3, $4, $5);", [m.id, m.productId, m.quantity, m.reason, m.ref]);
        }

        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Manufacturing', 'Completed', $2);", [uid(), mo.reference]);
      } else if (action === "cancel") {
        const moRes = await query("SELECT * FROM manufacturing_orders WHERE id = $1;", [id]);
        if (moRes.rows.length === 0) throw new Error("MO not found");
        const mo = moRes.rows[0];

        if (mo.status === "confirmed") {
          for (const c of mo.consumed_components) {
            const pRes = await query("SELECT reserved FROM products WHERE id = $1;", [c.productId]);
            if (pRes.rows.length > 0) {
              const currentReserved = Number(pRes.rows[0].reserved);
              const nextReserved = Math.max(0, currentReserved - c.quantity);
              await query("UPDATE products SET reserved = $1 WHERE id = $2;", [nextReserved, c.productId]);
            }
          }
        }
        await query("UPDATE manufacturing_orders SET status = 'cancelled' WHERE id = $1;", [id]);
        await query("INSERT INTO audit_log (id, date, module, action, ref) VALUES ($1, NOW(), 'Manufacturing', 'Cancelled', $2);", [uid(), mo.reference]);
      }
      return { success: true };
    } catch (e: any) {
      console.error("mutateMO failed on server:", e);
      throw new Error("Manufacturing order update failed: " + e.message);
    }
  });

/**
 * Truncates all transactional tables in the database.
 */
export const resetERPData = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      await query("TRUNCATE products, boms, sales_orders, purchase_orders, manufacturing_orders, stock_moves, audit_log CASCADE;");
      return { success: true };
    } catch (e: any) {
      console.error("Failed to reset database on server:", e);
      throw new Error("Failed to reset ERP database tables: " + e.message);
    }
  });

/**
 * Manually seeds the database with the default demo dataset.
 */
export const seedERPDemo = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      await query("TRUNCATE products, boms, sales_orders, purchase_orders, manufacturing_orders, stock_moves, audit_log CASCADE;");
      
      await query(`
        INSERT INTO products (id, name, sales_price, cost_price, on_hand, reserved, procure_on_demand, procurement_type, vendor, bom_id) VALUES
        ('prod_legs', 'Wooden Legs', 80, 50, 200, 0, true, 'purchase', 'TimberCo', null),
        ('prod_top', 'Wooden Top', 600, 400, 30, 0, true, 'purchase', 'TimberCo', null),
        ('prod_screws', 'Screws (pack)', 5, 2, 1000, 0, true, 'purchase', 'FastenerHub', null),
        ('prod_table', 'Dining Table', 4500, 2200, 5, 0, true, 'manufacturing', null, 'bom_table'),
        ('prod_chair', 'Office Chair', 2200, 1100, 12, 0, false, 'manufacturing', null, null);
      `);

      await query(`
        INSERT INTO boms (id, name, product_id, output_qty, components, operations) VALUES
        ('bom_table', 'Dining Table BoM', 'prod_table', 1,
         '[{"productId": "prod_legs", "quantity": 4}, {"productId": "prod_top", "quantity": 1}, {"productId": "prod_screws", "quantity": 12}]'::jsonb,
         '[{"name": "Assembly", "workCenter": "Assembly Line", "durationMin": 60}, {"name": "Painting", "workCenter": "Paint Floor", "durationMin": 30}, {"name": "Packing", "workCenter": "Packaging Unit", "durationMin": 20}]'::jsonb
        );
      `);

      await query(`
        INSERT INTO stock_moves (id, date, product_id, quantity, reason, ref) VALUES
        ('move_legs', NOW() - INTERVAL '4 hours', 'prod_legs', 200, 'Initial purchase', 'PO-0001'),
        ('move_top', NOW() - INTERVAL '3 hours', 'prod_top', 30, 'Initial purchase', 'PO-0002'),
        ('move_screws', NOW() - INTERVAL '2 hours', 'prod_screws', 1000, 'Initial purchase', 'PO-0003'),
        ('move_table', NOW() - INTERVAL '1 hour', 'prod_table', -2, 'Sales delivery', 'SO-0001');
      `);

      await query(`
        INSERT INTO audit_log (id, date, module, action, ref, detail) VALUES
        ('audit_seed_sys', NOW(), 'System', 'Demo data seeded', null, null),
        ('audit_seed_stock', NOW(), 'Stock', 'Inventory initialized', 'Seeded', null);
      `);

      return await getERPStateFromDB();
    } catch (e: any) {
      console.error("Failed to seed ERP demo data on server:", e);
      throw new Error("Failed to seed database: " + e.message);
    }
  });
