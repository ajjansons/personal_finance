import { useMemo, useState, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
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

  // Note dialog state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteHoldingId, setNoteHoldingId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);

  // Alert dialog state
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [alertHoldingId, setAlertHoldingId] = useState<string | null>(null);
  const [alertType, setAlertType] = useState<'price_above' | 'price_below'>('price_above');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSaving, setAlertSaving] = useState(false);

  // Success message state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const latestInsightRecord = insightRecords[0];

  const handleSaveNote = useCallback(async () => {
    if (!noteHoldingId) return;
    const trimmed = noteText.trim();
    if (!trimmed) {
      setNoteError('Please enter a note before saving.');
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    try {
      await appendNote({ holdingId: noteHoldingId, text: trimmed });
      setNoteDialogOpen(false);
      setNoteText('');
      setNoteHoldingId(null);
      setSuccessMessage('Note added successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      setNoteError(error?.message ?? 'Failed to add note.');
    } finally {
      setNoteSaving(false);
      setInsightActionBusyKey(null);
    }
  }, [appendNote, noteHoldingId, noteText]);

  const handleCreateAlert = useCallback(async () => {
    if (!alertHoldingId) return;
    const price = Number(alertPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setAlertError('Please enter a valid positive price.');
      return;
    }
    setAlertSaving(true);
    setAlertError(null);
    try {
      await repo.createPriceAlert({
        holdingId: alertHoldingId,
        rule: { type: alertType, price, currency: displayCurrency }
      });
      setAlertDialogOpen(false);
      setAlertPrice('');
      setAlertHoldingId(null);
      setSuccessMessage('Price alert created successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: any) {
      setAlertError(error?.message ?? 'Failed to create alert.');
    } finally {
      setAlertSaving(false);
      setInsightActionBusyKey(null);
    }
  }, [alertHoldingId, alertPrice, alertType, displayCurrency, repo]);

  const handleInsightAction = useCallback(
    async (action: InsightAction, item: InsightItem) => {
      if (!item.holdingId) {
        setSuccessMessage("This insight is not linked to a specific holding.");
        setTimeout(() => setSuccessMessage(null), 3000);
        return;
      }

      const holding = holdings.find((h) => h.id === item.holdingId);
      const itemKey = item.source.url || item.title;
      const actionKey = itemKey + "-" + action.action;

      if (action.action === "add_note") {
        const preset = typeof (action.payload as any)?.text === "string" ? (action.payload as any).text : "";
        setNoteHoldingId(item.holdingId);
        setNoteText(preset);
        setNoteError(null);
        setNoteDialogOpen(true);
        setInsightActionBusyKey(actionKey);
        return;
      }

      if (action.action === "set_alert") {
        setAlertHoldingId(item.holdingId);
        setAlertPrice(holding && Number.isFinite(holding.pricePerUnit) ? `${holding.pricePerUnit}` : '');
        setAlertType('price_below'); // Default to "below" for negative news
        setAlertError(null);
        setAlertDialogOpen(true);
        setInsightActionBusyKey(actionKey);
        return;
      }

      if (action.action === "rebalance") {
        setSuccessMessage("Navigate to Holdings page and use 'Suggest rebalance' to review allocation.");
        setTimeout(() => setSuccessMessage(null), 5000);
        return;
      }

      if (action.action === "open_research") {
        setSuccessMessage("Navigate to Holdings page to generate detailed research reports.");
        setTimeout(() => setSuccessMessage(null), 5000);
        return;
      }

      setSuccessMessage("This action will be available soon.");
      setTimeout(() => setSuccessMessage(null), 3000);
    },
    [holdings]
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

  const noteHolding = holdings.find((h) => h.id === noteHoldingId);
  const alertHolding = holdings.find((h) => h.id === alertHoldingId);

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

      {successMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300 text-sm animate-fade-in">
          {successMessage}
        </div>
      )}

      <InsightsCard
        record={latestInsightRecord}
        isLoading={insightsLoading && !latestInsightRecord}
        isRefreshing={runInsights.isPending}
        onRefresh={() => runInsights.mutate(undefined)}
        onAction={handleInsightAction}
        busyActionKey={insightActionBusyKey}
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

      {/* Add Note Dialog */}
      <Dialog
        open={noteDialogOpen}
        onOpenChange={(next) => {
          setNoteDialogOpen(next);
          if (!next) {
            setNoteText('');
            setNoteError(null);
            setNoteHoldingId(null);
          }
        }}
        title={noteHolding ? `Add Note - ${noteHolding.name}` : 'Add Note'}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveNote();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="insight-note">Note</Label>
            <textarea
              id="insight-note"
              className="w-full min-h-[100px] resize-y rounded border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              disabled={noteSaving}
              placeholder="Add context about this news that you want to remember..."
              autoFocus
            />
            {noteError && <p className="text-sm text-red-400">{noteError}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNoteDialogOpen(false)} disabled={noteSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={noteSaving}>
              {noteSaving ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Set Alert Dialog */}
      <Dialog
        open={alertDialogOpen}
        onOpenChange={(next) => {
          setAlertDialogOpen(next);
          if (!next) {
            setAlertPrice('');
            setAlertError(null);
            setAlertHoldingId(null);
          }
        }}
        title={alertHolding ? `Set Price Alert - ${alertHolding.name}` : 'Set Price Alert'}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateAlert();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="alert-type">Alert Type</Label>
              <Select
                id="alert-type"
                value={alertType}
                onChange={(e) => setAlertType(e.target.value as 'price_above' | 'price_below')}
                disabled={alertSaving}
              >
                <option value="price_above">Price goes above</option>
                <option value="price_below">Price goes below</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-price">Trigger Price ({displayCurrency})</Label>
              <Input
                id="alert-price"
                type="number"
                min="0"
                step="0.01"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                disabled={alertSaving}
                placeholder="0.00"
                autoFocus
              />
            </div>
          </div>
          {alertError && <p className="text-sm text-red-400">{alertError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAlertDialogOpen(false)} disabled={alertSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={alertSaving}>
              {alertSaving ? 'Creating...' : 'Create Alert'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}









