import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../services/api';
import {
  ApplySyllabusRevisionPayload,
  CompetencyGap,
  PersonalizationResult,
  Syllabus,
} from '../types/api';

interface UseSyllabusOptions {
  includePersonalization?: boolean;
}

export function useSyllabus(id?: string, options?: UseSyllabusOptions) {
  const queryClient = useQueryClient();

  const { data: syllabi, isLoading: isLoadingList, error: listError, refetch: refetchSyllabi } = useQuery({
    queryKey: ['syllabi'],
    queryFn: async () => {
      const res = await apiGet<{ syllabi: Syllabus[]; total: number }>('/syllabi/');
      return res.syllabi;
    },
    enabled: !id,
  });

  // Get specific syllabus
  const { data: syllabus, isLoading: isLoadingDetails, error: detailError, refetch: refetchSyllabus } = useQuery({
    queryKey: ['syllabus', id],
    queryFn: () => apiGet<Syllabus>(`/syllabi/${id}`),
    enabled: !!id,
  });

  // Personalize syllabus
  const personalizeMutation = useMutation({
    mutationFn: (gaps: CompetencyGap[]) => apiPost<PersonalizationResult>(`/personalize/${id}`, { competency_gaps: gaps }),
    onSuccess: (data) => {
      queryClient.setQueryData(['personalize', id], data);
    },
  });

  const applyRevisionMutation = useMutation({
    mutationFn: (payload: ApplySyllabusRevisionPayload) => apiPost<Syllabus>(`/syllabi/${id}/apply-revision`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['syllabus', id], data);
      queryClient.invalidateQueries({ queryKey: ['syllabi'] });
      queryClient.invalidateQueries({ queryKey: ['chat', id] });
    },
  });

  // Get personalization result
  const { data: personalization } = useQuery({
    queryKey: ['personalize', id],
    queryFn: () => apiGet<PersonalizationResult>(`/personalize/${id}`),
    enabled: !!id && options?.includePersonalization === true,
  });

  return {
    syllabi,
    syllabus,
    isLoading: isLoadingList || isLoadingDetails,
    error: listError ?? detailError ?? null,
    refetch: id ? refetchSyllabus : refetchSyllabi,
    personalize: personalizeMutation.mutate,
    isPersonalizing: personalizeMutation.isPending,
    personalization,
    applyRevision: applyRevisionMutation.mutate,
    applyRevisionAsync: applyRevisionMutation.mutateAsync,
    isApplyingRevision: applyRevisionMutation.isPending,
  };
}
