import { Category, Holding, PricePoint, Transaction, FiatCurrency } from './repository/types';
import { convert } from './fx/twelveDataFx';

export type QuoteLike = {
  price: number;
  currency: FiatCurrency;
};

export type HoldingValuation = {
  holdingId: string;
  holdingCurrency: FiatCurrency;
  targetCurrency: FiatCurrency;
  unitPriceHolding: number | null;
  unitPriceTarget: number | null;
  currentValueHolding: number;
  currentValueTarget: number;
  costBasisHolding: number;
  costBasisTarget: number;
  gainHolding: number;
  gainTarget: number;
  gainPercent: number | null;
  usedQuote: boolean;
};

export function normalizeCurrency(code: string | undefined): FiatCurrency {
  return code && code.toUpperCase() === 'USD' ? 'USD' : 'EUR';
}

export function calcHoldingCostBasis(holding: Holding): number {
  if (typeof holding.buyValue === 'number' && isFinite(holding.buyValue)) {
    return holding.buyValue;
  }
  return (holding.units || 0) * (holding.pricePerUnit || 0);
}

export function calcMarketValue(h: Holding): number {
  // Current value policy:
  // - For cash/real_estate: treat current value as the amount itself (buyValue or units*pricePerUnit)
  // - For other assets: current = shares * current pricePerUnit (ignore any stale currentValue)
  if (h.type === 'cash' || h.type === 'real_estate') {
    const val = calcHoldingCostBasis(h);
    return val;
  }
  return h.units * h.pricePerUnit;
}

export type AllocationOptions = {
  targetCurrency?: FiatCurrency;
  usdToEurRate?: number;
  quotes?: Record<string, QuoteLike | undefined>;
};

export function computeHoldingValuation(
  holding: Holding,
  options?: { quote?: QuoteLike | null; targetCurrency?: FiatCurrency; usdToEurRate?: number }
): HoldingValuation {
  const targetCurrency = options?.targetCurrency ?? 'EUR';
  const usdToEurRate = options?.usdToEurRate && options.usdToEurRate > 0 ? options.usdToEurRate : 1;
  const holdingCurrency = normalizeCurrency(holding.currency);
  const units = holding.units || 0;
  const baselinePrice = holding.pricePerUnit || 0;
  const costBasisHolding = calcHoldingCostBasis(holding);
  const costBasisTarget = convert(costBasisHolding, holdingCurrency, targetCurrency, usdToEurRate);

  if (holding.type === 'cash' || holding.type === 'real_estate') {
    const currentValueHolding = costBasisHolding;
    const currentValueTarget = convert(currentValueHolding, holdingCurrency, targetCurrency, usdToEurRate);
    return {
      holdingId: holding.id,
      holdingCurrency,
      targetCurrency,
      unitPriceHolding: null,
      unitPriceTarget: null,
      currentValueHolding,
      currentValueTarget,
      costBasisHolding,
      costBasisTarget,
      gainHolding: currentValueHolding - costBasisHolding,
      gainTarget: currentValueTarget - costBasisTarget,
      gainPercent: costBasisHolding > 0 ? ((currentValueHolding - costBasisHolding) / costBasisHolding) * 100 : null,
      usedQuote: false
    };
  }

  if (units <= 0) {
    return {
      holdingId: holding.id,
      holdingCurrency,
      targetCurrency,
      unitPriceHolding: baselinePrice,
      unitPriceTarget: convert(baselinePrice, holdingCurrency, targetCurrency, usdToEurRate),
      currentValueHolding: 0,
      currentValueTarget: 0,
      costBasisHolding,
      costBasisTarget,
      gainHolding: -costBasisHolding,
      gainTarget: -costBasisTarget,
      gainPercent: costBasisHolding > 0 ? (-costBasisHolding / costBasisHolding) * 100 : null,
      usedQuote: false
    };
  }

  let priceHolding = baselinePrice;
  let usedQuote = false;
  const quote = options?.quote;
  if (quote && isFinite(quote.price) && quote.price > 0) {
    const converted = convert(quote.price, quote.currency, holdingCurrency, usdToEurRate);
    if (isFinite(converted) && converted > 0) {
      priceHolding = converted;
      usedQuote = true;
    }
  }

  const currentValueHolding = priceHolding * units;
  const currentValueTarget = convert(currentValueHolding, holdingCurrency, targetCurrency, usdToEurRate);
  const unitPriceTarget = convert(priceHolding, holdingCurrency, targetCurrency, usdToEurRate);
  return {
    holdingId: holding.id,
    holdingCurrency,
    targetCurrency,
    unitPriceHolding: priceHolding,
    unitPriceTarget,
    currentValueHolding,
    currentValueTarget,
    costBasisHolding,
    costBasisTarget,
    gainHolding: currentValueHolding - costBasisHolding,
    gainTarget: currentValueTarget - costBasisTarget,
    gainPercent: costBasisHolding > 0 ? ((currentValueHolding - costBasisHolding) / costBasisHolding) * 100 : null,
    usedQuote
  };
}

