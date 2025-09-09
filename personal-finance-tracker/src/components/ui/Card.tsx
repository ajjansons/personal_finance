import { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-md border bg-white p-4 shadow-sm">{children}</div>;
}
export default Card;

