import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiGetBlob, apiPost } from '../services/api';
import {
  ApplySyllabusRevisionPayload,
  BulkParticipantInput,
  BulkPersonalizationResponse,
  CompetencyGap,
  ModuleDecomposition,
  OwnerHistoryAggregation,
  OwnerHistoryEvent,
  PersonalizationResult,
  RevisionNote,
  Syllabus,
} from '../types/api';

interface UseSyllabusOptions {
  includePersonalization?: boolean;
  includeBulkPersonalization?: boolean;
  includeModules?: boolean;
  includeHistory?: boolean;
  includeRevisions?: boolean;
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
    mutationFn: (payload: { participantName: string; gaps: CompetencyGap[] }) =>
      apiPost<PersonalizationResult>(`/personalize/${id}`, {
        participant_name: payload.participantName,
        competency_gaps: payload.gaps,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['personalize', id], data);
      queryClient.invalidateQueries({ queryKey: ['history', id] });
      queryClient.invalidateQueries({ queryKey: ['history-aggregate', id] });
      queryClient.invalidateQueries({ queryKey: ['revisions', id] });
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
      queryClient.invalidateQueries({ queryKey: ['history', id] });
      queryClient.invalidateQueries({ queryKey: ['history-aggregate', id] });
      queryClient.invalidateQueries({ queryKey: ['revisions', id] });
    },
  });

  const applyRevisionMutation = useMutation({
    mutationFn: (payload: ApplySyllabusRevisionPayload) => apiPost<Syllabus>(`/syllabi/${id}/apply-revision`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['syllabus', id], data);
      queryClient.invalidateQueries({ queryKey: ['syllabi'] });
      queryClient.invalidateQueries({ queryKey: ['chat', id] });
      queryClient.invalidateQueries({ queryKey: ['history', id] });
      queryClient.invalidateQueries({ queryKey: ['history-aggregate', id] });
      queryClient.invalidateQueries({ queryKey: ['modules', id] });
      queryClient.invalidateQueries({ queryKey: ['revisions', id] });
    },
  });

  // Get personalization result
  const { data: personalization, error: personalizationError } = useQuery<PersonalizationResult | null>({
    queryKey: ['personalize', id],
    queryFn: () => apiGet<PersonalizationResult | null>(`/personalize/${id}`),
    enabled: !!id && options?.includePersonalization === true,
  });

  const { data: bulkPersonalizations, error: bulkPersonalizationError, refetch: refetchBulkPersonalizations } = useQuery({
    queryKey: ['bulk-personalize', id],
    queryFn: async () => {
      const res = await apiGet<{ results: PersonalizationResult[]; total: number }>(`/personalize/${id}/bulk`);
      return res.results;
    },
    enabled: !!id && options?.includeBulkPersonalization === true,
  });

  const { data: modules, isLoading: isLoadingModules, error: modulesError, refetch: refetchModules } = useQuery({
    queryKey: ['modules', id],
    queryFn: async () => {
      const res = await apiGet<{ modules: ModuleDecomposition[]; total: number }>(`/syllabi/${id}/modules`);
      return res.modules;
    },
    enabled: !!id && options?.includeModules === true,
  });

  const decomposeMutation = useMutation({
    mutationFn: (moduleCountHint?: number) =>
      apiPost<{ modules: ModuleDecomposition[]; total: number }>(`/syllabi/${id}/decompose`, moduleCountHint ? { module_count_hint: moduleCountHint } : {}),
    onSuccess: (data) => {
      queryClient.setQueryData(['modules', id], data.modules);
      queryClient.invalidateQueries({ queryKey: ['history', id] });
      queryClient.invalidateQueries({ queryKey: ['history-aggregate', id] });
      queryClient.invalidateQueries({ queryKey: ['revisions', id] });
    },
  });

  const { data: history, isLoading: isLoadingHistory, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['history', id],
    queryFn: async () => {
      const res = await apiGet<{ items: OwnerHistoryEvent[]; total: number }>(`/syllabi/${id}/history`);
      return res.items;
    },
    enabled: !!id && options?.includeHistory === true,
  });

  const { data: historyAggregate, error: historyAggregateError } = useQuery({
    queryKey: ['history-aggregate', id],
    queryFn: () => apiGet<OwnerHistoryAggregation>(`/history/aggregate?syllabus_id=${id}`),
    enabled: !!id && options?.includeHistory === true,
  });

  const { data: revisions, isLoading: isLoadingRevisions, error: revisionsError, refetch: refetchRevisions } = useQuery({
    queryKey: ['revisions', id],
    queryFn: async () => {
      const res = await apiGet<{ items: RevisionNote[]; total: number }>(`/syllabi/${id}/revisions`);
      return res.items;
    },
    enabled: !!id && options?.includeRevisions === true,
  });

  const exportHistoryCsvMutation = useMutation({
    mutationFn: () => apiGetBlob(`/syllabi/${id}/history/export.csv`),
  });

  return {
    syllabi,
    syllabus,
    isLoading: isLoadingList || isLoadingDetails || isLoadingModules || isLoadingHistory || isLoadingRevisions,
    error: listError ?? detailError ?? personalizationError ?? bulkPersonalizationError ?? modulesError ?? historyError ?? historyAggregateError ?? revisionsError ?? null,
    refetch: id ? refetchSyllabus : refetchSyllabi,
    personalize: personalizeMutation.mutate,
    personalizeAsync: personalizeMutation.mutateAsync,
    isPersonalizing: personalizeMutation.isPending,
    personalization,
    bulkPersonalize: bulkPersonalizeMutation.mutate,
    bulkPersonalizeAsync: bulkPersonalizeMutation.mutateAsync,
    isBulkPersonalizing: bulkPersonalizeMutation.isPending,
    bulkPersonalizations,
    applyRevision: applyRevisionMutation.mutate,
    applyRevisionAsync: applyRevisionMutation.mutateAsync,
    isApplyingRevision: applyRevisionMutation.isPending,
    modules,
    decompose: decomposeMutation.mutate,
    decomposeAsync: decomposeMutation.mutateAsync,
    isDecomposing: decomposeMutation.isPending,
    refetchModules,
    history,
    historyAggregate,
    revisions,
    exportHistoryCsv: exportHistoryCsvMutation.mutate,
    exportHistoryCsvAsync: exportHistoryCsvMutation.mutateAsync,
    isExportingHistoryCsv: exportHistoryCsvMutation.isPending,
    refetchHistory,
    refetchRevisions,
    refetchBulkPersonalizations,
  };
}
