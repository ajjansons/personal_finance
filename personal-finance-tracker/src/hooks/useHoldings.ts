import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/lib/repository';
import { Holding } from '@/lib/repository/types';

const repo = getRepository();

export function useHoldings() {
  const qc = useQueryClient();

  const holdingsQ = useQuery({
    queryKey: ['holdings'],
    queryFn: () => repo.getHoldings({ includeDeleted: false })
  });

  const create = useMutation({
    mutationFn: (payload: Omit<Holding, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>) =>
      repo.createHolding(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holdings'] })
  });

  const update = useMutation({
    mutationFn: (payload: Holding) => repo.updateHolding(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holdings'] })
  });

  const softDelete = useMutation({
    mutationFn: (id: string) => repo.softDeleteHolding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holdings'] })
  });

  const appendNote = useMutation({
    mutationFn: ({ holdingId, text }: { holdingId: string; text: string }) =>
      repo.appendHoldingNote(holdingId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holdings'] })
  });

  return {
    data: holdingsQ.data,
    isLoading: holdingsQ.isLoading,
    createHolding: create.mutateAsync,
    updateHolding: update.mutateAsync,
    softDeleteHolding: softDelete.mutateAsync,
    appendNote: appendNote.mutateAsync
  };
}
