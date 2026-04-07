import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../services/api';
import type { ChatHistory, ChatMessage } from '../types/chat';
import type { Syllabus } from '../types/api';

interface SectionDecisionInput {
  messageId: string;
  sectionKey: string;
}

export function useRevisionChat(syllabusId: string) {
  const queryClient = useQueryClient();

  // Query: GET /syllabi/{id}/chat → ChatHistory
  const historyQuery = useQuery({
    queryKey: ['revision-chat', syllabusId],
    queryFn: () => apiGet<ChatHistory>(`/syllabi/${syllabusId}/chat`),
    enabled: !!syllabusId,
  });

  // Mutation: POST /syllabi/{id}/chat → ChatMessage
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiPost<ChatMessage>(`/syllabi/${syllabusId}/chat`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revision-chat', syllabusId] });
    },
  });

  // Mutation: POST /syllabi/{id}/chat/{msgId}/accept → Syllabus
  const acceptMutation = useMutation({
    mutationFn: ({ messageId, sectionKey }: SectionDecisionInput) =>
      apiPost<Syllabus>(`/syllabi/${syllabusId}/chat/${messageId}/accept`, { section_key: sectionKey }),
    onSuccess: (data) => {
      queryClient.setQueryData(['syllabus', syllabusId], data);
      queryClient.invalidateQueries({ queryKey: ['syllabi'] });
      queryClient.invalidateQueries({ queryKey: ['revision-chat', syllabusId] });
      queryClient.removeQueries({ queryKey: ['personalize', syllabusId] });
    },
  });

  // Mutation: POST /syllabi/{id}/chat/{msgId}/reject → ChatMessage
  const rejectMutation = useMutation({
    mutationFn: ({ messageId, sectionKey }: SectionDecisionInput) =>
      apiPost<ChatMessage>(`/syllabi/${syllabusId}/chat/${messageId}/reject`, { section_key: sectionKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revision-chat', syllabusId] });
    },
  });

  return {
    messages: historyQuery.data?.messages ?? [],
    isLoadingHistory: historyQuery.isLoading,
    historyError: historyQuery.error,
    refetchHistory: historyQuery.refetch,
    sendMessage: sendMutation.mutateAsync,
    isSending: sendMutation.isPending,
    sendError: sendMutation.error,
    acceptRevision: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    rejectRevision: rejectMutation.mutateAsync,
    isRejecting: rejectMutation.isPending,
  };
}