export function computeAllocationsByType(holdings: Holding[], options?: AllocationOptions) {
  const targetCurrency = options?.targetCurrency ?? 'EUR';
  const usdToEurRate = options?.usdToEurRate && options.usdToEurRate > 0 ? options.usdToEurRate : 1;
  const quoteMap = options?.quotes ?? {};
  const byType = new Map<string, { value: number }>();
  let total = 0;

  holdings.forEach((holding) => {
    if (holding.isDeleted) return;
    const key = `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
    const valuation = computeHoldingValuation(holding, {
      quote: quoteMap[key],
      targetCurrency,
      usdToEurRate
    });
    total += valuation.currentValueTarget;
    byType.set(holding.type, {
      value: (byType.get(holding.type)?.value || 0) + valuation.currentValueTarget
    });
  });

  return Array.from(byType.entries()).map(([name, entry]) => ({
    name,
    value: entry.value,
    percent: total ? entry.value / total : 0
  }));
}

export function computeAllocationsByCategory(
  holdings: Holding[],
  categories: Category[],
  options?: AllocationOptions
) {
  const targetCurrency = options?.targetCurrency ?? 'EUR';
  const usdToEurRate = options?.usdToEurRate && options.usdToEurRate > 0 ? options.usdToEurRate : 1;
  const quoteMap = options?.quotes ?? {};
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = new Map<string, { value: number }>();
  let total = 0;

  holdings.forEach((holding) => {
    if (holding.isDeleted) return;
    const catName = nameById.get(holding.categoryId || '') || 'Uncategorized';
    const key = `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
    const valuation = computeHoldingValuation(holding, {
      quote: quoteMap[key],
      targetCurrency,
      usdToEurRate
    });
    total += valuation.currentValueTarget;
    byCategory.set(catName, {
      value: (byCategory.get(catName)?.value || 0) + valuation.currentValueTarget
    });
  });

  return Array.from(byCategory.entries()).map(([name, entry]) => ({
    name,
    value: entry.value,
    percent: total ? entry.value / total : 0
  }));
}

type QuoteMap = Record<string, QuoteLike | undefined>;

