import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatEur } from '@/lib/utils/date';
import { colorAt } from './palette';
import { useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';

type Pt = { date: string; total: number };

function TooltipContent({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded border bg-white px-2 py-1 text-sm shadow">
      <div className="font-medium">{label}</div>
      <div>{formatEur(p.value as number)}</div>
    </div>
  );
}

export default function TotalValueLine({ data }: { data: Pt[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || data.length === 0) return <p className="text-sm text-gray-500">No data.</p>;
  const stroke = colorAt(0);
  const Chart = ({ hClass }: { hClass: string }) => (
    <div className={hClass}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 24, bottom: 10, left: 64 }}>
          <defs>
            <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis width={80} tickFormatter={(v) => formatEur(Number(v))} />
          <Tooltip content={<TooltipContent />} />
          <Area type="monotone" dataKey="total" stroke={stroke} strokeWidth={2} fill="url(#valueGradient)" dot={{ r: 3 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <div className="relative">
      <Chart hClass="h-64" />
      <Button variant="ghost" className="absolute right-2 top-2" onClick={() => setExpanded(true)}>
        Expand
      </Button>
      <Dialog open={expanded} onOpenChange={setExpanded} title="Portfolio Value Over Time">
        <Chart hClass="h-[70vh]" />
      </Dialog>
    </div>
  );
}
