import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import CategoryForm from '@/components/forms/CategoryForm';
import { useCategories } from '@/hooks/useCategories';

export default function Categories() {
  const { data = [], createCategory, deleteCategory } = useCategories();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button onClick={() => setOpen(true)}>Add Category</Button>
      </div>
      <Card>
        <ul className="divide-y">
          {data.map((c) => (
            <li key={c.id} className="flex items-center justify-between p-2">
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 rounded" style={{ backgroundColor: c.color || '#ccc' }} />
                <span>{c.name}</span>
              </div>
              <Button variant="destructive" onClick={() => deleteCategory(c.id)}>
                Delete
              </Button>
            </li>
          ))}
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
    </div>
  );
}

