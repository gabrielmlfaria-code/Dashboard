import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Auth } from "../core/auth.js";
import { Toast } from "../core/toast.js";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar - Macpontodashboard" },
      { name: "description", content: "Acesso ao Dashboard de ponto Macchips" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Auth.isAuthenticated()) {
      router.navigate({ to: "/", replace: true });
    }
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      await Auth.login({ username, password, clienteId });
      Toast.show("Login efetuado com sucesso.", "s");
      router.navigate({ to: "/", replace: true });
    } catch (err) {
      const message =
        (err instanceof Error && err.message) || "Falha ao autenticar. Verifique suas credenciais.";
      Toast.show(message, "e");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-input bg-card p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Entrar</h1>
        <p className="mt-1 text-sm text-muted-foreground">Acesse o painel com suas credenciais.</p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="username" className="text-sm font-medium text-foreground">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="clienteId" className="text-sm font-medium text-foreground">
              Cliente ID
            </label>
            <input
              id="clienteId"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
