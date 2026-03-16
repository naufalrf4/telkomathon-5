import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { designSessionsService } from '../services/designSessions';
import type { CourseContextPayload, DesignSession, FinalizeDesignSessionResult } from '../types/designSession';

const designSessionKeys = {
  all: ['design-sessions'] as const,
  detail: (sessionId: string) => ['design-sessions', sessionId] as const,
};

export function useDesignSessionList() {
  return useQuery({
    queryKey: designSessionKeys.all,
    queryFn: async () => {
      const result = await designSessionsService.list();
      return result.sessions;
    },
  });
}

export function useDesignSession(sessionId?: string) {
  const queryClient = useQueryClient();

  const syncSession = (session: DesignSession) => {
    queryClient.setQueryData(designSessionKeys.detail(session.id), session);
    queryClient.invalidateQueries({ queryKey: designSessionKeys.all });
  };

  const sessionQuery = useQuery({
    queryKey: sessionId ? designSessionKeys.detail(sessionId) : designSessionKeys.all,
    queryFn: () => designSessionsService.get(sessionId as string),
    enabled: !!sessionId,
  });

  const createMutation = useMutation({
    mutationFn: (documentIds: string[]) => designSessionsService.create(documentIds),
    onSuccess: syncSession,
  });

  const startAssistMutation = useMutation({
    mutationFn: () => designSessionsService.startAssist(sessionId as string),
    onSuccess: syncSession,
  });

  const updateCourseContextMutation = useMutation({
    mutationFn: (payload: CourseContextPayload) => designSessionsService.updateCourseContext(sessionId as string, payload),
    onSuccess: syncSession,
  });

  const generateTloOptionsMutation = useMutation({
    mutationFn: () => designSessionsService.generateTloOptions(sessionId as string),
    onSuccess: syncSession,
  });

  const selectTloMutation = useMutation({
    mutationFn: (optionId: string) => designSessionsService.selectTlo(sessionId as string, optionId),
    onSuccess: syncSession,
  });

  const generatePerformanceOptionsMutation = useMutation({
    mutationFn: () => designSessionsService.generatePerformanceOptions(sessionId as string),
    onSuccess: syncSession,
  });

  const selectPerformanceMutation = useMutation({
    mutationFn: (optionId: string) => designSessionsService.selectPerformance(sessionId as string, optionId),
    onSuccess: syncSession,
  });

  const generateEloOptionsMutation = useMutation({
    mutationFn: () => designSessionsService.generateEloOptions(sessionId as string),
    onSuccess: syncSession,
  });

  const selectElosMutation = useMutation({
    mutationFn: (optionIds: string[]) => {
      const session = sessionQuery.data;
      if (!session) {
        throw new Error('Sesi desain belum tersedia.');
      }

      const selectedOptions = session.elo_options.filter((option) => optionIds.includes(option.id));
      return designSessionsService.selectElos(sessionId as string, selectedOptions);
    },
    onSuccess: syncSession,
  });

  const finalizeMutation = useMutation({
    mutationFn: () => designSessionsService.finalize(sessionId as string),
    onSuccess: (result: FinalizeDesignSessionResult) => {
      syncSession(result.session);
      queryClient.setQueryData(['syllabus', result.syllabus.id], result.syllabus);
      queryClient.invalidateQueries({ queryKey: ['syllabi'] });
    },
  });

  const isWorking =
    createMutation.isPending ||
    startAssistMutation.isPending ||
    updateCourseContextMutation.isPending ||
    generateTloOptionsMutation.isPending ||
    selectTloMutation.isPending ||
    generatePerformanceOptionsMutation.isPending ||
    selectPerformanceMutation.isPending ||
    generateEloOptionsMutation.isPending ||
    selectElosMutation.isPending ||
    finalizeMutation.isPending;

  return {
    session: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    error: sessionQuery.error,
    isWorking,
    refetch: sessionQuery.refetch,
    createSession: createMutation.mutateAsync,
    isCreatingSession: createMutation.isPending,
    startAssist: startAssistMutation.mutateAsync,
    updateCourseContext: updateCourseContextMutation.mutateAsync,
    generateTloOptions: generateTloOptionsMutation.mutateAsync,
    selectTlo: selectTloMutation.mutateAsync,
    generatePerformanceOptions: generatePerformanceOptionsMutation.mutateAsync,
    selectPerformance: selectPerformanceMutation.mutateAsync,
    generateEloOptions: generateEloOptionsMutation.mutateAsync,
    selectElos: selectElosMutation.mutateAsync,
    finalizeSession: finalizeMutation.mutateAsync,
  };
}
