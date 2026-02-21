import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../services/api';
import { Syllabus, PersonalizationResult, CompetencyGap } from '../types/api';

export function useSyllabus(id?: string) {
  const queryClient = useQueryClient();

  // List all syllabi
  const { data: syllabi, isLoading: isLoadingList } = useQuery({
    queryKey: ['syllabi'],
    queryFn: () => apiGet<Syllabus[]>('/syllabi'),
    enabled: !id,
  });

  // Get specific syllabus
  const { data: syllabus, isLoading: isLoadingDetails } = useQuery({
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

  // Get personalization result
  const { data: personalization } = useQuery({
    queryKey: ['personalize', id],
    queryFn: () => apiGet<PersonalizationResult>(`/personalize/${id}`),
    enabled: !!id,
  });

  return {
    syllabi,
    syllabus,
    isLoading: isLoadingList || isLoadingDetails,
    personalize: personalizeMutation.mutate,
    isPersonalizing: personalizeMutation.isPending,
    personalization,
  };
}
