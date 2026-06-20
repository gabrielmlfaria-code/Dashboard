import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Auth } from "../core/auth.js";
import { Toast } from "../core/toast.js";
import "./login.css";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Dashboard Radar Trabalhista" },
      { name: "description", content: "Dashboard Radar Trabalhista Macchips" },
    ],
  }),
  component: LoginPage,
});

const FEATURES = [
  "Posição do dia e histórico operacional",
  "Absenteísmo, banco de horas e fechamento mensal",
  "Auditoria de ponto e indicadores em tempo real",
];

function RadarMark({ className = "" }: { className?: string }) {
  return (
    <span className={`login-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
        <circle cx="20" cy="20" r="9" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <circle cx="20" cy="20" r="3.5" fill="currentColor" />
        <path
          d="M20 20 L20 6 A14 14 0 0 1 32 16 Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    </span>
  );
}

function BrandTitle({ className = "" }: { className?: string }) {
  return (
    <h1 className={`login-brand-title ${className}`.trim()}>
      <span className="login-brand-line">Radar</span>
      <span className="login-brand-line login-brand-line--accent">Trabalhista</span>
    </h1>
  );
}

function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!Auth.isAuthenticated()) return;
      try {
        await Auth.loadUserInfo();
        if (active) router.navigate({ to: "/", replace: true });
      } catch {
        Auth.clearTokens();
      }
    })();
    return () => {
      active = false;
    };
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
    <div className="login-page">
      <div className="login-shell">
        <aside className="login-brand" aria-hidden="true">
          <div className="login-brand-top">
            <RadarMark />
            <BrandTitle />
            <p className="login-brand-sub">
              Visão integrada de ponto, absenteísmo e riscos trabalhistas para a operação do dia.
            </p>
          </div>

          <ul className="login-features">
            {FEATURES.map((item) => (
              <li key={item}>
                <span className="login-feature-dot" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <p className="login-brand-foot">Macchips</p>
        </aside>

        <main className="login-form-panel">
          <div className="login-mobile-brand">
            <RadarMark className="login-mark--sm" />
            <div className="login-mobile-brand-text">
              <BrandTitle className="login-brand-title--sm" />
              <p className="login-brand-sub login-brand-sub--sm">Macchips</p>
            </div>
          </div>

          <div className="login-form-header">
            <h2 className="login-form-heading">Entrar</h2>
            <p className="login-form-lead">Use suas credenciais para acessar o painel.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="username">Usuário</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu.usuario"
                required
                className="login-input"
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">Senha</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="login-input"
              />
            </div>

            <div className="login-field">
              <label htmlFor="clienteId">Cliente ID</label>
              <input
                id="clienteId"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                placeholder="Ex.: 1"
                required
                className="login-input"
              />
            </div>

            <button type="submit" disabled={loading} className="login-submit">
              {loading ? (
                <>
                  <span className="login-spinner" aria-hidden="true" />
                  Entrando…
                </>
              ) : (
                "Acessar"
              )}
            </button>
          </form>

          <p className="login-foot">Macchips · Radar Trabalhista</p>
        </main>
      </div>
    </div>
  );
}
