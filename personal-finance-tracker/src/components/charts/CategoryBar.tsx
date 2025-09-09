import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { colorAt } from './palette';
import { formatEur } from '@/lib/utils/date';
import { useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';

type Row = { name: string; value: number };

function TooltipContent({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded border bg-white px-2 py-1 text-sm shadow">
      <div className="font-medium">{p.name}</div>
      <div>{formatEur(Number(p.value))}</div>
    </div>
  );
}

export default function CategoryBar({ data }: { data: Row[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || data.length === 0) return <p className="text-sm text-gray-500">No data.</p>;
  const Chart = ({ hClass }: { hClass: string }) => (
    <div className={hClass}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 64 }}>
          <XAxis dataKey="name" />
          <YAxis width={80} tickFormatter={(v) => formatEur(Number(v))} />
          <Tooltip content={<TooltipContent />} />
          <Bar dataKey="value">
            {data.map((_, i) => (
              <Cell key={`cell-${i}`} fill={colorAt(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <div className="relative">
      <Chart hClass="h-64" />
      <Button variant="ghost" className="absolute right-2 top-2" onClick={() => setExpanded(true)}>
        Expand
      </Button>
      <Dialog open={expanded} onOpenChange={setExpanded} title="Value by Category">
        <Chart hClass="h-[70vh]" />
      </Dialog>
    </div>
  );
}
