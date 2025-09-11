import { FormEvent, useMemo, useState } from 'react';
import { Holding } from '@/lib/repository/types';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { useCategories } from '@/hooks/useCategories';

type Props = {
  initial?: Partial<Holding>;
  onSubmit: (hl: Omit<Holding, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) => void;
};
const TYPES = ['stock', 'crypto', 'cash', 'real_estate', 'other'] as const;

export default function HoldingForm({ initial, onSubmit }: Props) {
  const { data: categories = [] } = useCategories();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<Exclude<Holding['type'], undefined>>(
    (initial?.type as any) ?? 'stock',
  );
  const [symbol, setSymbol] = useState(initial?.symbol ?? '');
  const [units, setUnits] = useState(initial?.units ?? 0);
  const [pricePerUnit, setPricePerUnit] = useState(initial?.pricePerUnit ?? 0);
  const [buyValue, setBuyValue] = useState<number | undefined>(initial?.buyValue);
  const [currency, setCurrency] = useState(initial?.currency ?? 'EUR');
  const [categoryId, setCategoryId] = useState<string | undefined>(initial?.categoryId);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [purchaseDate, setPurchaseDate] = useState<string>(initial?.purchaseDate ?? today);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const isValueMode = type === 'cash' || type === 'real_estate';
    if (!isValueMode) {
      if (Number.isNaN(units) || Number.isNaN(pricePerUnit)) {
        setError('Please enter valid numbers.');
        return;
      }
      if (units < 0 || pricePerUnit < 0) {
        setError('Values cannot be negative.');
        return;
      }
    } else {
      if (typeof buyValue !== 'number' || buyValue < 0) {
        setError('Please enter a valid amount.');
        return;
      }
    }
    const normalizedPrice = Number((pricePerUnit ?? 0).toFixed(2));
    setError(null);
    const payload: any = {
      type,
      name,
      symbol,
      currency,
      categoryId,
      purchaseDate,
      tags: initial?.tags ?? [],
      notes: initial?.notes ?? ''
    };
    if (isValueMode) {
      payload.units = 1;
      payload.pricePerUnit = Number((buyValue ?? 0).toFixed(2));
      payload.buyValue = Number((buyValue ?? 0).toFixed(2));
      // No separate current value captured for cash/real estate
    } else {
      payload.units = Number(units);
      payload.pricePerUnit = normalizedPrice;
      // Compute buyValue from units * price
      const computedBuy = Number((Number(units) * normalizedPrice).toFixed(2));
      payload.buyValue = typeof buyValue === 'number' ? Number(buyValue.toFixed(2)) : computedBuy;
    }
    onSubmit(payload);
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <Label htmlFor="hf-name">Name</Label>
        <Input id="hf-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="hf-type">Type</Label>
        <Select id="hf-type" value={type} onChange={(e) => setType(e.target.value as any)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      {(type !== 'cash' && type !== 'real_estate') && (
        <div>
          <Label htmlFor="hf-symbol">Symbol</Label>
          <Input id="hf-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} />
        </div>
      )}
      <div>
        <Label htmlFor="hf-category">Category</Label>
        <Select
          id="hf-category"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || undefined)}
        >
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      {!(type === 'cash' || type === 'real_estate') ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="hf-units">Shares</Label>
              <Input
                id="hf-units"
                type="number"
                step="any"
                min="0"
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <Label htmlFor="hf-ppu">Price per Share</Label>
              <Input
                id="hf-ppu"
                type="number"
                step="0.01"
                min="0"
                value={pricePerUnit}
                onChange={(e) => setPricePerUnit(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="hf-bv">Buy Value (optional)</Label>
            <Input
              id="hf-bv"
              type="number"
              step="0.01"
              min="0"
              value={typeof buyValue === 'number' ? buyValue : ''}
              onChange={(e) => setBuyValue(e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label htmlFor="hf-amount">{type === 'cash' ? 'Amount' : 'Total Amount'}</Label>
            <Input
              id="hf-amount"
              type="number"
              step="0.01"
              min="0"
              value={typeof buyValue === 'number' ? buyValue : ''}
              onChange={(e) => setBuyValue(e.target.value === '' ? undefined : Number(e.target.value))}
              required
            />
          </div>
        </>
      )}
      <div>
        <Label htmlFor="hf-curr">Currency</Label>
        <Input id="hf-curr" value={currency} onChange={(e) => setCurrency(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="hf-purchase">Buy date</Label>
        <Input
          id="hf-purchase"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          required
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
