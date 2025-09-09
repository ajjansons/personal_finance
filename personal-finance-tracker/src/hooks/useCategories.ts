import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/lib/repository';
import { Category } from '@/lib/repository/types';

const repo = getRepository();

export function useCategories() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['categories'],
    queryFn: () => repo.getCategories()
  });

  const create = useMutation({
    mutationFn: (payload: Omit<Category, 'id'>) => repo.createCategory(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
  });

  const del = useMutation({
    mutationFn: (id: string) => repo.deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] })
  });

  return {
    data: q.data,
    isLoading: q.isLoading,
    createCategory: create.mutateAsync,
    deleteCategory: del.mutateAsync
  };
}

