/** Cores de risco no tema escuro */
export const THEME = {
  bg: '#0f172a',
  panel: '#1e293b',
  border: '#334155',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  blue: '#3b82f6',
  yellow: '#f59e0b',
  red: '#ef4444',
  green: '#22c55e',
  purple: '#a855f7',
};

/** @param {'Alto'|'Médio'|'Baixo'|string} nivel */
export function corRisco(nivel) {
  switch (nivel) {
    case 'Alto':
      return {
        bg: 'rgba(239, 68, 68, 0.15)',
        text: THEME.red,
        border: 'rgba(239, 68, 68, 0.4)',
      };
    case 'Médio':
      return {
        bg: 'rgba(245, 158, 11, 0.15)',
        text: THEME.yellow,
        border: 'rgba(245, 158, 11, 0.4)',
      };
    case 'Baixo':
    default:
      return {
        bg: 'rgba(34, 197, 94, 0.15)',
        text: THEME.green,
        border: 'rgba(34, 197, 94, 0.4)',
      };
  }
}
