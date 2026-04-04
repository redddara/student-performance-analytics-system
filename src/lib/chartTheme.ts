/** Recharts styling for charts drawn on dark maroon GlassCards (white main page background). */
export const chartGrid = {
  strokeDasharray: '3 3' as const,
  stroke: 'rgba(255, 255, 255, 0.18)',
};

export const chartAxis = {
  tick: { fill: 'rgba(255, 255, 255, 0.78)', fontSize: 11 },
  stroke: 'rgba(255, 255, 255, 0.35)',
};

export const chartTooltip = {
  contentStyle: {
    backgroundColor: 'rgba(12, 4, 4, 0.94)',
    border: '1px solid rgba(212, 165, 0, 0.35)',
    borderRadius: '10px',
  },
};

export const chartLegend = {
  wrapperStyle: { color: 'rgba(255, 255, 255, 0.85)', fontSize: 12 },
};
