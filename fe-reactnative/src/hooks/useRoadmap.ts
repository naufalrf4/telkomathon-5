import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPost } from '../services/api';
import type { CareerRoadmapRequestPayload, CareerRoadmapResult } from '../types/api';

export function useRoadmap(syllabusId?: string) {
  const queryClient = useQueryClient();

  const {
    data: roadmaps,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['roadmaps', syllabusId],
    queryFn: async () => {
      const res = await apiGet<{ results: CareerRoadmapResult[]; total: number }>(`/roadmaps/${syllabusId}`);
      return res.results;
    },
    enabled: !!syllabusId,
  });

  const createRoadmapMutation = useMutation({
    mutationFn: (payload: CareerRoadmapRequestPayload) => apiPost<CareerRoadmapResult>(`/roadmaps/${syllabusId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps', syllabusId] });
      queryClient.invalidateQueries({ queryKey: ['history', syllabusId] });
      queryClient.invalidateQueries({ queryKey: ['history-aggregate', syllabusId] });
      queryClient.invalidateQueries({ queryKey: ['revisions', syllabusId] });
    },
  });

  return {
    roadmaps,
    isLoading,
    error,
    refetch,
    createRoadmap: createRoadmapMutation.mutate,
    createRoadmapAsync: createRoadmapMutation.mutateAsync,
    isCreatingRoadmap: createRoadmapMutation.isPending,
  };
}
