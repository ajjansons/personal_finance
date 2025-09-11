import Card from '@/components/ui/Card';
import AllocationPie from '@/components/charts/AllocationPie';
import TotalValueLine from '@/components/charts/TotalValueLine';
import CategoryBar from '@/components/charts/CategoryBar';
import { useHoldings } from '@/hooks/useHoldings';
import { useCategories } from '@/hooks/useCategories';
import { computeAllocationsByType, computeAllocationsByCategory, computePortfolioSeries, calcMarketValue } from '@/lib/calculations';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { formatEur } from '@/lib/utils/date';

export default function Dashboard() {
  const { data: holdings = [] } = useHoldings();
  const { data: categories = [] } = useCategories();
  const { data: pricePoints = [] } = usePriceHistory();

  // Aggregate by investment (name + symbol) to combine multiple buys
  const byHoldingMap = new Map<string, { name: string; value: number }>();
  holdings.filter(h => !h.isDeleted).forEach(h => {
    const key = `${h.name}|${h.symbol || ''}`;
    const value = calcMarketValue(h);
    const existing = byHoldingMap.get(key);
    if (existing) {
      existing.value += value;
    } else {
      byHoldingMap.set(key, { name: h.name, value });
    }
  });
  const byHolding = Array.from(byHoldingMap.values());
  const byType = computeAllocationsByType(holdings);
  const byCat = computeAllocationsByCategory(holdings, categories);
  const series = computePortfolioSeries(holdings, pricePoints);

  const total = holdings.reduce((s, h) => s + calcMarketValue(h), 0);

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold gradient-text">Portfolio Dashboard</h1>
        <div className="glass-card inline-block px-8 py-4">
          <div className="text-sm text-slate-400 mb-1">Total Portfolio Value</div>
          <div className="text-3xl font-bold text-slate-100">{formatEur(total)}</div>
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
