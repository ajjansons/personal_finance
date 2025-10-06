import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/lib/repository';
import type { ResearchReport } from '@/features/research/types';

type ListOptions = {
  enabled?: boolean;
  limit?: number;
  subjectKey?: string;
  subjectType?: 'holding' | 'sector';
};

export function useResearchReports(options?: ListOptions) {
  const { enabled = true, limit, subjectKey, subjectType } = options ?? {};
  return useQuery<ResearchReport[]>({
    queryKey: ['researchReports', { limit, subjectKey, subjectType }],
    queryFn: () => getRepository().getResearchReports({ limit, subjectKey, subjectType }),
    enabled
  });
}

export function useDeleteResearchReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getRepository().deleteResearchReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['researchReports'] });
    }
  });
}
