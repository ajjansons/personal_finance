import Card from '@/components/ui/Card';
import AllocationPie from '@/components/charts/AllocationPie';
import TotalValueLine from '@/components/charts/TotalValueLine';
import CategoryBar from '@/components/charts/CategoryBar';
import { useHoldings } from '@/hooks/useHoldings';
import { useCategories } from '@/hooks/useCategories';
import { computePortfolioSeries, calcMarketValue } from '@/lib/calculations';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { formatCurrency } from '@/lib/utils/date';
import { useTransactions } from '@/hooks/useTransactions';
import { useUsdEurRate, convert } from '@/lib/fx/twelveDataFx';
import { useUIStore } from '@/lib/state/uiStore';
import CurrencyToggle from '@/components/ui/CurrencyToggle';
import { useQuotes } from '@/hooks/useQuotes';

export default function Dashboard() {
  const { data: holdings = [] } = useHoldings();
  const { data: categories = [] } = useCategories();
  const { data: pricePoints = [] } = usePriceHistory();
  const { data: transactions = [] } = useTransactions();
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  const { rate } = useUsdEurRate();
  const { quotes } = useQuotes(holdings);

  // Aggregate by investment (name + symbol) to combine multiple buys
  const byHoldingMap = new Map<string, { name: string; value: number }>();
  holdings.filter(h => !h.isDeleted).forEach(h => {
    const key = `${h.name}|${h.symbol || ''}`;
    let valueBase = 0;
    if (h.type === 'cash' || h.type === 'real_estate') {
      valueBase = calcMarketValue(h);
    } else {
      const qKey = `${h.type}:${(h.symbol || '').toUpperCase()}`;
      const q = quotes[qKey];
      if (q && isFinite(q.price)) {
        const liveVal = (h.units || 0) * q.price;
        valueBase = convert(liveVal, q.currency, displayCurrency, rate);
      } else {
        const base = calcMarketValue(h);
        const from = (h.currency === 'USD' ? 'USD' : 'EUR') as 'USD' | 'EUR';
        valueBase = convert(base, from, displayCurrency, rate);
      }
    }
    const value = valueBase;
    const existing = byHoldingMap.get(key);
    if (existing) {
      existing.value += value;
    } else {
      byHoldingMap.set(key, { name: h.name, value });
    }
  });
  const byHolding = Array.from(byHoldingMap.values());
  // by type
  const byTypeMap = new Map<string, number>();
  holdings.filter(h => !h.isDeleted).forEach(h => {
    let baseVal = 0;
    if (h.type === 'cash' || h.type === 'real_estate') {
      baseVal = convert(calcMarketValue(h), (h.currency === 'USD' ? 'USD' : 'EUR') as any, displayCurrency, rate);
    } else {
      const qKey = `${h.type}:${(h.symbol || '').toUpperCase()}`;
      const q = quotes[qKey];
      if (q && isFinite(q.price)) {
        const liveVal = (h.units || 0) * q.price;
        baseVal = convert(liveVal, q.currency, displayCurrency, rate);
      } else {
        const base = calcMarketValue(h);
        baseVal = convert(base, (h.currency === 'USD' ? 'USD' : 'EUR') as any, displayCurrency, rate);
      }
    }
    byTypeMap.set(h.type, (byTypeMap.get(h.type) || 0) + baseVal);
  });
  const byType = Array.from(byTypeMap.entries()).map(([name, value]) => ({ name, value }));
  // by category
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const byCatMap = new Map<string, number>();
  holdings.filter(h => !h.isDeleted).forEach(h => {
    const key = nameById.get(h.categoryId || '') || 'Uncategorized';
    let baseVal = 0;
    if (h.type === 'cash' || h.type === 'real_estate') {
      baseVal = convert(calcMarketValue(h), (h.currency === 'USD' ? 'USD' : 'EUR') as any, displayCurrency, rate);
    } else {
      const qKey = `${h.type}:${(h.symbol || '').toUpperCase()}`;
      const q = quotes[qKey];
      if (q && isFinite(q.price)) {
        const liveVal = (h.units || 0) * q.price;
        baseVal = convert(liveVal, q.currency, displayCurrency, rate);
      } else {
        const base = calcMarketValue(h);
        baseVal = convert(base, (h.currency === 'USD' ? 'USD' : 'EUR') as any, displayCurrency, rate);
      }
    }
    byCatMap.set(key, (byCatMap.get(key) || 0) + baseVal);
  });
  const byCat = Array.from(byCatMap.entries()).map(([name, value]) => ({ name, value }));
  const series = computePortfolioSeries(holdings, pricePoints, transactions || []).map(p => ({ ...p, total: convert(p.total, 'EUR', displayCurrency, rate) }));

  const total = holdings.reduce((s, h) => {
    if (h.type === 'cash' || h.type === 'real_estate') {
      return s + convert(calcMarketValue(h), (h.currency === 'USD' ? 'USD' : 'EUR') as any, displayCurrency, rate);
    }
    const qKey = `${h.type}:${(h.symbol || '').toUpperCase()}`;
    const q = quotes[qKey];
    if (q && isFinite(q.price)) {
      const liveVal = (h.units || 0) * q.price;
      return s + convert(liveVal, q.currency, displayCurrency, rate);
    }
    const base = calcMarketValue(h);
    return s + convert(base, (h.currency === 'USD' ? 'USD' : 'EUR') as any, displayCurrency, rate);
  }, 0);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold gradient-text">Portfolio Dashboard</h1>
        <div className="glass-card inline-block px-8 py-4">
          <div className="text-sm text-slate-400 mb-1">Total Portfolio Value</div>
          <div className="text-3xl font-bold text-slate-100">{formatCurrency(total, displayCurrency)}</div>
          <div className="mt-2"><CurrencyToggle /></div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-100">Allocation by Holding</h3>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
          <AllocationPie data={byHolding} />
        </Card>

        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-100">Allocation by Type</h3>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          </div>
          <AllocationPie data={byType} />
        </Card>

        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-100">Portfolio Value Over Time</h3>
            <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse"></div>
          </div>
          <TotalValueLine data={series} />
        </Card>

        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-100">Value by Category</h3>
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          </div>
          <CategoryBar data={byCat.map(c => ({ name: c.name, value: c.value }))} />
        </Card>
      </div>
    </div>
  );
}
