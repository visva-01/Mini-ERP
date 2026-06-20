import { createFileRoute } from "@tanstack/react-router";
import { ErpLayout, HudPanel, PageHeader } from "@/components/erp-layout";
import { useERP } from "@/lib/erp-store";

export const Route = createFileRoute("/stock")({
  head: () => ({ meta: [{ title: "Stock Ledger — Shiv ERP" }] }),
  component: StockPage,
});

function StockPage() {
  const moves = useERP((s) => s.stockMoves);
  const products = useERP((s) => s.products);

  return (
    <ErpLayout>
      <PageHeader title="Stock Ledger" subtitle="Every inventory movement, auto-recorded across all modules." />
      <HudPanel>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground text-left">
            <tr><th className="py-2">Timestamp</th><th>Product</th><th>Reason</th><th>Reference</th><th className="text-right">Movement</th></tr>
          </thead>
          <tbody>
            {moves.map((m) => {
              const p = products.find((x) => x.id === m.productId);
              return (
                <tr key={m.id} className="border-t border-border/60">
                  <td className="py-2 text-muted-foreground">{new Date(m.date).toLocaleString()}</td>
                  <td>{p?.name ?? m.productId}</td>
                  <td>{m.reason}</td>
                  <td className="text-[color:var(--hud-cyan)]">{m.ref ?? "—"}</td>
                  <td className={`text-right font-bold ${m.quantity > 0 ? "text-[color:var(--hud-green)]" : "text-[color:var(--hud-red)]"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                </tr>
              );
            })}
            {moves.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No stock movements yet.</td></tr>}
          </tbody>
        </table>
      </HudPanel>
    </ErpLayout>
  );
}
