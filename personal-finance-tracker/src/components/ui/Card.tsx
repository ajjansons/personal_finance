import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`glass-card animate-fade-in-up ${className}`}>
      {children}
    </div>
  );
}
export default Card;

