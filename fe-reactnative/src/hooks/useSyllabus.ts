import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiGetBlob, apiPost } from '../services/api';
import {
  ApplySyllabusRevisionPayload,
  BulkParticipantInput,
  BulkPersonalizationResponse,
  CompetencyGap,
  PersonalizationResult,
  Syllabus,
} from '../types/api';

interface UseSyllabusOptions {
  includePersonalization?: boolean;
  includeBulkPersonalization?: boolean;
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

  const { data: syllabus, isLoading: isLoadingDetails, error: detailError, refetch: refetchSyllabus } = useQuery({
    queryKey: ['syllabus', id],
    queryFn: () => apiGet<Syllabus>(`/syllabi/${id}`),
    enabled: !!id,
  });

  const personalizeMutation = useMutation({
    mutationFn: (payload: { participantName: string; gaps: CompetencyGap[] }) =>
      apiPost<PersonalizationResult>(`/personalize/${id}`, {
        participant_name: payload.participantName,
        competency_gaps: payload.gaps,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['personalize', id], data);
    },
  });

  const bulkPersonalizeMutation = useMutation({
    mutationFn: (participants: BulkParticipantInput[]) =>
      apiPost<BulkPersonalizationResponse>(`/personalize/${id}/bulk`, {
        participants: participants.map((participant) => ({
          participant_name: participant.participant_name,
          competency_gaps: participant.competency_gaps,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-personalize', id] });
    },
  });

  const applyRevisionMutation = useMutation({
    mutationFn: (payload: ApplySyllabusRevisionPayload) => apiPost<Syllabus>(`/syllabi/${id}/apply-revision`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['syllabus', id], data);
      queryClient.invalidateQueries({ queryKey: ['syllabi'] });
      queryClient.removeQueries({ queryKey: ['personalize', id] });
      queryClient.removeQueries({ queryKey: ['bulk-personalize', id] });
    },
  });

  const exportDocxMutation = useMutation({
    mutationFn: () => apiGetBlob(`/syllabi/${id}/download.docx`),
  });

  const exportPdfMutation = useMutation({
    mutationFn: () => apiGetBlob(`/syllabi/${id}/download.pdf`),
  });

  const personalizationQuery = useQuery<PersonalizationResult | null>({
    queryKey: ['personalize', id],
    queryFn: () => apiGet<PersonalizationResult | null>(`/personalize/${id}`),
    enabled: !!id && options?.includePersonalization === true,
  });

  const { data: personalization, error: personalizationError } = personalizationQuery;

  const { data: bulkPersonalizations, error: bulkPersonalizationError, refetch: refetchBulkPersonalizations } = useQuery({
    queryKey: ['bulk-personalize', id],
    queryFn: async () => {
      const res = await apiGet<{ results: PersonalizationResult[]; total: number }>(`/personalize/${id}/bulk`);
      return res.results;
    },
    enabled: !!id && options?.includeBulkPersonalization === true,
  });

  return {
    syllabi,
    syllabus,
    isLoading: isLoadingList || isLoadingDetails,
    error: listError ?? detailError ?? personalizationError ?? bulkPersonalizationError ?? null,
    refetch: id ? refetchSyllabus : refetchSyllabi,
    personalize: personalizeMutation.mutate,
    personalizeAsync: personalizeMutation.mutateAsync,
    isPersonalizing: personalizeMutation.isPending,
    isLoadingPersonalization: personalizationQuery.isLoading,
    personalization,
    clearPersonalization: () => queryClient.removeQueries({ queryKey: ['personalize', id] }),
    bulkPersonalize: bulkPersonalizeMutation.mutate,
    bulkPersonalizeAsync: bulkPersonalizeMutation.mutateAsync,
    isBulkPersonalizing: bulkPersonalizeMutation.isPending,
    bulkPersonalizations,
    refetchBulkPersonalizations,
    applyRevision: applyRevisionMutation.mutate,
    applyRevisionAsync: applyRevisionMutation.mutateAsync,
    isApplyingRevision: applyRevisionMutation.isPending,
    downloadSyllabusDocx: exportDocxMutation.mutate,
    downloadSyllabusDocxAsync: exportDocxMutation.mutateAsync,
    isDownloadingSyllabusDocx: exportDocxMutation.isPending,
    downloadSyllabusPdf: exportPdfMutation.mutate,
    downloadSyllabusPdfAsync: exportPdfMutation.mutateAsync,
    isDownloadingSyllabusPdf: exportPdfMutation.isPending,
  };
}
