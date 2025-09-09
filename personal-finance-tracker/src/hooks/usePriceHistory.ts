import { useQuery } from '@tanstack/react-query';
import { getRepository } from '@/lib/repository';
import { PricePoint } from '@/lib/repository/types';

const repo = getRepository();

export function usePriceHistory(holdingId?: string) {
  return useQuery<PricePoint[]>({
    queryKey: ['pricePoints', holdingId || 'all'],
    queryFn: () => (holdingId ? repo.getPriceHistory(holdingId) : repo.getAllPricePoints())
  });
}

