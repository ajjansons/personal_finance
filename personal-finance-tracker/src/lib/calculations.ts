import { Category, Holding, PricePoint, Transaction } from './repository/types';

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

export function computePortfolioSeries(
  holdings: Holding[],
  pricePoints: PricePoint[],
  transactions: Transaction[]
) {
  const active = holdings.filter((h) => !h.isDeleted);
  if (active.length === 0) return [] as { date: string; total: number }[];

  // Group price points and transactions by holding
  const pricesByHolding = new Map<string, PricePoint[]>();
  for (const p of pricePoints) {
    if (!pricesByHolding.has(p.holdingId)) pricesByHolding.set(p.holdingId, []);
    pricesByHolding.get(p.holdingId)!.push(p);
  }
  for (const [hid, arr] of pricesByHolding) arr.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const txByHolding = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!txByHolding.has(t.holdingId)) txByHolding.set(t.holdingId, []);
    txByHolding.get(t.holdingId)!.push(t);
  }
  for (const [hid, arr] of txByHolding) arr.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  // Build date set from price points, transactions, and purchase dates
  const dateSet = new Set<string>();
  for (const p of pricePoints) dateSet.add(p.dateISO);
  for (const t of transactions) dateSet.add(t.dateISO);
  for (const h of active) {
    dateSet.add(h.purchaseDate);
    // Also include last updated date to reflect manual adjustments even without transactions
    if (h.updatedAt) dateSet.add((h.updatedAt || '').slice(0, 10));
  }
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return [];

  // Helper: price at or before date
  function priceAt(h: Holding, date: string): number {
    if (h.type === 'cash' || h.type === 'real_estate') return 1;
    const arr = pricesByHolding.get(h.id) || [];
    // Binary search last price <= date
    let lo = 0, hi = arr.length - 1, idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].dateISO <= date) { idx = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return idx >= 0 ? arr[idx].pricePerUnit : h.pricePerUnit;
  }

  // Precompute cumulative units per holding as of each date via scanning
  const cumUnitsState = new Map<string, { i: number; dates: string[]; txs: Transaction[]; cum: number }>();
  function unitsAt(h: Holding, date: string): number {
    const isAmount = h.type === 'cash' || h.type === 'real_estate';
    let state = cumUnitsState.get(h.id);
    if (!state) {
      const txs = (txByHolding.get(h.id) || []).slice();
      // If no transactions recorded, create an in-memory baseline at purchaseDate
      if (txs.length === 0) {
        const baseAmount = typeof (h as any).buyValue === 'number' ? (h as any).buyValue : (h.units || 0) * (h.pricePerUnit || 0);
        const baseDelta = isAmount ? baseAmount : (h.units || 0);
        txs.push({ id: 'mem', holdingId: h.id, dateISO: h.purchaseDate, deltaUnits: baseDelta, pricePerUnit: h.pricePerUnit });
      }
      txs.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
      state = { i: 0, dates: Array.from(new Set(txs.map(t => t.dateISO))).sort(), txs, cum: 0 };
      cumUnitsState.set(h.id, state);
    }
    // Advance cumulative up to target date
    while (state.i < state.txs.length && state.txs[state.i].dateISO <= date) {
      state.cum += state.txs[state.i].deltaUnits || 0;
      state.i++;
    }
    return state.cum;
  }

  const series = dates.map((date) => {
    const total = active.reduce((sum, h) => {
      const units = unitsAt(h, date);
      if (units <= 0) return sum;
      const px = priceAt(h, date);
      const value = (h.type === 'cash' || h.type === 'real_estate') ? units : units * px;
      return sum + value;
    }, 0);
    return { date, total: Number(total.toFixed(2)) };
  });

  return series;
}
