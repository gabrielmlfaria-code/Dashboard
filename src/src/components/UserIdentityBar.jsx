import { Auth } from "../core/auth.js";

function getInitials(label) {
  const text = String(label || "").trim();
  if (!text) return "?";
  const parts = text.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Barra de identidade exibida inline na topbar: Empresa · Filial · Usuário + Sair.
 * Lê os dados do usuário logado via Auth.getUserInfo().
 *
 * A filial é "fixa do usuário": passe via prop `filial` ou popule `userInfo.filial`
 * no login (normalizeUserInfo). Enquanto não houver valor, mostra "—".
 */
export function UserIdentityBar({ filial: filialProp, onLogout } = {}) {
  // Placeholders de integração (visíveis para o dev de backend).
  // Para ligar aos dados reais do /me, troque cada rótulo pelo campo indicado:
  //   Empresa  → Auth.getUserInfo()?.cliente
  //   Usuário  → Auth.getUserInfo()?.name (ou .username)
  //   Filial   → Auth.getUserInfo()?.filial
  const empresa = "Empresa da API";
  const usuario = "Usuário da API";
  const filial = filialProp || "Filial da API";
  const initials = getInitials(usuario);

  const handleLogout = () => {
    if (onLogout) onLogout();
    else Auth.logout();
  };

  return (
    <div className="pb-ident" role="group" aria-label="Usuário logado">
      <span className="pb-ident-avatar" aria-hidden="true">
        {initials}
      </span>
      <span className="pb-ident-info">
        <span className="pb-ident-line pb-ident-empresa" title={`Empresa: ${empresa}`}>
          <span className="pb-ident-ico" aria-hidden="true">
            🏢
          </span>
          {empresa}
        </span>
        <span className="pb-ident-line pb-ident-meta">
          <span className="pb-ident-filial" title={`Filial: ${filial}`}>
            <span className="pb-ident-ico" aria-hidden="true">
              🏬
            </span>
            {filial}
          </span>
          <span className="pb-ident-dot" aria-hidden="true">
            ·
          </span>
          <span className="pb-ident-user" title={`Usuário: ${usuario}`}>
            {usuario}
          </span>
        </span>
      </span>
      <button
        type="button"
        className="pb-ident-logout"
        onClick={handleLogout}
        title="Sair da conta"
        aria-label="Sair"
      >
        <span className="pb-ident-logout-ico" aria-hidden="true">
          ⎋
        </span>
        Sair
      </button>
    </div>
  );
}

export default UserIdentityBar;
