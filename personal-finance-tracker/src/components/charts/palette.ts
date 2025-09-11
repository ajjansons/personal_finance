// Modern futuristic color palette with gradients and neon accents
export const PALETTE = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#8b5cf6', // Violet
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#eab308', // Yellow
];

// Gradient variants for enhanced visuals
export const GRADIENT_PALETTE = [
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
  'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
  'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
  'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
];

export function colorAt(i: number) {
  return PALETTE[i % PALETTE.length];
}

export function gradientAt(i: number) {
  return GRADIENT_PALETTE[i % GRADIENT_PALETTE.length];
}

// Chart theme configuration
export const CHART_THEME = {
  background: 'rgba(15, 23, 42, 0.95)',
  gridColor: 'rgba(148, 163, 184, 0.1)',
  textColor: '#94a3b8',
  tooltipBg: 'rgba(30, 41, 59, 0.95)',
  tooltipBorder: 'rgba(148, 163, 184, 0.2)',
};
