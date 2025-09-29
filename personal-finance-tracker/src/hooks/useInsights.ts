import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRepository } from '@/lib/repository';
import type { InsightRecord, InsightItem } from '@/lib/repository/types';
import { runInsightsJob } from '@/features/insights/insightsEngine';

export function useInsights(options?: { limit?: number }) {
  const limit = options?.limit ?? 5;
  return useQuery<InsightRecord[]>({
    queryKey: ['insights', { limit }],
    queryFn: () => getRepository().getInsights({ limit })
  });
}

export function useRunInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ signal }: { signal?: AbortSignal } = {}) => runInsightsJob({ signal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insights'] });
    }
  });
}

export function useInsightsByHolding(limit = 1) {
  const { data } = useInsights({ limit });
  return useMemo(() => {
    const latest = data && data.length > 0 ? data[0] : null;
    const map = new Map<string, InsightItem[]>();
    if (!latest) return map;
    latest.items.forEach((item) => {
      if (!item.holdingId) return;
      if (!map.has(item.holdingId)) {
        map.set(item.holdingId, []);
      }
      map.get(item.holdingId)!.push(item);
    });
    return map;
  }, [data]);
}
