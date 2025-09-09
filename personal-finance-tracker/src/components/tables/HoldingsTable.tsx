import { Holding, HoldingWithValue } from '@/lib/repository/types';
import { formatCurrency } from '@/lib/utils/date';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import Button from '@/components/ui/Button';

type Props = {
  data: HoldingWithValue[];
  onEdit?: (h: Holding) => void;
  onDelete?: (id: string) => void;
};

export default function HoldingsTable({ data, onEdit, onDelete }: Props) {
  const total = data.reduce((s, d) => s + d.marketValue, 0);
  return (
    <div className="overflow-x-auto">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Type</TH>
            <TH>Units</TH>
            <TH>Price/Unit</TH>
            <TH>Value</TH>
            <TH>Actions</TH>
          </TR>
        </THead>
        <TBody>
          {data.map((h) => (
            <TR key={h.id}>
              <TD>{h.name}</TD>
              <TD>{h.type}</TD>
              <TD>{h.units}</TD>
              <TD>{formatCurrency(h.pricePerUnit, h.currency)}</TD>
              <TD>{formatCurrency(h.marketValue, h.currency)}</TD>
              <TD className="space-x-2">
                <Button variant="ghost" onClick={() => onEdit?.(h)}>Edit</Button>
                <Button variant="destructive" onClick={() => onDelete?.(h.id)}>Delete</Button>
              </TD>
            </TR>
          ))}
          <TR>
            <TD colSpan={4} className="text-right font-medium">Total</TD>
            <TD className="font-semibold">
              {data[0] ? formatCurrency(total, data[0].currency) : total.toFixed(2)}
            </TD>
            <TD />
          </TR>
        </TBody>
      </Table>
    </div>
  );
}