export function computePortfolioSeries(
  holdings: Holding[],
  pricePoints: PricePoint[],
  transactions: Transaction[],
  options?: { targetCurrency?: FiatCurrency; usdToEurRate?: number; quotes?: QuoteMap }
) {
  const active = holdings.filter((h) => !h.isDeleted);
  if (active.length === 0) return [] as { date: string; total: number }[];

  const targetCurrency = options?.targetCurrency ?? 'EUR';
  const usdToEurRate = options?.usdToEurRate && options.usdToEurRate > 0 ? options.usdToEurRate : 1;
  const quoteMap = options?.quotes ?? {};

  // Price history per holding
  const pricesByHolding = new Map<string, PricePoint[]>();
  for (const point of pricePoints) {
    if (!pricesByHolding.has(point.holdingId)) pricesByHolding.set(point.holdingId, []);
    pricesByHolding.get(point.holdingId)!.push(point);
  }
  for (const [, list] of pricesByHolding) list.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  // Transactions per holding (used when present to show unit changes)
  const txByHolding = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!txByHolding.has(t.holdingId)) txByHolding.set(t.holdingId, []);
    txByHolding.get(t.holdingId)!.push(t);
  }
  for (const [, list] of txByHolding) list.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const today = new Date().toISOString().slice(0, 10);

  // relevant dates (price points, transactions, purchase dates, today)
  const dateSet = new Set<string>();
  for (const point of pricePoints) dateSet.add(point.dateISO);
  for (const tx of transactions) dateSet.add(tx.dateISO);
  for (const holding of active) {
    dateSet.add(holding.purchaseDate);
    if (holding.updatedAt) dateSet.add(holding.updatedAt.slice(0, 10));
  }
  dateSet.add(today);
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return [];

  function resolveQuotePrice(holding: Holding): number | undefined {
    const key = `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
    const snapshot = quoteMap[key];
    if (!snapshot) return undefined;
    const holdingCurrency = normalizeCurrency(holding.currency);
    return convert(snapshot.price, snapshot.currency, holdingCurrency, usdToEurRate);
  }

  function resolvePriceForDate(holding: Holding, date: string): number {
    if (holding.type === 'cash' || holding.type === 'real_estate') return 1;
    const history = pricesByHolding.get(holding.id) || [];
    // locate last known price <= date
    let price: number | undefined;
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].dateISO <= date) {
        price = history[i].pricePerUnit;
        break;
      }
    }
    if (price == null && date >= today) {
      price = resolveQuotePrice(holding);
    }
    if (price == null) {
      price = holding.pricePerUnit;
    }
    return price;
  }

  const transactionsCache = new Map<string, Transaction[]>();
  for (const holding of active) {
    const txs = (txByHolding.get(holding.id) || []).filter((tx) => tx.dateISO >= holding.purchaseDate);
    transactionsCache.set(holding.id, txs);
  }

  const series = dates.map((date) => {
    const total = active.reduce((accum, holding) => {
      if (date < holding.purchaseDate) return accum;
      const holdingCurrency = normalizeCurrency(holding.currency);
      const txs = transactionsCache.get(holding.id) || [];
      let valueHolding = 0;
      const isAmount = holding.type === 'cash' || holding.type === 'real_estate';

      if (txs.length > 0) {
        let units = 0;
        for (const tx of txs) {
          if (tx.dateISO <= date) {
            units += tx.deltaUnits || 0;
          } else {
            break;
          }
        }
        if (units <= 0) return accum;
        if (isAmount) {
          valueHolding = units;
        } else {
          const price = resolvePriceForDate(holding, date);
          valueHolding = units * price;
        }
      } else {
        if (isAmount) {
          valueHolding = calcHoldingCostBasis(holding);
        } else {
          const price = resolvePriceForDate(holding, date);
          valueHolding = (holding.units || 0) * price;
        }
      }

      const converted = convert(valueHolding, holdingCurrency, targetCurrency, usdToEurRate);
      return accum + converted;
    }, 0);

    return { date, total: Number(total.toFixed(2)) };
  });

  if (series.length > 0) {
    const latestTotal = holdings.reduce((sum, holding) => {
      if (holding.isDeleted) return sum;
      const quoteKey = `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
      const quote = quoteMap[quoteKey];
      const valuation = computeHoldingValuation(holding, {
        quote,
        targetCurrency,
        usdToEurRate
      });
      return sum + valuation.currentValueTarget;
    }, 0);

    const normalizedLatest = Number(latestTotal.toFixed(2));
    const lastIndex = series.length - 1;
    const lastDate = series[lastIndex].date;
    if (lastDate >= today) {
      series[lastIndex] = { date: lastDate, total: normalizedLatest };
    } else {
      series.push({ date: today, total: normalizedLatest });
    }
  }

  return series;
}
