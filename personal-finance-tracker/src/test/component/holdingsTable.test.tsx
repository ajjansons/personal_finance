import { render, screen } from '@testing-library/react';
import HoldingsTable from '@/components/tables/HoldingsTable';
import { Holding } from '@/lib/repository/types';

describe('HoldingsTable', () => {
  it('renders rows and total', () => {
    const rows: (Holding & {
      priceDisplay: number | null;
      costBasisDisplay: number;
      currentValueDisplay: number;
      gainDisplay: number;
      gainPercent: number | null;
      dailyChangePercent?: number;
      holdingCurrency: 'USD' | 'EUR';
    })[] = [
      {
        id: '1',
        type: 'stock',
        name: 'A',
        units: 1,
        pricePerUnit: 100,
        currency: 'EUR',
        tags: [],
        createdAt: '',
        updatedAt: '',
        isDeleted: false,
        priceDisplay: 100,
        costBasisDisplay: 80,
        currentValueDisplay: 100,
        gainDisplay: 20,
        gainPercent: 25,
        dailyChangePercent: 1.2,
        holdingCurrency: 'EUR'
      } as any,
      {
        id: '2',
        type: 'crypto',
        name: 'B',
        units: 2,
        pricePerUnit: 50,
        currency: 'EUR',
        tags: [],
        createdAt: '',
        updatedAt: '',
        isDeleted: false,
        priceDisplay: 50,
        costBasisDisplay: 60,
        currentValueDisplay: 100,
        gainDisplay: 40,
        gainPercent: 66.67,
        dailyChangePercent: -0.5,
        holdingCurrency: 'EUR'
      } as any
    ];
    const totalCurrentValue = rows.reduce((sum, row) => sum + row.currentValueDisplay, 0);
    render(<HoldingsTable data={rows} displayCurrency="EUR" totalCurrentValue={totalCurrentValue} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getAllByText(/Total/).length).toBeGreaterThan(0);
  });
});
