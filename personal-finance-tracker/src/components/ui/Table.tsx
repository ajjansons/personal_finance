import { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export function Table({ children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <table className="w-full border-collapse text-sm" {...props}>
      {children}
    </table>
  );
}
export function THead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className="bg-gray-50 text-left" {...props}>
      {children}
    </thead>
  );
}
export function TBody({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className="divide-y" {...props}>
      {children}
    </tbody>
  );
}
export function TR({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className="hover:bg-gray-50" {...props}>
      {children}
    </tr>
  );
}
export function TH({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className="border-b p-2 font-medium text-gray-600" {...props}>
      {children}
    </th>
  );
}
export function TD({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className="p-2 align-middle" {...props}>
      {children}
    </td>
  );
}
export default { Table, THead, TBody, TR, TH, TD };
