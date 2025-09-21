import { describe, it, expect } from 'vitest';
import { convert } from '@/lib/fx/twelveDataFx';

describe('convert USD↔EUR', () => {
  const rate = 0.8; // 1 USD = 0.8 EUR
  it('USD to EUR', () => {
    expect(convert(100, 'USD', 'EUR', rate)).toBeCloseTo(80);
  });
  it('EUR to USD', () => {
    expect(convert(80, 'EUR', 'USD', rate)).toBeCloseTo(100);
  });
  it('No-op same currency', () => {
    expect(convert(50, 'USD', 'USD', rate)).toBe(50);
  });
  it('Bad rate falls back to amount', () => {
    expect(convert(50, 'USD', 'EUR', 0)).toBe(50);
  });
});

