import { THEME } from './riscoColors.js';

export const chartTooltipStyle = {
  contentStyle: {
    background: THEME.panel,
    border: `1px solid ${THEME.border}`,
    borderRadius: 8,
    color: THEME.text,
  },
  itemStyle: { color: THEME.text },
  labelStyle: { color: THEME.textMuted },
};

export const chartAxisTick = { fill: THEME.textMuted, fontSize: 11 };
export const chartLegendStyle = { color: THEME.text };
