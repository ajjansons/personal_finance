import { useUIStore } from '@/lib/state/uiStore';

export default function CurrencyToggle({ className = '' }: { className?: string }) {
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  const setDisplayCurrency = useUIStore((s) => s.setDisplayCurrency);
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <label className="text-sm text-slate-400">Currency</label>
      <select
        aria-label="Display currency"
        className="px-2 py-1 rounded bg-slate-800/40 border border-slate-700/50 text-slate-200 text-sm"
        value={displayCurrency}
        onChange={(e) => setDisplayCurrency(e.target.value as 'USD' | 'EUR')}
      >
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
      </select>
    </div>
  );
}

