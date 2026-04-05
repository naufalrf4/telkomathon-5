import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost, apiUpload } from '../services/api';
import { Document } from '../types/api';

export function useDocuments() {
  const queryClient = useQueryClient();

  const { data: documents, isLoading, error, refetch } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await apiGet<{ documents: Document[]; total: number }>('/documents/');
      return res.documents;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => apiUpload<Document>('/documents/upload', formData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => apiPost<Document>(`/documents/${id}/retry`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });

  return {
    documents,
    isLoading,
    error,
    refetch,
    uploadDocument: uploadMutation.mutate,
    uploadDocumentAsync: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    retryDocument: retryMutation.mutate,
    retryDocumentAsync: retryMutation.mutateAsync,
    isRetryingDocument: retryMutation.isPending,
    deleteDocument: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
