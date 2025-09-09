import { InputHTMLAttributes, forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, Props>(function InputComponent(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`}
      {...props}
    />
  );
});
export default Input;

