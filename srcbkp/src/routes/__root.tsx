import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";

import { Auth } from "../core/auth.js";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {import.meta.env.DEV && (
          <pre className="mt-4 max-h-48 overflow-auto rounded border bg-muted p-3 text-left text-xs text-muted-foreground">
            {error?.stack || error?.message || String(error)}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    await Auth.consumeTokenFromUrl();
    if (!Auth.isAuthenticated() && location.pathname !== "/login") {
      throw redirect({ to: "/login", replace: true });
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function LogoutButton({ userInfo }: { userInfo: ReturnType<typeof Auth.getUserInfo> }) {
  const userLabel = userInfo ? `${userInfo.name} | ${userInfo.cliente}` : "Sessao ativa";

  return (
    <div
      className="auth-logout-bar"
      style={{
        position: "fixed",
        top: 10,
        right: 12,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 6,
        maxWidth: "min(360px, calc(100vw - 24px))",
      }}
    >
      <span
        className="rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm"
        title={userInfo?.username || ""}
        style={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {userLabel}
      </span>
      <button
        type="button"
        onClick={() => Auth.logout()}
        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        style={{ flex: "0 0 auto" }}
      >
        Sair
      </button>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [userInfo, setUserInfo] = useState(Auth.getUserInfo());

  // Apply persisted theme on mount.
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem("mp_theme") || '"light"');
      const p = JSON.parse(localStorage.getItem("mp_pal") || '"default"');
      document.body.setAttribute("data-theme", t);
      document.body.setAttribute("data-palette", p);
    } catch {
      // ignore
    }
  }, []);

  // Load user info after authentication (no navigation here — beforeLoad handles routing).
  useEffect(() => {
    if (!Auth.isAuthenticated()) {
      setUserInfo(null);
      return;
    }
    let active = true;
    Auth.loadUserInfo()
      .then(() => { if (active) setUserInfo(Auth.getUserInfo()); })
      .catch(() => {});
    return () => { active = false; };
  }, [pathname]);

  const authed = Auth.isAuthenticated();
  const onLogin = pathname === "/login";

  return (
    <QueryClientProvider client={queryClient}>
      <div id="toastRoot" className="toast-root" />
      {authed && !onLogin ? <LogoutButton userInfo={userInfo} /> : null}
      <Outlet />
    </QueryClientProvider>
  );
}
