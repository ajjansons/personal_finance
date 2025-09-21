import { FormEvent, useState } from 'react';
import { Category } from '@/lib/repository/types';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';

type Props = {
  initial?: Partial<Category>;
  onSubmit: (c: Omit<Category, 'id'>) => void;
};

export default function CategoryForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#4f46e5');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 1);
  const [depositValue, setDepositValue] = useState<number | ''>(
    typeof initial?.depositValue === 'number' ? initial.depositValue : ''
  );
  const [depositCurrency, setDepositCurrency] = useState<'USD' | 'EUR'>(
    initial?.depositCurrency ?? 'EUR'
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const normalizedDeposit = depositValue === '' ? undefined : Number(Number(depositValue).toFixed(2));
    onSubmit({
      name,
      color,
      sortOrder,
      depositValue: normalizedDeposit,
      depositCurrency: depositCurrency
    });
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div>
        <Label htmlFor="cf-name">Name</Label>
        <Input id="cf-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="cf-color">Color</Label>
        <Input id="cf-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="cf-sort">Sort Order</Label>
        <Input
          id="cf-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cf-deposit">Total Deposits (optional)</Label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            id="cf-deposit"
            type="number"
            step="0.01"
            min="0"
            value={depositValue}
            onChange={(e) => {
              const val = e.target.value;
              setDepositValue(val === '' ? '' : Number(val));
            }}
            placeholder="0.00"
          />
          <Select
            value={depositCurrency}
            onChange={(e) => setDepositCurrency(e.target.value === 'USD' ? 'USD' : 'EUR')}
            aria-label="Deposit currency"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
