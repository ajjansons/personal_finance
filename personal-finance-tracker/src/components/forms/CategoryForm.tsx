import { FormEvent, useState } from 'react';
import { Category } from '@/lib/repository/types';
import Input from '@/components/ui/Input';
import Label from '@/components/ui/Label';
import Button from '@/components/ui/Button';

type Props = {
  initial?: Partial<Category>;
  onSubmit: (c: Omit<Category, 'id'>) => void;
};

export default function CategoryForm({ initial, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.color ?? '#4f46e5');
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 1);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, color, sortOrder });
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
      <div className="flex justify-end">
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}

