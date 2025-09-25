import { useMemo, useState } from 'react';
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
import { useUIStore } from '@/lib/state/uiStore';
import { formatCurrency } from '@/lib/utils/date';

const TYPES = ['stock', 'crypto', 'cash', 'real_estate', 'other'] as const;
const normalizeCurrency = (code: string | undefined): 'USD' | 'EUR' => (code && code.toUpperCase() === 'USD') ? 'USD' : 'EUR';

export default function Holdings() {
  const { data = [], createHolding, updateHolding, softDeleteHolding } = useHoldings();
  const { addTransaction } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { quotes, refresh: refreshQuotes } = useQuotes(data);
  const { rate } = useUsdEurRate();
  const displayCurrency = useUIStore((s) => s.displayCurrency);

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

  const activeHoldings = useMemo(() => data.filter((h) => !h.isDeleted), [data]);

  const rows = useMemo(() => {
    const filtered = activeHoldings
      .filter((h) => (typeFilter ? h.type === typeFilter : true))
      .filter((h) => (categoryFilter ? (h.categoryId || '') === categoryFilter : true));
    const augmented = filtered.map((h) => ({
      ...h,
      marketValue: (h.type === 'cash' || h.type === 'real_estate')
        ? (typeof (h as any).buyValue === 'number' ? (h as any).buyValue : h.units * h.pricePerUnit)
        : h.units * h.pricePerUnit
    }));
    augmented.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'value') return dir * ((a.marketValue || 0) - (b.marketValue || 0));
      // date: createdAt ISO strings compare lexicographically
      return dir * (a.createdAt.localeCompare(b.createdAt));
    });
    return augmented;
  }, [activeHoldings, typeFilter, categoryFilter, sortBy, sortDir]);

  const totalDeposits = useMemo(() => {
    return (categories || []).reduce((sum, category) => {
      const amount = typeof category.depositValue === 'number' ? category.depositValue : 0;
      if (amount <= 0) return sum;
      const from = normalizeCurrency(category.depositCurrency);
      return sum + convert(amount, from, displayCurrency, rate);
    }, 0);
  }, [categories, displayCurrency, rate]);

  const totalCurrentValue = useMemo(() => {
    return activeHoldings.reduce((sum, h) => {
      const holdingCurrency = normalizeCurrency(h.currency);
      if (h.type === 'cash' || h.type === 'real_estate') {
        const base = typeof h.buyValue === 'number' ? h.buyValue : (h.units || 0) * (h.pricePerUnit || 0);
        return sum + convert(base, holdingCurrency, displayCurrency, rate);
      }
      const units = h.units || 0;
      if (units <= 0) return sum;
      const key = `${h.type}:${(h.symbol || '').toUpperCase()}`;
      const q = quotes[key];
      const priceInHolding = q && isFinite(q.price)
        ? (q.currency === holdingCurrency ? q.price : convert(q.price, q.currency, holdingCurrency, rate))
        : (h.pricePerUnit || 0);
      const current = priceInHolding * units;
      return sum + convert(current, holdingCurrency, displayCurrency, rate);
    }, 0);
  }, [activeHoldings, quotes, displayCurrency, rate]);

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
          onEdit={(h) => { setEditing(h); setEditOpen(true); }}
          onDelete={async (id) => { await softDeleteHolding(id); setFlash('Holding removed.'); setTimeout(() => setFlash(null), 2000); }}
          onAdd={(h) => { setAdjustingBase(h); setAdjustMode('add'); setAdjustOpen(true); setAdjustDate(today); setAdjustQty(0); setAdjustPrice(0); }}
        />
      </Card>

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
              {adjustingBase.name} — {adjustingBase.type}
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
