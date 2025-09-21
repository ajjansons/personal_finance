import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chainProvider } from '@/lib/market-data/chainProvider';
import { Holding } from '@/lib/repository/types';

export type Quote = { price: number; currency: 'USD' | 'EUR'; asOf: string; changePercent?: number; changeAbs?: number };

function keyFor(h: Pick<Holding, 'type' | 'symbol'>) {
  return `${h.type}:${(h.symbol || '').toUpperCase()}`;
}

export function useQuotes(holdings: Holding[]) {
  const qc = useQueryClient();
  const items = (holdings || [])
    .filter((h) => (h.type === 'stock' || h.type === 'crypto') && !!h.symbol)
    .map((h) => ({ type: h.type, symbol: (h.symbol || '').toUpperCase() }));
  const uniqKeys = Array.from(new Set(items.map((i) => `${i.type}:${i.symbol}`)));

  const q = useQuery<Record<string, Quote>>({
    queryKey: ['quotes', ...uniqKeys],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const map: Record<string, Quote> = {};
      await Promise.all(
        uniqKeys.map(async (k) => {
          const [type, symbol] = k.split(':');
          try {
            const { price, currency, asOf, changePercent, changeAbs } = await chainProvider.getQuote(symbol, type as any);
            map[k] = { price, currency: (currency as any) || 'USD', asOf, changePercent, changeAbs } as Quote;
          } catch {
            // ignore failures; leave undefined
          }
        })
      );
      return map;
    }
  });

  return {
    quotes: q.data || {},
    isLoading: q.isLoading,
    isError: q.isError,
    refresh: () => qc.invalidateQueries({ queryKey: ['quotes'] })
  };
}
