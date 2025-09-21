import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/lib/repository';
import { Transaction } from '@/lib/repository/types';

const repo = getRepository();

export function useTransactions(holdingId?: string) {
  const qc = useQueryClient();
  const transactionsQ = useQuery<Transaction[]>({
    queryKey: ['transactions', holdingId || 'all'],
    queryFn: () => (holdingId ? repo.getTransactions(holdingId) : repo.getAllTransactions())
  });

  const add = useMutation({
    mutationFn: (payload: Omit<Transaction, 'id'>) => repo.addTransaction(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['holdings'] });
    }
  });

  return {
    data: transactionsQ.data,
    isLoading: transactionsQ.isLoading,
    addTransaction: add.mutateAsync
  };
}

