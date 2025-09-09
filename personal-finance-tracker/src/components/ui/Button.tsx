import { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'destructive';
};

export function Button({ variant = 'default', className = '', ...props }: Props) {
  const base = 'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm border';
  const styles =
    variant === 'ghost'
      ? 'bg-transparent border-transparent hover:bg-gray-100'
      : variant === 'destructive'
      ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
      : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700';
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
export default Button;

