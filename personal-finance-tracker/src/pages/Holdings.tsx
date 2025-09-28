import { useCallback, useEffect, useMemo, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import HoldingForm from '@/components/forms/HoldingForm';
import HoldingsTable from '@/components/tables/HoldingsTable';
import { useHoldings } from '@/hooks/useHoldings';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import CurrencyToggle from '@/components/ui/CurrencyToggle';
import { useQuotes } from '@/hooks/useQuotes';
import { convert, useUsdEurRate } from '@/lib/fx/twelveDataFx';
import { computeHoldingValuation, normalizeCurrency } from '@/lib/calculations';
import { useUIStore } from '@/lib/state/uiStore';
import { formatCurrency } from '@/lib/utils/date';
import type { Holding } from '@/lib/repository/types';
import { useQueryClient } from '@tanstack/react-query';
import { executeToolByName } from '@/ai/tools';
import type { ToolExecutionFailure, ToolExecutionSuccess } from '@/ai/tools';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';

const TYPES = ['stock', 'crypto', 'cash', 'real_estate', 'other'] as const;

type HoldingRowMetrics = Holding & {
  priceDisplay: number | null;
  costBasisDisplay: number;
  currentValueDisplay: number;
  gainDisplay: number;
  gainPercent: number | null;
  holdingCurrency: 'USD' | 'EUR';
  dailyChangePercent?: number;
};

type WhatIfSimulationResult = {
  holdingId: string;
  deltaUnits: number;
  pricePerUnitUsed: number;
  currency: 'USD' | 'EUR';
  before: { holdingValue: number; portfolioValue: number };
  after: { holdingValue: number; portfolioValue: number };
  difference: { holdingValue: number; portfolioValue: number };
};

type RebalanceSuggestion = {
  currency: 'USD' | 'EUR';
  targetWeights: Record<string, number>;
  trades: {
    holdingId: string;
    action: 'buy' | 'sell' | 'hold';
    deltaValue: number;
    deltaUnits: number;
    targetValue: number;
    currentValue: number;
  }[];
  summary: { totalBuy: number; totalSell: number };
};
export default function Holdings() {
  const { data = [], createHolding, updateHolding, softDeleteHolding, appendNote } = useHoldings();
  const { addTransaction } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { quotes, refresh: refreshQuotes } = useQuotes(data);
  const { rate } = useUsdEurRate();
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [adjustingBase, setAdjustingBase] = useState<any | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'remove'>('add');
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [adjustDate, setAdjustDate] = useState<string>(today);
  const [adjustQty, setAdjustQty] = useState<number>(0);
  const [adjustPrice, setAdjustPrice] = useState<number>(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'value' | 'date'>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [explainHolding, setExplainHolding] = useState<HoldingRowMetrics | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [alertType, setAlertType] = useState<'price_above' | 'price_below'>('price_above');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertError, setAlertError] = useState<string | null>(null);
  const [alertSaving, setAlertSaving] = useState(false);
  const { alerts, isLoading: alertsLoading, createAlert, deleteAlert } = usePriceAlerts(explainHolding?.id);

  const [whatIfHolding, setWhatIfHolding] = useState<HoldingRowMetrics | null>(null);
  const [whatIfDelta, setWhatIfDelta] = useState('0');
  const [whatIfPrice, setWhatIfPrice] = useState('');
  const [whatIfResult, setWhatIfResult] = useState<WhatIfSimulationResult | null>(null);
  const [whatIfError, setWhatIfError] = useState<string | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);

  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [rebalanceFocus, setRebalanceFocus] = useState<HoldingRowMetrics | null>(null);
  const [rebalanceResult, setRebalanceResult] = useState<RebalanceSuggestion | null>(null);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [rebalanceLoading, setRebalanceLoading] = useState(false);

  useEffect(() => {
    if (explainHolding) {
      setNoteText('');
      setNoteError(null);
      setAlertPrice('');
      setAlertError(null);
    }
  }, [explainHolding]);

  useEffect(() => {
    if (whatIfHolding) {
      setWhatIfDelta('0');
      setWhatIfPrice('');
      setWhatIfResult(null);
      setWhatIfError(null);
    }
  }, [whatIfHolding]);

  const handleSaveNote = useCallback(async () => {
    if (!explainHolding) return;
    const trimmed = noteText.trim();
    if (!trimmed) {
      setNoteError('Enter a note before saving.');
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    try {
      const updated = await appendNote({ holdingId: explainHolding.id, text: trimmed });
      setExplainHolding((prev) => (prev ? { ...prev, notes: updated.notes } : prev));
      setNoteText('');
    } catch (error: any) {
      setNoteError(error?.message ?? 'Failed to add note.');
    } finally {
      setNoteSaving(false);
    }
  }, [appendNote, explainHolding, noteText]);

  const handleCreateAlert = useCallback(async () => {
    if (!explainHolding) return;
    const price = Number(alertPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setAlertError('Enter a valid target price.');
      return;
    }
    setAlertSaving(true);
    setAlertError(null);
    try {
      await createAlert({ holdingId: explainHolding.id, rule: { type: alertType, price, currency: displayCurrency } });
      setAlertPrice('');
    } catch (error: any) {
      setAlertError(error?.message ?? 'Failed to create alert.');
    } finally {
      setAlertSaving(false);
    }
  }, [alertPrice, alertType, createAlert, displayCurrency, explainHolding]);

  const handleDeleteAlert = useCallback(async (id: string) => {
    try {
      await deleteAlert(id);
    } catch (error) {
      // swallow for now
    }
  }, [deleteAlert]);

  const runWhatIfSimulation = useCallback(async () => {
    if (!whatIfHolding) return;
    const delta = Number(whatIfDelta);
    if (!Number.isFinite(delta)) {
      setWhatIfError('Enter a valid delta amount.');
      return;
    }
    const payload: any = { holdingId: whatIfHolding.id, deltaUnits: delta };
    if (whatIfPrice.trim().length) {
      const override = Number(whatIfPrice);
      if (!Number.isFinite(override) || override <= 0) {
        setWhatIfError('Enter a valid override price.');
        return;
      }
      payload.pricePerUnit = override;
    }
    setWhatIfLoading(true);
    setWhatIfError(null);
    try {
      const result = await executeToolByName('what_if', payload);
      if (!result.success) {
        const failure = result as ToolExecutionFailure;
        setWhatIfError(failure.error);
        setWhatIfResult(null);
      } else {
        const success = result as ToolExecutionSuccess<WhatIfSimulationResult>;
        setWhatIfResult(success.data);
      }
    } catch (error: any) {
      setWhatIfError(error?.message ?? 'Simulation failed.');
      setWhatIfResult(null);
    } finally {
      setWhatIfLoading(false);
    }
  }, [whatIfHolding, whatIfDelta, whatIfPrice]);

  const activeHoldings = useMemo(() => data.filter((h) => !h.isDeleted), [data]);

  const holdingsById = useMemo(() => {
    const map = new Map<string, Holding>();
    data.forEach((holding) => {
      map.set(holding.id, holding);
    });
    return map;
  }, [data]);

  const rows: HoldingRowMetrics[] = useMemo(() => {
    const filtered = activeHoldings
      .filter((h) => (typeFilter ? h.type === typeFilter : true))
      .filter((h) => (categoryFilter ? (h.categoryId || '') === categoryFilter : true));

    const mapped = filtered.map((holding) => {
      const quoteKey = `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
      const quote = quotes[quoteKey];
      const valuation = computeHoldingValuation(holding, {
        quote: quote ? { price: quote.price, currency: quote.currency } : undefined,
        targetCurrency: displayCurrency,
        usdToEurRate: rate
      });

      return {
        ...holding,
        priceDisplay: valuation.unitPriceTarget,
        costBasisDisplay: valuation.costBasisTarget,
        currentValueDisplay: valuation.currentValueTarget,
        gainDisplay: valuation.gainTarget,
        gainPercent: valuation.gainPercent,
        holdingCurrency: valuation.holdingCurrency,
        dailyChangePercent: quote?.changePercent
      } as HoldingRowMetrics;
    });

    const sorted = [...mapped].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'value') {
        return dir * (a.currentValueDisplay - b.currentValueDisplay);
      }
      return dir * a.createdAt.localeCompare(b.createdAt);
    });

    return sorted;
  }, [activeHoldings, typeFilter, categoryFilter, sortBy, sortDir, quotes, displayCurrency, rate]);

  const handleExplain = (row: HoldingRowMetrics) => {
    setExplainHolding(row);
  };

  const handleWhatIf = (row: HoldingRowMetrics) => {
    setWhatIfHolding(row);
  };

  const handleSuggestRebalance = (row: HoldingRowMetrics) => {
    setRebalanceFocus(row);
    setRebalanceResult(null);
    setRebalanceError(null);
    setRebalanceOpen(true);
  };

  const handleGenerateRebalance = useCallback(async () => {
    setRebalanceLoading(true);
    try {
      const result = await executeToolByName('suggest_rebalance', { policy: {} });
      if (!result.success) {
        const failure = result as ToolExecutionFailure;
        setRebalanceError(failure.error);
        setRebalanceResult(null);
      } else {
        const success = result as ToolExecutionSuccess<RebalanceSuggestion>;
        setRebalanceResult(success.data);
        setRebalanceError(null);
      }
    } catch (error: any) {
      setRebalanceError(error?.message ?? 'Failed to compute rebalance.');
      setRebalanceResult(null);
    } finally {
      setRebalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rebalanceOpen && !rebalanceLoading && rebalanceResult === null) {
      handleGenerateRebalance();
    }
  }, [rebalanceOpen, rebalanceLoading, rebalanceResult, handleGenerateRebalance]);

  const totalDeposits = useMemo(() => {
    return (categories || []).reduce((sum, category) => {
      const amount = typeof category.depositValue === 'number' ? category.depositValue : 0;
      if (amount <= 0) return sum;
      const from = normalizeCurrency(category.depositCurrency);
      return sum + convert(amount, from, displayCurrency, rate);
    }, 0);
  }, [categories, displayCurrency, rate]);

  const totalCurrentValue = useMemo(() => {
    return rows.reduce((sum, row) => sum + row.currentValueDisplay, 0);
  }, [rows]);

  const totalReturn = totalCurrentValue - totalDeposits;
  const totalReturnPct = totalDeposits > 0 ? (totalReturn / totalDeposits) * 100 : null;
  const returnClass = totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400';
  const returnSign = totalReturn >= 0 ? '+' : '';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Holdings</h2>
          <CurrencyToggle />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => refreshQuotes()} title="Refresh prices">Refresh Prices</Button>
          <Button onClick={() => setOpen(true)}>Add Holding</Button>
        </div>
      </div>

      <Card>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total Deposits</p>
            <p className="text-lg font-semibold text-slate-100">{formatCurrency(totalDeposits, displayCurrency)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Current Value</p>
            <p className="text-lg font-semibold text-slate-100">{formatCurrency(totalCurrentValue, displayCurrency)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Total Return</p>
            <p className={`text-lg font-semibold ${totalReturn === 0 ? 'text-slate-100' : returnClass}`}>
              {returnSign}{formatCurrency(Math.abs(totalReturn), displayCurrency)}
              {totalReturnPct != null && (
                <span className="ml-2 text-sm text-slate-400">({returnSign}{totalReturnPct.toFixed(2)}%)</span>
              )}
            </p>
          </div>
        </div>
      </Card>

      {flash && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-green-800">
          {flash}
        </div>
      )}
      {(!import.meta.env.VITE_TWELVE_DATA_KEY || !import.meta.env.VITE_COINGECKO_API_KEY) && (
        <div className="rounded border border-amber-300/40 bg-amber-50/10 p-3 text-amber-200 text-sm">
          Live prices disabled: set VITE_TWELVE_DATA_KEY and VITE_COINGECKO_API_KEY to enable.
        </div>
      )}
      <Card>
        <div className="mb-3 grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="f-type">Filter by type</Label>
            <Select id="f-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-cat">Filter by category</Label>
            <Select id="f-cat" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="s-by">Sort by</Label>
            <Select id="s-by" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="value">Value</option>
              <option value="date">Date added</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="s-dir">Sort direction</Label>
            <Select id="s-dir" value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </div>
        </div>
        <HoldingsTable
          data={rows}
          displayCurrency={displayCurrency}
          totalCurrentValue={totalCurrentValue}
          onExplain={handleExplain}
          onWhatIf={handleWhatIf}
          onSuggestRebalance={handleSuggestRebalance}
          onEdit={(h) => { setEditing(h); setEditOpen(true); }}
          onDelete={async (id) => { await softDeleteHolding(id); setFlash('Holding removed.'); setTimeout(() => setFlash(null), 2000); }}
          onAdd={(h) => { setAdjustingBase(h); setAdjustMode('add'); setAdjustOpen(true); setAdjustDate(today); setAdjustQty(0); setAdjustPrice(0); }}
        />
      </Card>

      <Dialog
        open={Boolean(explainHolding)}
        onOpenChange={(next) => {
          if (!next) {
            setExplainHolding(null);
            setNoteText('');
            setNoteError(null);
            setAlertPrice('');
            setAlertError(null);
          }
        }}
        title={explainHolding ? 'Holding details - ' + explainHolding.name : 'Holding details'}
      >
        {explainHolding && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Current value</p>
                <p className="text-lg font-semibold text-slate-100">{formatCurrency(explainHolding.currentValueDisplay, displayCurrency)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Cost basis</p>
                <p className="text-lg font-semibold text-slate-100">{formatCurrency(explainHolding.costBasisDisplay, displayCurrency)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Gain</p>
                <p className={explainHolding.gainDisplay >= 0 ? 'text-lg font-semibold text-emerald-400' : 'text-lg font-semibold text-red-400'}>
                  {formatCurrency(explainHolding.gainDisplay, displayCurrency)} (
                  {explainHolding.gainPercent != null && isFinite(explainHolding.gainPercent)
                    ? explainHolding.gainPercent.toFixed(2) + '%'
                    : 'n/a'}
                  )
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">Portfolio weight</p>
                <p className="text-lg font-semibold text-slate-100">
                  {totalCurrentValue > 0 ? ((explainHolding.currentValueDisplay / totalCurrentValue) * 100).toFixed(2) + '%' : 'n/a'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Notes</h3>
              <div className="rounded border border-slate-700 bg-slate-900/60 p-3">
                {explainHolding.notes ? (
                  <ul className="space-y-2">
                    {explainHolding.notes.split('\n').map((noteLine, index) => (
                      <li key={index} className="whitespace-pre-wrap break-words text-sm text-slate-100">
                        {noteLine}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">No notes yet.</p>
                )}
              </div>
              <form
                className="grid gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleSaveNote();
                }}
              >
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="note-input">
                  Add note
                </label>
                <textarea
                  id="note-input"
                  className="min-h-[80px] resize-y rounded border border-slate-700 bg-slate-900/70 p-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  disabled={noteSaving}
                  placeholder="Add context you want to remember..."
                />
                {noteError && <p className="text-sm text-red-400">{noteError}</p>}
                <div className="flex justify-end">
                  <Button type="submit" disabled={noteSaving}>
                    {noteSaving ? 'Saving...' : 'Save note'}
                  </Button>
                </div>
              </form>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-100">Price alerts</h3>
              {alertError && <p className="text-sm text-red-400">{alertError}</p>}
              <div className="space-y-2">
                {alertsLoading ? (
                  <p className="text-sm text-slate-400">Loading alerts...</p>
                ) : alerts && alerts.length ? (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/60 p-2 text-sm text-slate-100"
                    >
                      <div>
                        <div>
                          {alert.rule.type === 'price_above' ? 'Above' : 'Below'}{' '}
                          {formatCurrency(alert.rule.price, alert.rule.currency ?? displayCurrency)}
                        </div>
                        <div className="text-xs text-slate-400">
                          Created {new Date(alert.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAlert(alert.id)}>
                        Remove
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No alerts yet.</p>
                )}
              </div>
              <form
                className="grid gap-2 md:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  await handleCreateAlert();
                }}
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor="alert-type">Alert type</Label>
                  <Select
                    id="alert-type"
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value as 'price_above' | 'price_below')}
                    disabled={alertSaving}
                  >
                    <option value="price_above">Price above target</option>
                    <option value="price_below">Price below target</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="alert-price">Trigger price</Label>
                  <Input
                    id="alert-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    disabled={alertSaving}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={alertSaving}>
                    {alertSaving ? 'Creating...' : 'Create alert'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(whatIfHolding)}
        onOpenChange={(next) => {
          if (!next) {
            setWhatIfHolding(null);
            setWhatIfResult(null);
            setWhatIfError(null);
            setWhatIfLoading(false);
            setWhatIfDelta('0');
            setWhatIfPrice('');
          } else {
            setWhatIfError(null);
          }
        }}
        title={whatIfHolding ? 'What-if simulation - ' + whatIfHolding.name : 'What-if simulation'}
      >
        {whatIfHolding && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Simulate buying (positive) or selling (negative) without changing your saved data.
            </p>
            <form
              className="grid gap-3 md:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                await runWhatIfSimulation();
              }}
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor="what-if-delta">Delta units</Label>
                <Input
                  id="what-if-delta"
                  type="number"
                  step="any"
                  value={whatIfDelta}
                  onChange={(e) => setWhatIfDelta(e.target.value)}
                  disabled={whatIfLoading}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="what-if-price">Override price (optional)</Label>
                <Input
                  id="what-if-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={whatIfPrice}
                  onChange={(e) => setWhatIfPrice(e.target.value)}
                  disabled={whatIfLoading}
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button type="submit" disabled={whatIfLoading}>
                  {whatIfLoading ? 'Running...' : 'Run simulation'}
                </Button>
              </div>
            </form>
            {whatIfError && <p className="text-sm text-red-400">{whatIfError}</p>}
            {whatIfResult && (
              <div className="space-y-3 rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Holding value</p>
                    <p className="font-semibold text-slate-100">
                      {formatCurrency(whatIfResult.before.holdingValue, whatIfResult.currency)} {'->'} {formatCurrency(whatIfResult.after.holdingValue, whatIfResult.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Portfolio total</p>
                    <p className="font-semibold text-slate-100">
                      {formatCurrency(whatIfResult.before.portfolioValue, whatIfResult.currency)} {'->'} {formatCurrency(whatIfResult.after.portfolioValue, whatIfResult.currency)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Difference</p>
                  <p className="font-semibold text-slate-100">
                    Holding {whatIfResult.difference.holdingValue >= 0 ? '+' : '-'}{formatCurrency(Math.abs(whatIfResult.difference.holdingValue), whatIfResult.currency)} | Portfolio {whatIfResult.difference.portfolioValue >= 0 ? '+' : '-'}{formatCurrency(Math.abs(whatIfResult.difference.portfolioValue), whatIfResult.currency)}
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Price used {formatCurrency(whatIfResult.pricePerUnitUsed, whatIfResult.currency)} | Delta units {whatIfResult.deltaUnits}
                </p>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={rebalanceOpen}
        onOpenChange={(next) => {
          setRebalanceOpen(next);
          if (!next) {
            setRebalanceFocus(null);
            setRebalanceResult(null);
            setRebalanceError(null);
          }
        }}
        title="Rebalance suggestion"
      >
        <div className="space-y-4">
          {rebalanceFocus && (
            <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-200">
              Focusing on <span className="font-semibold text-slate-100">{rebalanceFocus.name}</span> ({rebalanceFocus.type})
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" onClick={handleGenerateRebalance} disabled={rebalanceLoading}>
              {rebalanceLoading ? 'Calculating...' : 'Refresh suggestion'}
            </Button>
          </div>
          {rebalanceError && <p className="text-sm text-red-400">{rebalanceError}</p>}
          {rebalanceResult ? (
            <div className="space-y-3">
              <div className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100">
                <p>Total buy {formatCurrency(Math.max(rebalanceResult.summary.totalBuy, 0), rebalanceResult.currency)}</p>
                <p>Total sell {formatCurrency(Math.max(rebalanceResult.summary.totalSell, 0), rebalanceResult.currency)}</p>
              </div>
              <div className="space-y-2">
                {rebalanceResult.trades.map((trade) => {
                  const holding = holdingsById.get(trade.holdingId);
                  const name = holding ? holding.name : trade.holdingId;
                  if (trade.action === 'hold') {
                    return (
                      <div key={trade.holdingId} className="rounded border border-slate-800 bg-slate-900/40 p-2 text-sm text-slate-400">
                        Hold {name} - already on target.
                      </div>
                    );
                  }
                  const isAmount = holding ? holding.type === 'cash' || holding.type === 'real_estate' : false;
                  return (
                    <div key={trade.holdingId} className="rounded border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-100">
                      <div className="flex items-center justify-between">
                        <span>{trade.action === 'buy' ? 'Buy' : 'Sell'} {name}</span>
                        <span>{formatCurrency(Math.abs(trade.deltaValue), rebalanceResult.currency)}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Target {formatCurrency(trade.targetValue, rebalanceResult.currency)} | Current {formatCurrency(trade.currentValue, rebalanceResult.currency)} |{' '}
                        {isAmount
                          ? `Adjust amount ${formatCurrency(Math.abs(trade.deltaUnits), rebalanceResult.currency)}`
                          : `Adjust units ${Math.abs(trade.deltaUnits).toFixed(4)}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">{rebalanceLoading ? 'Calculating suggestions...' : 'No rebalance data yet.'}</p>
          )}
        </div>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen} title="Add Holding">
        <HoldingForm
          onSubmit={async (payload) => {
            await createHolding(payload);
            setOpen(false);
            setFlash('Holding added successfully.');
            setTimeout(() => setFlash(null), 2000);
          }}
        />
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen} title={`${adjustMode === 'add' ? 'Add to' : 'Remove from'} Position`}>
        {adjustingBase && (
          <div className="grid gap-3">
            <div className="text-sm text-slate-400">
              {adjustingBase.name} - {adjustingBase.type}
            </div>
            <div className="flex gap-2">
              <Button
                variant={adjustMode === 'add' ? 'default' : 'ghost'}
                onClick={() => setAdjustMode('add')}
              >
                Add
              </Button>
              <Button
                variant={adjustMode === 'remove' ? 'default' : 'ghost'}
                onClick={() => setAdjustMode('remove')}
              >
                Remove
              </Button>
            </div>
            {adjustMode === 'add' ? (
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const h = adjustingBase;
                  if (!h) return;
                  if (h.type === 'cash' || h.type === 'real_estate') {
                    const addAmt = Math.max(0, adjustQty || 0);
                    if (addAmt <= 0) { setFlash('Enter a positive amount.'); setTimeout(() => setFlash(null), 2000); return; }
                    const newAmt = Number(((typeof h.buyValue === 'number' ? h.buyValue : h.pricePerUnit) + addAmt).toFixed(2));
                    await addTransaction({ holdingId: h.id, dateISO: adjustDate, deltaUnits: addAmt });
                    await updateHolding({
                      ...h,
                      units: 1,
                      pricePerUnit: newAmt,
                      buyValue: newAmt,
                      updatedAt: new Date().toISOString()
                    });
                  } else {
                    const addShares = Math.max(0, adjustQty || 0);
                    if (addShares <= 0) { setFlash('Enter valid shares to add.'); setTimeout(() => setFlash(null), 2000); return; }
                    const newUnits = Number(((h.units || 0) + addShares).toFixed(6));
                    const tradePrice = adjustPrice > 0 ? adjustPrice : h.pricePerUnit;
                    const additionalBuy = Number((addShares * tradePrice).toFixed(2));
                    const baseBuy = typeof h.buyValue === 'number' ? h.buyValue : (h.units || 0) * h.pricePerUnit;
                    await addTransaction({ holdingId: h.id, dateISO: adjustDate, deltaUnits: addShares, pricePerUnit: tradePrice });
                    await updateHolding({
                      ...h,
                      units: newUnits,
                      pricePerUnit: tradePrice,
                      buyValue: Number((baseBuy + additionalBuy).toFixed(2)),
                      updatedAt: new Date().toISOString()
                    });
                  }
                  setAdjustOpen(false);
                  setAdjustingBase(null);
                  setAdjustQty(0);
                  setAdjustPrice(0);
                  setAdjustDate(today);
                  setFlash('Position updated.');
                  setTimeout(() => setFlash(null), 2000);
                }}
              >
                <div>
                  <Label htmlFor="adj-date">Date</Label>
                  <Input id="adj-date" type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
                </div>
                {adjustingBase.type === 'cash' || adjustingBase.type === 'real_estate' ? (
                  <div>
                    <Label htmlFor="adj-amt">Amount to add</Label>
                    <Input
                      id="adj-amt"
                      type="number"
                      step="0.01"
                      min="0"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="adj-shares">Shares to add</Label>
                      <Input
                        id="adj-shares"
                        type="number"
                        step="any"
                        min="0"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="adj-price">Price per share</Label>
                      <Input
                        id="adj-price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={adjustPrice}
                        placeholder={`${adjustingBase.pricePerUnit}`}
                        onChange={(e) => setAdjustPrice(Number(e.target.value))}
                      />
                    </div>
                  </>
                )}
                <div className="flex justify-end">
                  <Button type="submit">Confirm Add</Button>
                </div>
              </form>
            ) : (
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const h = adjustingBase;
                  if (!h) return;
                  if (h.type === 'cash' || h.type === 'real_estate') {
                    const base = (typeof h.buyValue === 'number' ? h.buyValue : h.units * h.pricePerUnit) || 0;
                    const removeAmt = Math.min(Math.max(0, adjustQty || 0), base);
                    if (removeAmt <= 0) { setFlash('Enter a positive amount.'); setTimeout(() => setFlash(null), 2000); return; }
                    const newAmt = Number((base - removeAmt).toFixed(2));
                    if (newAmt <= 0) {
                      await softDeleteHolding(h.id);
                    } else {
                      const ratio = base > 0 ? newAmt / base : 0;
                      await addTransaction({ holdingId: h.id, dateISO: adjustDate, deltaUnits: -removeAmt });
                      await updateHolding({
                        ...h,
                        units: 1,
                        pricePerUnit: newAmt,
                        buyValue: newAmt,
                        ...(h.type === 'real_estate' && typeof h.currentValue === 'number'
                          ? { currentValue: Number((h.currentValue * ratio).toFixed(2)) }
                          : { currentValue: undefined }),
                        updatedAt: new Date().toISOString()
                      });
                    }
                  } else {
                    const available = h.units || 0;
                    const removeShares = Math.min(Math.max(0, adjustQty || 0), available);
                    if (removeShares <= 0) { setFlash('Enter valid shares to remove.'); setTimeout(() => setFlash(null), 2000); return; }
                    const newUnits = Number((available - removeShares).toFixed(6));
                    if (newUnits <= 0) {
                      await softDeleteHolding(h.id);
                    } else {
                      const baseBuy = typeof h.buyValue === 'number' ? h.buyValue : h.units * h.pricePerUnit;
                      const ratio = available > 0 ? newUnits / available : 0;
                      await addTransaction({ holdingId: h.id, dateISO: adjustDate, deltaUnits: -removeShares, pricePerUnit: h.pricePerUnit });
                      await updateHolding({
                        ...h,
                        units: newUnits,
                        buyValue: Number((baseBuy * ratio).toFixed(2)),
                        updatedAt: new Date().toISOString()
                      });
                    }
                  }
                  setAdjustOpen(false);
                  setAdjustingBase(null);
                  setAdjustQty(0);
                  setAdjustPrice(0);
                  setAdjustDate(today);
                  setFlash('Position reduced.');
                  setTimeout(() => setFlash(null), 2000);
                }}
              >
                <div>
                  <Label htmlFor="adj-date">Date</Label>
                  <Input id="adj-date" type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
                </div>
                {adjustingBase.type === 'cash' || adjustingBase.type === 'real_estate' ? (
                  <div>
                    <Label htmlFor="adj-amt">Amount to remove</Label>
                    <Input
                      id="adj-amt"
                      type="number"
                      step="0.01"
                      min="0"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                    />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="adj-shares">Shares to remove</Label>
                    <Input
                      id="adj-shares"
                      type="number"
                      step="any"
                      min="0"
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(Number(e.target.value))}
                    />
                  </div>
                )}
                <div className="flex justify-end">
                  <Button variant="destructive" type="submit">Confirm Remove</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Holding">
        {editing && (
          <HoldingForm
            initial={editing}
            onSubmit={async (payload) => {
              await updateHolding({ ...(editing as any), ...payload });
              setEditOpen(false);
              setEditing(null);
              setFlash('Holding updated successfully.');
              setTimeout(() => setFlash(null), 2000);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

