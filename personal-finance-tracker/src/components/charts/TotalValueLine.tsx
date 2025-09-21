import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatCurrency } from '@/lib/utils/date';
import { colorAt, CHART_THEME } from './palette';
import { useState } from 'react';
import ChartModal, { ExpandToggleButton } from '@/components/ui/ChartModal';
import { useUIStore } from '@/lib/state/uiStore';

type Pt = { date: string; total: number };

function TooltipContent({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const displayCurrency = useUIStore.getState().displayCurrency;
  return (
    <div className="glass-card p-3 text-sm border border-slate-600/30">
      <div className="font-medium text-slate-100">{label}</div>
      <div className="text-slate-300">{formatCurrency(p.value as number, displayCurrency)}</div>
    </div>
  );
}

export default function TotalValueLine({ data }: { data: Pt[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  
  if (!data || data.length === 0) 
    return <p className="text-sm text-slate-400 text-center py-8">No data available</p>;
  
  const stroke = colorAt(0);
  const strokeSecondary = colorAt(1);
  
  const Chart = ({ height = "100%", margin = { top: 10, right: 24, bottom: 10, left: 64 } }: { height?: string; margin?: any }) => (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={margin}>
          <defs>
            <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.4} />
              <stop offset="50%" stopColor={stroke} stopOpacity={0.2} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="glowGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.8} />
              <stop offset="100%" stopColor={strokeSecondary} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="1 3" 
            stroke={CHART_THEME.gridColor}
            horizontal={true}
            vertical={false}
          />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
          />
          <YAxis 
            width={80} 
            tickFormatter={(v) => formatCurrency(Number(v), displayCurrency)} 
            axisLine={false}
            tickLine={false}
            tick={{ fill: CHART_THEME.textColor, fontSize: 12 }}
          />
          <Tooltip content={<TooltipContent />} />
          <Area 
            type="monotone" 
            dataKey="total" 
            stroke="url(#glowGradient)" 
            strokeWidth={3} 
            fill="url(#valueGradient)" 
            dot={{ r: 4, fill: stroke, strokeWidth: 2, stroke: '#0f172a' }} 
            activeDot={{ r: 6, fill: stroke, strokeWidth: 0 }}
          />
        </AreaChart>
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
        title="Portfolio Value Over Time"
      >
        <Chart height="100%" margin={{ top: 40, right: 80, bottom: 80, left: 100 }} />
      </ChartModal>
    </>
  );
}
