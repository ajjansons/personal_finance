import { useMemo, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import HoldingForm from '@/components/forms/HoldingForm';
import HoldingsTable from '@/components/tables/HoldingsTable';
import { useHoldings } from '@/hooks/useHoldings';
import { useCategories } from '@/hooks/useCategories';
import Select from '@/components/ui/Select';
import Label from '@/components/ui/Label';

const TYPES = ['stock', 'crypto', 'cash', 'real_estate', 'other'] as const;

export default function Holdings() {
  const { data = [], createHolding, updateHolding, softDeleteHolding } = useHoldings();
  const { data: categories = [] } = useCategories();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
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
    const augmented = filtered.map((h) => ({ ...h, marketValue: h.units * h.pricePerUnit }));
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
          onDelete={async (id) => {
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
