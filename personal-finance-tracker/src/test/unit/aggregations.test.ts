import { describe, it, expect } from 'vitest';
import { computeAllocationsByType } from '@/lib/calculations';
import { Holding } from '@/lib/repository/types';

describe('allocations', () => {
  it('allocates by type', () => {
    const holdings: Holding[] = [
      { id: '1', type: 'stock', name: 'A', units: 1, pricePerUnit: 100, currency: 'EUR', tags: [], createdAt: '', updatedAt: '', isDeleted: false } as any,
      { id: '2', type: 'crypto', name: 'B', units: 2, pricePerUnit: 50, currency: 'EUR', tags: [], createdAt: '', updatedAt: '', isDeleted: false } as any
    ];
    const res = computeAllocationsByType(holdings);
    // both are 100
    expect(res.find(r => r.name === 'stock')?.percent).toBeCloseTo(0.5);
    expect(res.find(r => r.name === 'crypto')?.percent).toBeCloseTo(0.5);
  });
});

