import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/lib/repository';
import type { PriceAlertCreate } from '@/lib/repository/types';

const repo = getRepository();

export function usePriceAlerts(holdingId?: string) {
  const qc = useQueryClient();
  const key = ['price-alerts', holdingId || 'all'];

  const listQuery = useQuery({
    queryKey: key,
    queryFn: () => repo.getPriceAlerts(holdingId)
  });

  const create = useMutation({
    mutationFn: (payload: PriceAlertCreate) => repo.createPriceAlert(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    }
  });

  const remove = useMutation({
    mutationFn: (id: string) => repo.deletePriceAlert(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
    }
  });

  return {
    alerts: listQuery.data || [],
    isLoading: listQuery.isLoading,
    createAlert: create.mutateAsync,
    deleteAlert: remove.mutateAsync
  };
}
