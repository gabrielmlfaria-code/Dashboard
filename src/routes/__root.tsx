import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  redirect,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import { Auth } from "../core/auth.js";
import appCss from "../styles.css?url";
import legacyCss from "../styles-legacy.css?url";

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
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Macpontodashboard" },
      { name: "description", content: "Dashboard de ponto Macchips" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: legacyCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

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
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [userInfo, setUserInfo] = useState(Auth.getUserInfo());

  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem("mp_theme") || '"light"');
      const p = JSON.parse(localStorage.getItem("mp_pal") || '"default"');
      document.body.setAttribute("data-theme", t);
      document.body.setAttribute("data-palette", p);
    } catch {
      // Ignore invalid persisted theme values and keep the default theme.
    }
  }, []);

  // Guard global (client-only).
  useEffect(() => {
    let active = true;

    async function syncAuth() {
      try {
        await Auth.consumeTokenFromUrl();
        if (!Auth.isAuthenticated() && pathname !== "/login") {
          router.navigate({ to: "/login", replace: true });
          return;
        }

        if (Auth.isAuthenticated() && !Auth.getUserInfo()) {
          await Auth.loadUserInfo();
        }

        if (active) {
          setUserInfo(Auth.getUserInfo());
          setMounted(true);
        }
      } catch {
        Auth.clearTokens();
        if (pathname !== "/login") {
          router.navigate({ to: "/login", replace: true });
        }
        if (active) setMounted(true);
      }
    }

    syncAuth();
    return () => {
      active = false;
    };
  }, [pathname, router]);

  const authed = mounted && Auth.isAuthenticated();
  const onLogin = pathname === "/login";
  const blocked = mounted && !authed && !onLogin;

  return (
    <QueryClientProvider client={queryClient}>
      <div id="toastRoot" className="toast-root" />
      {authed && !onLogin ? <LogoutButton userInfo={userInfo} /> : null}
      {blocked ? (
        <div
          data-app-loading="1"
          style={{ padding: 24, fontFamily: "system-ui", color: "#64748b" }}
        >
          Redirecionando para o login…
        </div>
      ) : (
        <Outlet />
      )}
    </QueryClientProvider>
  );
}
