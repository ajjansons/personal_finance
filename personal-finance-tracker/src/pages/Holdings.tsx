import { useMemo, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import HoldingForm from '@/components/forms/HoldingForm';
import HoldingsTable from '@/components/tables/HoldingsTable';
import { useHoldings } from '@/hooks/useHoldings';
import { useCategories } from '@/hooks/useCategories';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';

const TYPES = ['stock', 'crypto', 'cash', 'real_estate', 'other'] as const;

export default function Holdings() {
  const { data = [], createHolding, updateHolding, softDeleteHolding } = useHoldings();
  const { data: categories = [] } = useCategories();
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

  const rows = useMemo(() => {
    const filtered = data
      .filter((h) => !h.isDeleted)
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
  }, [data, typeFilter, categoryFilter, sortBy, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Holdings</h2>
        <Button onClick={() => setOpen(true)}>Add Holding</Button>
      </div>
      {flash && (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-green-800">
          {flash}
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
            <Label htmlFor="s-dir">Direction</Label>
            <Select id="s-dir" value={sortDir} onChange={(e) => setSortDir(e.target.value as any)}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </Select>
          </div>
        </div>
        <HoldingsTable
          data={rows}
          onEdit={(h) => {
            setEditing(h);
            setEditOpen(true);
          }}
          onAdd={(h) => {
            setAdjustingBase(h);
            setAdjustMode('add');
            setAdjustQty(0);
            setAdjustPrice(0);
            setAdjustDate(today);
            setAdjustOpen(true);
          }}
          onDelete={async (id) => {
            const ok = window.confirm('Delete this entry? This action cannot be undone.');
            if (!ok) return;
            await softDeleteHolding(id);
            setFlash('Holding deleted.');
            setTimeout(() => setFlash(null), 2000);
          }}
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
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen} title="Add/Remove">
        {adjustingBase && (
          <div className="grid gap-3">
            <div>
              <Label htmlFor="adj-mode">Action</Label>
              <Select id="adj-mode" value={adjustMode} onChange={(e) => setAdjustMode(e.target.value as any)}>
                <option value="add">Add</option>
                <option value="remove">Remove</option>
              </Select>
            </div>
            {adjustMode === 'add' ? (
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const h = adjustingBase;
                  if (!h) return;
                  if (h.type === 'cash' || h.type === 'real_estate') {
                    const base = (typeof h.buyValue === 'number' ? h.buyValue : h.units * h.pricePerUnit) || 0;
                    const addAmt = Math.max(0, adjustQty || 0);
                    if (addAmt <= 0) { setFlash('Enter a positive amount.'); setTimeout(()=>setFlash(null), 2000); return; }
                    const newAmt = Number((base + addAmt).toFixed(2));
                    await updateHolding({
                      ...h,
                      units: 1,
                      pricePerUnit: newAmt,
                      buyValue: newAmt,
                      updatedAt: new Date().toISOString()
                    });
                  } else {
                    const addShares = Math.max(0, adjustQty || 0);
                    const price = adjustPrice || h.pricePerUnit || 0;
                    if (addShares <= 0 || price <= 0) { setFlash('Enter valid shares and price.'); setTimeout(()=>setFlash(null), 2000); return; }
                    const newUnits = Number(((h.units || 0) + addShares).toFixed(6));
                    const baseBuy = typeof h.buyValue === 'number' ? h.buyValue : (h.units || 0) * (h.pricePerUnit || 0);
                    const additionalBuy = Number((addShares * price).toFixed(2));
                    await updateHolding({
                      ...h,
                      units: newUnits,
                      pricePerUnit: price, // treat latest trade price as current price if no market data
                      buyValue: Number((baseBuy + additionalBuy).toFixed(2)),
                      updatedAt: new Date().toISOString()
                    });
                  }
                  setAdjustOpen(false);
                  setAdjustingBase(null);
                  setAdjustQty(0);
                  setAdjustPrice(0);
                  setAdjustDate(today);
                  setFlash('Position increased.');
                  setTimeout(() => setFlash(null), 2000);
                }}
              >
                <div>
                  <Label htmlFor="adj-date-add">Date</Label>
                  <Input id="adj-date-add" type="date" value={adjustDate} onChange={(e) => setAdjustDate(e.target.value)} />
                </div>
                {adjustingBase.type === 'cash' || adjustingBase.type === 'real_estate' ? (
                  <div>
                    <Label htmlFor="adj-amt-add">Amount to add</Label>
                    <Input
                      id="adj-amt-add"
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
                      <Label htmlFor="adj-shares-add">Shares to add</Label>
                      <Input
                        id="adj-shares-add"
                        type="number"
                        step="any"
                        min="0"
                        value={adjustQty}
                        onChange={(e) => setAdjustQty(Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="adj-price-add">Price per Share</Label>
                      <Input
                        id="adj-price-add"
                        type="number"
                        step="0.01"
                        min="0"
                        value={adjustPrice}
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
                    if (removeAmt <= 0) { setFlash('Enter a positive amount.'); setTimeout(()=>setFlash(null), 2000); return; }
                    const newAmt = Number((base - removeAmt).toFixed(2));
                    if (newAmt <= 0) {
                      await softDeleteHolding(h.id);
                    } else {
                      const ratio = base > 0 ? newAmt / base : 0;
                      await updateHolding({
                        ...h,
                        units: 1,
                        pricePerUnit: newAmt,
                        buyValue: newAmt,
                        // For real_estate, scale currentValue if present
                        ...(h.type === 'real_estate' && typeof h.currentValue === 'number'
                          ? { currentValue: Number((h.currentValue * ratio).toFixed(2)) }
                          : { currentValue: undefined }),
                        updatedAt: new Date().toISOString()
                      });
                    }
                  } else {
                    const available = h.units || 0;
                    const removeShares = Math.min(Math.max(0, adjustQty || 0), available);
                    if (removeShares <= 0) { setFlash('Enter valid shares to remove.'); setTimeout(()=>setFlash(null), 2000); return; }
                    const newUnits = Number((available - removeShares).toFixed(6));
                    if (newUnits <= 0) {
                      await softDeleteHolding(h.id);
                    } else {
                      const baseBuy = typeof h.buyValue === 'number' ? h.buyValue : h.units * h.pricePerUnit;
                      const ratio = available > 0 ? newUnits / available : 0;
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
