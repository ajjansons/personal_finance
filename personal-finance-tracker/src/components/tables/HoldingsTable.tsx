import { Holding } from '@/lib/repository/types';
import { formatCurrency } from '@/lib/utils/date';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import Button from '@/components/ui/Button';

type HoldingRow = Holding & {
  priceDisplay: number | null;
  costBasisDisplay: number;
  currentValueDisplay: number;
  gainDisplay: number;
  gainPercent: number | null;
  dailyChangePercent?: number;
};

type Props = {
  data: HoldingRow[];
  displayCurrency: 'USD' | 'EUR';
  totalCurrentValue: number;
  onEdit?: (h: Holding) => void;
  onDelete?: (id: string) => void;
  onAdd?: (h: Holding) => void;
};

export default function HoldingsTable({ data, displayCurrency, totalCurrentValue, onEdit, onDelete, onAdd }: Props) {
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
          {data.map((row) => (
            <TR key={row.id}>
              <TD>{row.name}</TD>
              <TD>{row.type}</TD>
              <TD>{row.type === 'cash' || row.type === 'real_estate' ? '-' : row.units}</TD>
              <TD>
                {row.type === 'cash' || row.type === 'real_estate' || row.priceDisplay == null
                  ? '-'
                  : formatCurrency(row.priceDisplay, displayCurrency)}
              </TD>
              <TD>{formatCurrency(row.costBasisDisplay, displayCurrency)}</TD>
              <TD>{formatCurrency(row.currentValueDisplay, displayCurrency)}</TD>
              <TD>
                {(() => {
                  const pct = row.dailyChangePercent;
                  if (pct == null || !isFinite(pct)) return '-';
                  const sign = pct >= 0 ? '+' : '';
                  return (
                    <span className={pct >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {sign}{pct.toFixed(2)}%
                    </span>
                  );
                })()}
              </TD>
              <TD>
                {(() => {
                  const diff = row.gainDisplay;
                  const pct = row.gainPercent;
                  const sign = diff >= 0 ? '+' : '';
                  return (
                    <span className={diff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {sign}{formatCurrency(Math.abs(diff), displayCurrency)}{' '}
                      <span className="text-xs">
                        (
                        {pct == null || !isFinite(pct)
                          ? 'n/a'
                          : `${sign}${pct.toFixed(2)}%`}
                        )
                      </span>
                    </span>
                  );
                })()}
              </TD>
              <TD className="space-x-2">
                <Button variant="ghost" onClick={() => onEdit?.(row)}>Edit</Button>
                <Button variant="ghost" onClick={() => onAdd?.(row)}>Add/Remove</Button>
                <Button variant="destructive" onClick={() => onDelete?.(row.id)}>Delete</Button>
              </TD>
            </TR>
          ))}
          <TR>
            <TD colSpan={5} className="text-right font-medium">Total</TD>
            <TD className="font-semibold">{formatCurrency(totalCurrentValue, displayCurrency)}</TD>
            <TD colSpan={2} />
          </TR>
        </TBody>
      </Table>
    </div>
  );
}
