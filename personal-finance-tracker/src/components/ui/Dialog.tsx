import { ReactNode, useEffect } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: string;
  children: ReactNode;
};

export default function Dialog({ open, onOpenChange, title, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!open) return null;
  return (
    <div
      aria-modal="true"
      role="dialog"
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-lg rounded-md bg-white p-4 shadow"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

