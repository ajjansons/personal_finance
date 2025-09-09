import { SelectHTMLAttributes } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement>;
export default function Select({ className = '', children, ...props }: Props) {
  return (
    <select
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

