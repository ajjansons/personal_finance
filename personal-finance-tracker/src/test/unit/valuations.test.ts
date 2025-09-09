import { describe, it, expect } from 'vitest';
import { calcMarketValue } from '@/lib/calculations';
import { Holding } from '@/lib/repository/types';

describe('calcMarketValue', () => {
  it('multiplies units by pricePerUnit', () => {
    const h: Holding = {
      id: 'h1',
      type: 'stock',
      name: 'Test',
      units: 10,
      pricePerUnit: 5.5,
      currency: 'EUR',
      tags: [],
      createdAt: '',
      updatedAt: '',
      isDeleted: false
    } as any;
    expect(calcMarketValue(h)).toBeCloseTo(55);
  });
});

