import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { colorAt, CHART_THEME } from './palette';
import { formatCurrency } from '@/lib/utils/date';
import { useUIStore } from '@/lib/state/uiStore';
import { useState } from 'react';
import ChartModal, { ExpandToggleButton } from '@/components/ui/ChartModal';

type Row = { name: string; value: number };

function TooltipContent({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const displayCurrency = useUIStore.getState().displayCurrency;
  return (
    <div className="glass-card p-3 text-sm border border-slate-600/30">
      <div className="font-medium text-slate-100">{p.payload.name}</div>
      <div className="text-slate-300">{formatCurrency(Number(p.value), displayCurrency)}</div>
    </div>
  );
}

export default function CategoryBar({ data }: { data: Row[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  
  if (!data || data.length === 0) 
    return <p className="text-sm text-slate-400 text-center py-8">No data available</p>;
  
  const Chart = ({ height = "100%", margin = { top: 10, right: 24, bottom: 10, left: 64 } }: { height?: string; margin?: any }) => (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          <CartesianGrid 
            strokeDasharray="1 3" 
            stroke={CHART_THEME.gridColor}
            horizontal={true}
            vertical={false}
          />
          <XAxis 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            width={80} 
            tickFormatter={(v) => formatCurrency(Number(v), displayCurrency)} 
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
          />
          <Tooltip content={<TooltipContent />} />
          <Bar 
            dataKey="value" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((_, i) => (
              <Cell 
                key={`cell-${i}`} 
                fill={colorAt(i)}
                stroke="rgba(15, 23, 42, 0.3)"
                strokeWidth={1}
              />
            ))}
          </Bar>
        </BarChart>
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
        title={`Value by Category (${displayCurrency})`}
      >
        <Chart height="100%" margin={{ top: 40, right: 80, bottom: 120, left: 120 }} />
      </ChartModal>
    </>
  );
}
