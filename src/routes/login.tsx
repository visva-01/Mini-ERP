import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HudButton, HudField, HudInput, HudPanel } from "@/components/erp-layout";
import { loginUser, signupUser } from "@/lib/auth-server";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Access Control — Shiv ERP" }] }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("operator");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        await loginUser({ data: { username, password } });
      } else {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await signupUser({ data: { username, password, role } });
      }

      // Invalidate router context so __root beforeLoad refetches current user
      await router.invalidate();
      // Redirect to dashboard
      await navigate({ to: "/" });
    } catch (err: any) {
      console.error("Auth action failed:", err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    setMode("login");
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12 hud-scanlines relative">
      <div className="max-w-md w-full">
        {/* Header telemetry theme */}
        <div className="text-center mb-6">
          <div className="hud-label tracking-widest text-[9px] mb-1">
            SECURE AUTH GATEWAY // PORT 5432
          </div>
          <h1 className="text-3xl font-bold tracking-widest text-[color:var(--hud-cyan)] hud-text-glow">
            SHIV.ERP
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enter credentials to establish connection.
          </p>
        </div>

        <HudPanel className="hud-glow">
          {/* Mode Switch Tabs */}
          <div className="flex border-b border-border mb-6">
            <button
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 pb-3 text-xs uppercase tracking-widest font-bold border-b-2 transition-all ${
                mode === "login"
                  ? "border-[color:var(--hud-cyan)] text-[color:var(--hud-cyan)] hud-text-glow"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              [01] Login
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={`flex-1 pb-3 text-xs uppercase tracking-widest font-bold border-b-2 transition-all ${
                mode === "signup"
                  ? "border-[color:var(--hud-cyan)] text-[color:var(--hud-cyan)] hud-text-glow"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              [02] Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 border border-[color:var(--hud-red)]/50 bg-[color:var(--hud-red)]/10 text-[color:var(--hud-red)] text-xs font-mono">
              <span className="font-bold">// EXCEPTION DETECTED:</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <HudField label="Terminal Username">
              <HudInput
                required
                type="text"
                placeholder="Enter username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </HudField>

            <HudField label="Access Password">
              <HudInput
                required
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </HudField>

            {mode === "signup" && (
              <>
                <HudField label="Confirm Password">
                  <HudInput
                    required
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </HudField>

                <HudField label="Authorization Role">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-input/40 border border-border focus:border-[color:var(--hud-cyan)] focus:outline-none px-3 py-2 text-sm text-foreground font-mono"
                  >
                    <option value="operator">Operator (Standard Access)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </HudField>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-xs font-bold uppercase tracking-widest border border-[color:var(--hud-cyan)] text-[color:var(--hud-cyan)] hover:bg-[color:var(--hud-cyan)]/15 hover:hud-glow bg-transparent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading
                  ? "PROCESSING..."
                  : mode === "login"
                    ? "INITIATE SESSION"
                    : "CREATE NEW CREDENTIALS"}
              </button>
            </div>
          </form>

          {/* Quick filling seeded user credentials */}
          <div className="mt-6 pt-4 border-t border-border/40">
            <div className="hud-label text-[9px] mb-2 text-center text-muted-foreground/80">
              SEEDED TELEMETRY ACCESS CREDENTIALS
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <button
                onClick={() => fillCredentials("admin", "admin123")}
                className="text-left p-2 border border-border/30 hover:border-[color:var(--hud-cyan)] hover:bg-accent/10 transition-all font-mono"
              >
                <div className="text-[color:var(--hud-cyan)] font-bold">ADMIN ROLE</div>
                <div className="text-muted-foreground">U: admin / P: admin123</div>
              </button>
              <button
                onClick={() => fillCredentials("operator", "operator123")}
                className="text-left p-2 border border-border/30 hover:border-[color:var(--hud-cyan)] hover:bg-accent/10 transition-all font-mono"
              >
                <div className="text-[color:var(--hud-cyan)] font-bold">OPERATOR ROLE</div>
                <div className="text-muted-foreground">U: operator / P: operator123</div>
              </button>
            </div>
          </div>
        </HudPanel>

        {/* Footer telemetry */}
        <div className="text-center mt-6 text-[10px] text-muted-foreground tracking-wider uppercase flex justify-between px-2">
          <span>SECURE GATE</span>
          <span className="text-[color:var(--hud-green)]">● TELEMETRY STABLE</span>
        </div>
      </div>
    </div>
  );
}
