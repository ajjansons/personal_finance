import { Category, Holding, PricePoint } from './repository/types';

export function calcMarketValue(h: Holding): number {
  // Current value policy:
  // - For cash/real_estate: treat current value as the amount itself (buyValue or units*pricePerUnit)
  // - For other assets: current = shares * current pricePerUnit (ignore any stale currentValue)
  if (h.type === 'cash' || h.type === 'real_estate') {
    const val = typeof (h as any).buyValue === 'number' ? (h as any).buyValue : h.units * h.pricePerUnit;
    return val;
  }
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
    const total = active.reduce((s, h) => {
      if (h.purchaseDate <= date) {
        return s + calcMarketValue(h);
      }
      return s;
    }, 0);
    return { date, total };
  });
}
