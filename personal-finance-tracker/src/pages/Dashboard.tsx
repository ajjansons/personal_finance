import Card from '@/components/ui/Card';
import AllocationPie from '@/components/charts/AllocationPie';
import TotalValueLine from '@/components/charts/TotalValueLine';
import CategoryBar from '@/components/charts/CategoryBar';
import { useHoldings } from '@/hooks/useHoldings';
import { useCategories } from '@/hooks/useCategories';
import { computeAllocationsByType, computeAllocationsByCategory, computePortfolioSeries } from '@/lib/calculations';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { formatEur } from '@/lib/utils/date';

export default function Dashboard() {
  const { data: holdings = [] } = useHoldings();
  const { data: categories = [] } = useCategories();
  const { data: pricePoints = [] } = usePriceHistory();

  const byHolding = holdings
    .filter(h => !h.isDeleted)
    .map(h => ({ name: h.name, value: h.units * h.pricePerUnit }));
  const byType = computeAllocationsByType(holdings);
  const byCat = computeAllocationsByCategory(holdings, categories);
  const series = computePortfolioSeries(holdings, pricePoints);

  const total = holdings.reduce((s, h) => s + h.units * h.pricePerUnit, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Total Value</h2>
        <div className="text-2xl font-bold mb-4">{formatEur(total)}</div>
        <h3 className="font-medium mb-2">Allocation by Holding</h3>
        <AllocationPie data={byHolding} />
      </Card>
      <Card>
        <h3 className="font-medium mb-2">Allocation by Type</h3>
        <AllocationPie data={byType} />
      </Card>
      <Card>
        <h3 className="font-medium mb-2">Portfolio Value Over Time</h3>
        <TotalValueLine data={series} />
      </Card>
      <Card>
        <h3 className="font-medium mb-2">Value by Category</h3>
        <CategoryBar data={byCat.map(c => ({ name: c.name, value: c.value }))} />
      </Card>
    </div>
  );
}
