import { render, screen } from '@testing-library/react';
import HoldingsTable from '@/components/tables/HoldingsTable';
import { HoldingWithValue } from '@/lib/repository/types';

describe('HoldingsTable', () => {
  it('renders rows and total', () => {
    const rows: HoldingWithValue[] = [
      { id: '1', type: 'stock', name: 'A', units: 1, pricePerUnit: 100, currency: 'EUR', tags: [], createdAt: '', updatedAt: '', isDeleted: false, marketValue: 100 } as any,
      { id: '2', type: 'crypto', name: 'B', units: 2, pricePerUnit: 50, currency: 'EUR', tags: [], createdAt: '', updatedAt: '', isDeleted: false, marketValue: 100 } as any
    ];
    render(<HoldingsTable data={rows} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText(/Total/)).toBeInTheDocument();
  });
});

