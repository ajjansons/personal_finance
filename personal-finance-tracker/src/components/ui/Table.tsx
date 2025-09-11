import { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export function Table({ children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="glass-card p-0 overflow-hidden">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className="bg-slate-800/50 text-left backdrop-blur-sm" {...props}>
      {children}
    </thead>
  );
}

export function TBody({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className="divide-y divide-slate-700/30" {...props}>
      {children}
    </tbody>
  );
}

export function TR({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className="hover:bg-slate-800/20 transition-colors duration-200" {...props}>
      {children}
    </tr>
  );
}

export function TH({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className="p-4 font-medium text-slate-300 text-left border-b border-slate-700/30" {...props}>
      {children}
    </th>
  );
}

export function TD({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className="p-4 align-middle text-slate-200" {...props}>
      {children}
    </td>
  );
}

export default { Table, THead, TBody, TR, TH, TD };
