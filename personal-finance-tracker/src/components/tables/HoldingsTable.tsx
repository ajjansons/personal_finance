import { Holding } from '@/lib/repository/types';
import { formatCurrency } from '@/lib/utils/date';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import { useUsdEurRate, convert } from '@/lib/fx/twelveDataFx';
import { useQuotes } from '@/hooks/useQuotes';
import { useUIStore } from '@/lib/state/uiStore';

type Props = {
  data: (Holding & { marketValue?: number })[];
  onEdit?: (h: Holding) => void;
  onDelete?: (id: string) => void;
  onAdd?: (h: Holding) => void;
};

export default function HoldingsTable({ data, onEdit, onDelete, onAdd }: Props) {
  const { rate } = useUsdEurRate();
  const { quotes } = useQuotes(data);
  const displayCurrency = useUIStore((s) => s.displayCurrency);

  const normalizeCurrency = (code: string): 'USD' | 'EUR' => (code === 'USD' ? 'USD' : 'EUR');
  const toDisplayValue = (amount: number, sourceCurrency: string) =>
    convert(amount, normalizeCurrency(sourceCurrency), displayCurrency, rate);
  const formatDisplayValue = (amount: number, sourceCurrency: string) =>
    formatCurrency(toDisplayValue(amount, sourceCurrency), displayCurrency);

  const getBuyBase = (h: Holding) => (typeof (h as any).buyValue === 'number' ? (h as any).buyValue : (h.units || 0) * (h.pricePerUnit || 0));
  const getBuyValue = (h: Holding) => getBuyBase(h);
  const getCurrentValue = (h: Holding) => {
    if (h.type === 'cash' || h.type === 'real_estate') return getBuyValue(h);
    const units = h.units || 0;
    if (units <= 0) return 0;
    const key = `${h.type}:${(h.symbol || '').toUpperCase()}`;
    const q = quotes[key];
    const holdingCurrency = normalizeCurrency(h.currency);
    if (q && isFinite(q.price)) {
      const priceInHolding = q.currency === holdingCurrency ? q.price : convert(q.price, q.currency, holdingCurrency, rate);
      return priceInHolding * units;
    }
    const fallbackPrice = h.pricePerUnit || 0;
    return fallbackPrice * units;
  };

  const totalCurrent = data.reduce((sum, holding) => sum + toDisplayValue(getCurrentValue(holding), holding.currency), 0);

  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Shares</TH>
            <TH>Price/Share</TH>
            <TH>Buy Value</TH>
            <TH>Current Value</TH>
            <TH>Daily</TH>
            <TH>Total Gain</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {data.map((h) => (
            <TR key={h.id}>
              <TD>{h.name}</TD>
              <TD>{h.type}</TD>
              <TD>{(h.type === 'cash' || h.type === 'real_estate') ? '-' : h.units}</TD>
              <TD>
                {(h.type === 'cash' || h.type === 'real_estate')
                  ? '-'
                  : (() => {
                      const key = `${h.type}:${(h.symbol || '').toUpperCase()}`;
                      const q = quotes[key];
                      const holdingCurrency = normalizeCurrency(h.currency);
                      const priceInHolding = q
                        ? (q.currency === holdingCurrency ? q.price : convert(q.price, q.currency, holdingCurrency, rate))
                        : (h.pricePerUnit || 0);
                      return formatDisplayValue(priceInHolding, h.currency);
                    })()}
              </TD>
              <TD>{formatDisplayValue(getBuyValue(h), h.currency)}</TD>
              <TD>{formatDisplayValue(getCurrentValue(h), h.currency)}</TD>
              <TD>
                {(() => {
                  if (h.type === 'cash' || h.type === 'real_estate') return '-';
                  const key = `${h.type}:${(h.symbol || '').toUpperCase()}`;
                  const q = quotes[key];
                  const pct = q?.changePercent;
                  if (pct == null || !isFinite(pct)) return '-';
                  const sign = pct >= 0 ? '+' : '';
                  return <span className={pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>{sign}{pct.toFixed(2)}%</span>;
                })()}
              </TD>
              <TD>
                {(() => {
                  const buyRaw = getBuyValue(h);
                  const curRaw = getCurrentValue(h);
                  const buyDisplay = toDisplayValue(buyRaw, h.currency);
                  const curDisplay = toDisplayValue(curRaw, h.currency);
                  const diffDisplay = curDisplay - buyDisplay;
                  const pct = buyRaw > 0 ? ((curRaw - buyRaw) / buyRaw) * 100 : 0;
                  const sign = diffDisplay >= 0 ? '+' : '';
                  return (
                    <span className={diffDisplay >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {sign}{formatCurrency(Math.abs(diffDisplay), displayCurrency)}
                      {' '}
                      <span className="text-xs">({sign}{pct.toFixed(2)}%)</span>
                    </span>
                  );
                })()}
              </TD>
              <TD className="space-x-2">
                <Button variant="ghost" onClick={() => onEdit?.(h)}>Edit</Button>
                <Button variant="ghost" onClick={() => onAdd?.(h)}>Add/Remove</Button>
                <Button variant="destructive" onClick={() => onDelete?.(h.id)}>Delete</Button>
              </TD>
            </TR>
          ))}
          <TR>
            <TD colSpan={5} className="text-right font-medium">Total</TD>
            <TD className="font-semibold">{formatCurrency(totalCurrent, displayCurrency)}</TD>
            <TD colSpan={2} />
          </TR>
        </TBody>
      </Table>
    </div>
  );
}
