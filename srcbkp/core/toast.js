// src/core/toast.js

let _root = null;

function getRoot() {
  if (!_root) _root = document.getElementById("toastRoot");
  return _root;
}

export const Toast = {
  /**
   * @param {string} msg
   * @param {'s'|'e'|'w'|'i'} type s=success e=error w=warning i=info
   * @param {number} dur ms (0 = nao fecha sozinho)
   * @returns {HTMLElement | null} elemento do toast
   */
  show(msg, type = "i", dur = 3000) {
    const root = getRoot();
    if (!root) return null;

    const el = document.createElement("div");
    el.className = `toast ${type}`;

    const text = document.createElement("span");
    text.className = "toast-msg";
    text.textContent = String(msg || "");

    const close = document.createElement("button");
    close.className = "toast-x";
    close.type = "button";
    close.setAttribute("aria-label", "Fechar");
    close.textContent = "x";

    el.append(text, close);
    close.addEventListener("click", () => this.close(el));
    root.appendChild(el);

    if (dur > 0) {
      setTimeout(() => this.close(el), dur);
    }
    return el;
  },

  close(el) {
    if (!el || !el.parentNode) return;
    el.style.opacity = "0";
    el.style.transition = "opacity .22s";
    setTimeout(() => el.parentNode?.removeChild(el), 220);
  },
};
