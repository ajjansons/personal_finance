import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { colorAt, CHART_THEME } from './palette';
import { formatCurrency } from '@/lib/utils/date';
import { useUIStore } from '@/lib/state/uiStore';
import { useState } from 'react';
import ChartModal, { ExpandToggleButton } from '@/components/ui/ChartModal';

type Datum = { name: string; value: number; percent?: number };

function TooltipContent({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload as Datum;
  const pct = p.percent !== undefined ? p.percent : 0;
  const displayCurrency = useUIStore.getState().displayCurrency;
  return (
    <div className="glass-card p-3 text-sm border border-slate-600/30">
      <div className="font-medium text-slate-100">{payload[0].name}</div>
      <div className="text-slate-300">
        {formatCurrency(p.value, displayCurrency)} ({(pct * 100).toFixed(1)}%)
      </div>
    </div>
  );
}

function CustomLegend({ payload }: any) {
  return (
    <div className="flex flex-wrap gap-4 justify-center mt-4">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-300">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AllocationPie({ data }: { data: Datum[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  
  if (!data || data.length === 0) 
    return <p className="text-sm text-slate-400 text-center py-8">No data available</p>;
  
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const normalized = data.map((d) => ({ ...d, percent: d.percent ?? d.value / total }));
  
  const Chart = ({ height = "100%", outerRadius = 80 }: { height?: string; outerRadius?: number }) => (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie 
            dataKey="value" 
            nameKey="name" 
            data={normalized} 
            outerRadius={outerRadius}
            strokeWidth={2}
            stroke="rgba(15, 23, 42, 0.8)"
          >
            {normalized.map((_, i) => (
              <Cell key={i} fill={colorAt(i)} />
            ))}
          </Pie>
          <Legend content={<CustomLegend />} />
          <Tooltip content={<TooltipContent />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
  
  return (
    <>
      <div className="relative chart-container">
        <ExpandToggleButton 
          isExpanded={expanded} 
          onToggle={() => setExpanded(!expanded)} 
        />
        <Chart height="300px" />
      </div>
      
      <ChartModal 
        open={expanded} 
        onClose={() => setExpanded(false)} 
        title={`Portfolio Allocation (${displayCurrency})`}
      >
        <Chart height="100%" outerRadius={220} />
      </ChartModal>
    </>
  );
}
