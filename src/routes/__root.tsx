import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getCurrentUser, type User } from "../lib/auth-server";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center hud-panel p-8">
        <h1 className="text-7xl font-bold text-[color:var(--hud-cyan)] hud-text-glow">404</h1>
        <h2 className="mt-4 text-xl font-semibold tracking-widest uppercase">Signal Lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">Requested node is offline or unmapped.</p>
        <Link to="/" className="inline-block mt-6 px-4 py-2 text-xs uppercase tracking-widest border border-[color:var(--hud-cyan)] text-[color:var(--hud-cyan)] hover:bg-[color:var(--hud-cyan)]/15">
          Return to HUD
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center hud-panel p-8">
        <h1 className="text-xl font-semibold tracking-widest uppercase text-[color:var(--hud-red)]">System Fault</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex gap-2 justify-center">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="px-4 py-2 text-xs uppercase tracking-widest border border-[color:var(--hud-cyan)] text-[color:var(--hud-cyan)]"
          >
            Retry
          </button>
          <a href="/" className="px-4 py-2 text-xs uppercase tracking-widest border border-border">Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  user?: User | null;
}>()({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser();
    const isLoginPath = location.pathname === "/login";

    // Unauthenticated users are redirected to login
    if (!user && !isLoginPath) {
      throw redirect({ to: "/login" });
    }

    // Authenticated users are redirected away from login to dashboard
    if (user && isLoginPath) {
      throw redirect({ to: "/" });
    }

    return { user };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Shiv ERP — From Demand to Delivery" },
      { name: "description", content: "CyberHUD-themed Mini ERP for products, sales, purchase, manufacturing, BoM and inventory." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

import { useERP } from "../lib/erp-store";

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const theme = useERP((s) => s.theme);
  const lightMode = useERP((s) => s.lightMode);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const themeClass = theme || "hud";
      const modeClass = lightMode ? "light" : "dark";
      document.body.className = `${themeClass} ${modeClass}`;
    }
  }, [theme, lightMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
