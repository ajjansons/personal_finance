import { Holding } from '@/lib/repository/types';
import { formatCurrency } from '@/lib/utils/date';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import Button from '@/components/ui/Button';

type Props = {
  data: (Holding & { marketValue?: number })[];
  onEdit?: (h: Holding) => void;
  onDelete?: (id: string) => void;
  onAdd?: (h: Holding) => void;
};

export default function HoldingsTable({ data, onEdit, onDelete, onAdd }: Props) {
  const getBuy = (h: Holding) => (typeof (h as any).buyValue === 'number' ? (h as any).buyValue : (h.units || 0) * (h.pricePerUnit || 0));
  const getCurrent = (h: Holding) => {
    if (h.type === 'cash' || h.type === 'real_estate') return getBuy(h);
    return (h.units || 0) * (h.pricePerUnit || 0);
  };
  const totalCurrent = data.reduce((s, d) => s + getCurrent(d), 0);
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
              <TD>{(h.type === 'cash' || h.type === 'real_estate') ? '-' : formatCurrency(h.pricePerUnit, h.currency)}</TD>
              <TD>{formatCurrency(getBuy(h), h.currency)}</TD>
              <TD>{formatCurrency(getCurrent(h), h.currency)}</TD>
              <TD>
                {(() => {
                  const buy = getBuy(h);
                  const cur = getCurrent(h);
                  const diff = cur - buy;
                  const pct = buy > 0 ? (diff / buy) * 100 : 0;
                  const sign = diff >= 0 ? '+' : '';
                  return (
                    <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {sign}{formatCurrency(Math.abs(diff), h.currency)}
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
            <TD className="font-semibold">
              {data[0] ? formatCurrency(totalCurrent, data[0].currency) : totalCurrent.toFixed(2)}
            </TD>
            <TD colSpan={2} />
          </TR>
        </TBody>
      </Table>
    </div>
  );
}
