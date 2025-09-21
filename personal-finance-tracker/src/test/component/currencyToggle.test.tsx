import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CurrencyToggle from '@/components/ui/CurrencyToggle';
import { useUIStore } from '@/lib/state/uiStore';
import { convert } from '@/lib/fx/twelveDataFx';
import { formatCurrency } from '@/lib/utils/date';

function Amount() {
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  // Assume a fixed FX rate for test: 1 USD = 0.5 EUR
  const rate = 0.5;
  const value = convert(100, 'USD', displayCurrency, rate);
  return <div aria-label="amount">{formatCurrency(value, displayCurrency)}</div>;
}

describe('CurrencyToggle', () => {
  it('switches labels/values when toggled', async () => {
    render(
      <div>
        <CurrencyToggle />
        <Amount />
      </div>
    );

    const select = screen.getByLabelText('Display currency') as HTMLSelectElement;
    const amount = () => screen.getByLabelText('amount').textContent || '';

    // Default is EUR -> 100 USD becomes 50 EUR
    expect(amount()).toMatch(/(€|EUR)/);

    fireEvent.change(select, { target: { value: 'USD' } });
    expect(amount()).toMatch(/(\$|USD)/);
  });
});

