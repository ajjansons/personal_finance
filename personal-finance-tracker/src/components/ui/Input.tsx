import { InputHTMLAttributes, forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function InputComponent(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-400 backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-slate-800/70 hover:border-slate-600/50 ${className}`}
      {...props}
    />
  );
});
export default Input;

