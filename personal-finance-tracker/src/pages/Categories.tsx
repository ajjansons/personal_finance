import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import CategoryForm from '@/components/forms/CategoryForm';
import { useCategories } from '@/hooks/useCategories';
import { formatCurrency } from '@/lib/utils/date';
import { Category } from '@/lib/repository/types';

export default function Categories() {
  const { data = [], createCategory, updateCategory, deleteCategory } = useCategories();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button onClick={() => setOpen(true)}>Add Category</Button>
      </div>
      <Card>
        <ul className="divide-y">
          {data.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: c.color || '#ccc' }} />
                  <span className="font-medium text-slate-100">{c.name}</span>
                </div>
                <span className="text-sm text-slate-400">
                  Deposits: {typeof c.depositValue === 'number'
                    ? formatCurrency(c.depositValue, c.depositCurrency || 'EUR')
                    : '—'}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(c)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => deleteCategory(c.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
          {data.length === 0 && (
            <li className="p-4 text-sm text-slate-400">No categories yet. Add one to get started.</li>
          )}
        </ul>
      </Card>
      <Dialog open={open} onOpenChange={setOpen} title="Add Category">
        <CategoryForm
          onSubmit={async (payload) => {
            await createCategory(payload);
            setOpen(false);
          }}
        />
      </Dialog>
      <Dialog open={Boolean(editing)} onOpenChange={(val) => !val && setEditing(null)} title="Edit Category">
        {editing && (
          <CategoryForm
            initial={editing}
            onSubmit={async (payload) => {
              await updateCategory({ ...editing, ...payload });
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
