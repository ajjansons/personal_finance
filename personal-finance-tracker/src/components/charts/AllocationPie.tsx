import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { colorAt } from './palette';
import { formatEur } from '@/lib/utils/date';
import { useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';

type Datum = { name: string; value: number; percent?: number };

function TooltipContent({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as Datum;
  const pct = p.percent !== undefined ? p.percent : 0;
  return (
    <div className="rounded border bg-white px-2 py-1 text-sm shadow">
      <div className="font-medium">{payload[0].name}</div>
      <div>
        {formatEur(p.value)} ({(pct * 100).toFixed(1)}%)
      </div>
    </div>
  );
}

export default function AllocationPie({ data }: { data: Datum[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || data.length === 0) return <p className="text-sm text-gray-500">No data.</p>;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const normalized = data.map((d) => ({ ...d, percent: d.percent ?? d.value / total }));
  const Chart = ({ hClass }: { hClass: string }) => (
    <div className={hClass}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie dataKey="value" nameKey="name" data={normalized} outerRadius={100}>
            {normalized.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} />
            ))}
          </Pie>
          <Legend />
          <Tooltip content={<TooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <div className="relative">
      <Chart hClass="h-64" />
      <Button variant="ghost" className="absolute right-2 top-2" onClick={() => setExpanded(true)}>
        Expand
      </Button>
      <Dialog open={expanded} onOpenChange={setExpanded} title="Allocation">
        <Chart hClass="h-[70vh]" />
      </Dialog>
    </div>
  );
}
