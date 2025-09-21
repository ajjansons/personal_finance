import { render, screen } from '@testing-library/react';
import HoldingsTable from '@/components/tables/HoldingsTable';
import { Holding } from '@/lib/repository/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('HoldingsTable', () => {
  it('renders rows and total', () => {
    const rows: (Holding & { marketValue?: number })[] = [
      { id: '1', type: 'stock', name: 'A', units: 1, pricePerUnit: 100, currency: 'EUR', tags: [], createdAt: '', updatedAt: '', isDeleted: false } as any,
      { id: '2', type: 'crypto', name: 'B', units: 2, pricePerUnit: 50, currency: 'EUR', tags: [], createdAt: '', updatedAt: '', isDeleted: false } as any
    ];
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <HoldingsTable data={rows} />
      </QueryClientProvider>
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getAllByText(/Total/).length).toBeGreaterThan(0);
  });
});
