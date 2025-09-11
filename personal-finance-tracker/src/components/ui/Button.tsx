import { ButtonHTMLAttributes, forwardRef } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'destructive' | 'icon';
  size?: 'sm' | 'default' | 'lg';
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'default', size = 'default', className = '', ...props },
  ref
) {
  const base = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus-ring disabled:opacity-50 disabled:cursor-not-allowed';
  
  const sizeStyles = {
    sm: 'rounded-lg px-3 py-2 text-sm',
    default: 'rounded-xl px-4 py-2.5 text-sm',
    lg: 'rounded-xl px-6 py-3 text-base'
  };
  
  const variants = {
    default: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:from-blue-600 hover:to-blue-700 border border-blue-500/20',
    ghost: 'bg-slate-800/50 text-slate-200 border border-slate-700/50 hover:bg-slate-700/50 hover:border-slate-600/50 backdrop-blur-sm',
    destructive: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 hover:shadow-xl hover:shadow-red-500/30 hover:from-red-600 hover:to-red-700 border border-red-500/20',
    icon: 'bg-slate-800/30 text-slate-400 border border-slate-700/30 hover:bg-slate-700/30 hover:text-slate-200 hover:border-slate-600/30 backdrop-blur-sm rounded-lg p-2'
  };
  
  return (
    <button
      ref={ref}
      className={`${base} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
});
export default Button;
