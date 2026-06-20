import { Link, useRouterState, useRouteContext, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useERP } from "@/lib/erp-store";
import { logoutUser } from "@/lib/auth-server";

const NAV = [
  { to: "/", label: "Dashboard", code: "00" },
  { to: "/products", label: "Products", code: "01" },
  { to: "/sales", label: "Sales Orders", code: "02" },
  { to: "/purchase", label: "Purchase Orders", code: "03" },
  { to: "/manufacturing", label: "Manufacturing", code: "04" },
  { to: "/bom", label: "Bill of Materials", code: "05" },
  { to: "/stock", label: "Stock Ledger", code: "06" },
  { to: "/audit", label: "Audit Logs", code: "07" },
];

export function ErpLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const reset = useERP((s) => s.reset);
  const theme = useERP((s) => s.theme);
  const toggleTheme = useERP((s) => s.toggleTheme);
  const lightMode = useERP((s) => s.lightMode);
  const toggleLightMode = useERP((s) => s.toggleLightMode);
  const initializeERPState = useERP((s) => s.initializeERPState);
  const [time, setTime] = useState("");
  const context = useRouteContext({ strict: false }) as any;
  const user = context?.user;

  useEffect(() => {
    const t = () => setTime(new Date().toLocaleTimeString("en-GB"));
    t();
    const i = setInterval(t, 1000);
    return () => clearInterval(i);
  }, []);

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Wait for Zustand persisted state to hydrate from localStorage
    const unsub = useERP.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    if (useERP.persist.hasHydrated()) {
      setHydrated(true);
    }

    return () => unsub();
  }, []);

  useEffect(() => {
    if (hydrated) {
      initializeERPState();
    }
  }, [hydrated, initializeERPState]);


  const handleLogout = async () => {
    if (confirm("Disconnect operational session?")) {
      await logoutUser();
      await router.invalidate();
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen flex text-foreground">
      <aside className="w-64 shrink-0 border-r border-border hud-panel hud-scanlines p-4 flex flex-col gap-1 sticky top-0 h-screen">
        <div className="mb-6">
          <div className="hud-label">SYS // v1.0.0</div>
          <h1 className="text-xl font-bold tracking-widest text-[color:var(--hud-cyan)] hud-text-glow mt-1">SHIV.ERP</h1>
          <div className="text-[10px] text-muted-foreground mt-1">FROM DEMAND → DELIVERY</div>
          {user && (
            <div className="mt-3 px-2 py-1.5 border border-[color:var(--hud-cyan)]/20 bg-[color:var(--hud-cyan)]/5 text-[9px] uppercase tracking-wider text-muted-foreground font-mono">
              OPERATOR // <span className="text-[color:var(--hud-cyan)] font-bold">{user.username}</span>
              <div className="text-[8px] opacity-75 mt-0.5">ROLE // {user.role}</div>
            </div>
          )}
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = n.to === "/" ? path === "/" : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`group flex items-center gap-3 px-3 py-2 text-xs tracking-wider uppercase border-l-2 transition-all ${
                  active
                    ? "border-[color:var(--hud-cyan)] bg-[color:var(--hud-cyan)]/10 text-[color:var(--hud-cyan)] hud-text-glow"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/30 hover:border-border"
                }`}
              >
                <span className="text-[9px] opacity-60">[{n.code}]</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-4 border-t border-border space-y-2">
          {user && (
            <button
              onClick={handleLogout}
              className="w-full text-[10px] uppercase tracking-widest text-[color:var(--hud-cyan)] hover:text-[color:var(--hud-cyan)]/85 py-1 border border-[color:var(--hud-cyan)]/30 hover:border-[color:var(--hud-cyan)] hover:hud-glow transition-all bg-transparent cursor-pointer"
            >
              Disconnect Session
            </button>
          )}
          <button
            onClick={() => { if (confirm("Reset all ERP data?")) reset(); }}
            className="w-full text-[10px] uppercase tracking-widest text-[color:var(--hud-red)]/80 hover:text-[color:var(--hud-red)] py-1 border border-[color:var(--hud-red)]/30 hover:border-[color:var(--hud-red)] transition-colors cursor-pointer"
          >
            Purge Data
          </button>
          <div className="hud-label flex justify-between">
            <span>THEME</span>
            <button
              onClick={toggleTheme}
              className="text-[10px] uppercase tracking-widest text-[color:var(--hud-cyan)] hover:underline cursor-pointer bg-transparent border-0 p-0 font-bold font-mono"
            >
              [{theme === "hud" ? "HUD" : "MINIMAL"}]
            </button>
          </div>
          <div className="hud-label flex justify-between">
            <span>LIGHT MODE</span>
            <button
              onClick={toggleLightMode}
              className="text-[10px] uppercase tracking-widest text-[color:var(--hud-cyan)] hover:underline cursor-pointer bg-transparent border-0 p-0 font-bold font-mono"
            >
              [{lightMode ? "ON" : "OFF"}]
            </button>
          </div>
          <div className="hud-label flex justify-between">
            <span>STATUS</span>
            <span className="text-[color:var(--hud-green)] hud-text-glow">● ONLINE</span>
          </div>
          <div className="hud-label flex justify-between">
            <span>TIME</span>
            <span className="text-[color:var(--hud-cyan)]">{time}</span>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-hidden">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="flex items-end justify-between mb-6 pb-4 border-b border-border">
      <div>
        <div className="hud-label">MODULE</div>
        <h2 className="text-3xl font-bold tracking-wider text-[color:var(--hud-cyan)] hud-text-glow">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 tracking-wide">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function HudButton({
  children, onClick, variant = "primary", type = "button", disabled,
}: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "warn"; type?: "button" | "submit"; disabled?: boolean }) {
  const styles: Record<string, string> = {
    primary: "border-[color:var(--hud-cyan)] text-[color:var(--hud-cyan)] hover:bg-[color:var(--hud-cyan)]/15 hover:hud-glow",
    ghost: "border-border text-muted-foreground hover:text-foreground hover:border-foreground",
    danger: "border-[color:var(--hud-red)] text-[color:var(--hud-red)] hover:bg-[color:var(--hud-red)]/15",
    warn: "border-[color:var(--hud-amber)] text-[color:var(--hud-amber)] hover:bg-[color:var(--hud-amber)]/15",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-[11px] uppercase tracking-widest border bg-transparent transition-all disabled:opacity-30 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

export function HudPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`hud-panel p-5 ${className}`}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "text-muted-foreground border-border",
    confirmed: "text-[color:var(--hud-cyan)] border-[color:var(--hud-cyan)]",
    partial: "text-[color:var(--hud-amber)] border-[color:var(--hud-amber)]",
    done: "text-[color:var(--hud-green)] border-[color:var(--hud-green)]",
    cancelled: "text-[color:var(--hud-red)] border-[color:var(--hud-red)]",
    todo: "text-muted-foreground border-border",
    in_progress: "text-[color:var(--hud-amber)] border-[color:var(--hud-amber)]",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-[9px] uppercase tracking-widest border ${map[status] ?? "border-border"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function HudInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-input/40 border border-border focus:border-[color:var(--hud-cyan)] focus:outline-none px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 font-mono ${props.className ?? ""}`}
    />
  );
}

export function HudSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      className={`w-full bg-input/40 border border-border focus:border-[color:var(--hud-cyan)] focus:outline-none px-3 py-2 text-sm text-foreground font-mono ${props.className ?? ""}`}
    >
      {props.children}
    </select>
  );
}

export function HudField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="hud-label block mb-1">{label}</span>
      {children}
    </label>
  );
}
