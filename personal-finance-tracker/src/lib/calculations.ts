import { Category, Holding, PricePoint } from './repository/types';

export function calcMarketValue(h: Holding): number {
  return h.units * h.pricePerUnit;
}

export function computeAllocationsByType(holdings: Holding[]) {
  const total = holdings.filter(h => !h.isDeleted).reduce((s, h) => s + calcMarketValue(h), 0);
  const byType = new Map<string, number>();
  holdings.forEach((h) => {
    if (h.isDeleted) return;
    byType.set(h.type, (byType.get(h.type) || 0) + calcMarketValue(h));
  });
  return Array.from(byType.entries()).map(([name, value]) => ({
    name,
    value,
    percent: total ? value / total : 0
  }));
}

export function computeAllocationsByCategory(holdings: Holding[], categories: Category[]) {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const total = holdings.filter(h => !h.isDeleted).reduce((s, h) => s + calcMarketValue(h), 0);
  const agg = new Map<string, number>();
  holdings.forEach((h) => {
    if (h.isDeleted) return;
    const key = nameById.get(h.categoryId || '') || 'Uncategorized';
    agg.set(key, (agg.get(key) || 0) + calcMarketValue(h));
  });
  return Array.from(agg.entries()).map(([name, value]) => ({ name, value, percent: total ? value / total : 0 }));
}

export function computePortfolioSeries(holdings: Holding[], _pricePoints: PricePoint[]) {
  // Build time series based on purchaseDate
  const active = holdings.filter((h) => !h.isDeleted);
  if (active.length === 0) return [] as { date: string; total: number }[];
  // Get unique dates from purchaseDate
  const dates = Array.from(new Set(active.map((h) => h.purchaseDate))).sort();
  // If only one date, still render one point
  return dates.map((date) => {
    const total = active.reduce((s, h) => (h.purchaseDate <= date ? s + h.units * h.pricePerUnit : s), 0);
    return { date, total };
  });
}
