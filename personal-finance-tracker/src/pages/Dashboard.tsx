import { useMemo, useState, useCallback } from 'react';
import Card from '@/components/ui/Card';
import InsightsCard from '@/components/insights/InsightsCard';
import { useInsights, useRunInsights } from '@/hooks/useInsights';
import { getRepository } from '@/lib/repository';
import type { InsightAction, InsightItem } from '@/lib/repository/types';

import AllocationPie from '@/components/charts/AllocationPie';
import TotalValueLine from '@/components/charts/TotalValueLine';
import CategoryBar from '@/components/charts/CategoryBar';
import { useHoldings } from '@/hooks/useHoldings';
import { useCategories } from '@/hooks/useCategories';
import { computeHoldingValuation, computePortfolioSeries, QuoteLike } from '@/lib/calculations';
import { usePriceHistory } from '@/hooks/usePriceHistory';
import { formatCurrency } from '@/lib/utils/date';
import { useTransactions } from '@/hooks/useTransactions';
import { useUsdEurRate } from '@/lib/fx/twelveDataFx';
import { useUIStore } from '@/lib/state/uiStore';
import CurrencyToggle from '@/components/ui/CurrencyToggle';
import { useQuotes } from '@/hooks/useQuotes';

export default function Dashboard() {
  const { data: holdings = [], appendNote } = useHoldings();
  const { data: categories = [] } = useCategories();
  const { data: pricePoints = [] } = usePriceHistory();
  const { data: transactions = [] } = useTransactions();
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  const { rate } = useUsdEurRate();
  const { quotes } = useQuotes(holdings);
  const { data: insightRecords = [], isLoading: insightsLoading } = useInsights({ limit: 1 });
  const runInsights = useRunInsights();
  const repo = useMemo(() => getRepository(), []);
  const [insightActionBusyKey, setInsightActionBusyKey] = useState<string | null>(null);

  const latestInsightRecord = insightRecords[0];
  const handleInsightAction = useCallback(
    async (action: InsightAction, item: InsightItem) => {
      if (!item.holdingId) {
        window.alert("This insight is not linked to a specific holding yet.");
        return;
      }

      const holding = holdings.find((h) => h.id === item.holdingId);
      const itemKey = item.source.url || item.title;
      const actionKey = itemKey + "-" + action.action;

      try {
        if (action.action === "add_note") {
          const preset =
            typeof (action.payload as any)?.text === "string" ? (action.payload as any).text : "";
          const noteInput = window.prompt(
            `Add a note for ${holding?.name ?? "this holding"}`,
            preset
          );
          if (!noteInput || !noteInput.trim()) {
            return;
          }
          setInsightActionBusyKey(actionKey);
          await appendNote({ holdingId: item.holdingId, text: noteInput.trim() });
          window.alert("Note added to holding.");
          return;
        }

        if (action.action === "set_alert") {
          const priceInput = window.prompt(
            `Set an alert price for ${holding?.name ?? "this holding"}`,
            holding && Number.isFinite(holding.pricePerUnit) ? `${holding.pricePerUnit}` : ""
          );
          if (!priceInput) {
            return;
          }
          const parsed = Number(priceInput);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            window.alert("Enter a valid positive price.");
            return;
          }
          const triggerAbove = window.confirm("Trigger when price goes ABOVE this level? (Cancel for BELOW)");
          const currencyCandidate = (holding?.currency || displayCurrency).toUpperCase();
          const currency: "USD" | "EUR" = currencyCandidate === "USD" ? "USD" : "EUR";
          setInsightActionBusyKey(actionKey);
          await repo.createPriceAlert({
            holdingId: item.holdingId,
            rule: { type: triggerAbove ? "price_above" : "price_below", price: parsed, currency }
          });
          window.alert("Price alert saved locally.");
          return;
        }

        if (action.action === "rebalance") {
          window.alert("Open the Holdings page and use \"Suggest rebalance\" for this holding to review the plan.");
          return;
        }

        if (action.action === "open_research") {
          window.alert("Use the Research action on the Holdings page to generate a deep report.");
          return;
        }

        window.alert("This action will be available soon.");
      } catch (error) {
        console.error("[dashboard] insight action failed", error);
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`Action failed: ${message}`);
      } finally {
        setInsightActionBusyKey(null);
      }
    },
    [appendNote, displayCurrency, holdings, repo]
  );

  const activeHoldings = useMemo(() => holdings.filter((holding) => !holding.isDeleted), [holdings]);

  const quoteMap = useMemo(() => {
    const map: Record<string, QuoteLike> = {};
    Object.entries(quotes).forEach(([key, quote]) => {
      if (quote && Number.isFinite(quote.price)) {
        map[key] = { price: quote.price, currency: quote.currency };
      }
    });
    return map;
  }, [quotes]);

  const valuations = useMemo(() => {
    return activeHoldings.map((holding) => {
      const quoteKey = `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
      const quote = quoteMap[quoteKey];
      const valuation = computeHoldingValuation(holding, {
        quote,
        targetCurrency: displayCurrency,
        usdToEurRate: rate
      });
      return { holding, valuation };
    });
  }, [activeHoldings, quoteMap, displayCurrency, rate]);

  const totalValue = useMemo(
    () => valuations.reduce((sum, item) => sum + item.valuation.currentValueTarget, 0),
    [valuations]
  );

  const byHolding = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    valuations.forEach(({ holding, valuation }) => {
      const key = `${holding.name}|${(holding.symbol || '').toUpperCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.value += valuation.currentValueTarget;
      } else {
        map.set(key, { name: holding.name, value: valuation.currentValueTarget });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [valuations]);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    valuations.forEach(({ holding, valuation }) => {
      map.set(holding.type, (map.get(holding.type) || 0) + valuation.currentValueTarget);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [valuations]);

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    valuations.forEach(({ holding, valuation }) => {
      const key = categoryNames.get(holding.categoryId || '') || 'Uncategorized';
      map.set(key, (map.get(key) || 0) + valuation.currentValueTarget);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [valuations, categoryNames]);

  const series = useMemo(
    () =>
      computePortfolioSeries(holdings, pricePoints, transactions || [], {
        targetCurrency: displayCurrency,
        usdToEurRate: rate,
        quotes: quoteMap
      }),
    [holdings, pricePoints, transactions, displayCurrency, rate, quoteMap]
  );

  return (
    <div className='space-y-8'>
      <div className='text-center space-y-4'>
        <h1 className='text-4xl font-bold gradient-text'>Portfolio Dashboard</h1>
        <div className='glass-card inline-block px-8 py-4'>
          <div className='text-sm text-slate-400 mb-1'>Total Portfolio Value</div>
          <div className='text-3xl font-bold text-slate-100'>{formatCurrency(totalValue, displayCurrency)}</div>
          <div className='mt-2'>
            <CurrencyToggle />
          </div>
        </div>
      </div>

      <InsightsCard
        record={latestInsightRecord}
        isLoading={insightsLoading && !latestInsightRecord}
        isRefreshing={runInsights.isPending}
        onRefresh={() => runInsights.mutate(undefined)}
      />
      <div className='grid gap-6 md:grid-cols-2 lg:gap-8'>
        <Card className='relative overflow-hidden'>
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-lg font-semibold text-slate-100'>Allocation by Holding</h3>
            <div className='w-2 h-2 bg-blue-500 rounded-full animate-pulse' />
          </div>
          <AllocationPie data={byHolding} />
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-lg font-semibold text-slate-100'>Allocation by Type</h3>
            <div className='w-2 h-2 bg-emerald-500 rounded-full animate-pulse' />
          </div>
          <AllocationPie data={byType} />
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-lg font-semibold text-slate-100'>Portfolio Value Over Time</h3>
            <div className='w-2 h-2 bg-violet-500 rounded-full animate-pulse' />
          </div>
          <TotalValueLine data={series} />
        </Card>

        <Card className='relative overflow-hidden'>
          <div className='flex items-center justify-between mb-6'>
            <h3 className='text-lg font-semibold text-slate-100'>Value by Category</h3>
            <div className='w-2 h-2 bg-amber-500 rounded-full animate-pulse' />
          </div>
          <CategoryBar data={byCategory} />
        </Card>
      </div>
    </div>
  );
}









