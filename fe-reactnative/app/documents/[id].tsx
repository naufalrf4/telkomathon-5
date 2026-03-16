import { View, Text, ScrollView, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete, getErrorMessage } from '../../src/services/api';
import { Document } from '../../src/types/api';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => apiGet<Document>(`/documents/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
    onError: (error: unknown) => {
      Alert.alert('Kesalahan', getErrorMessage(error, 'Gagal menghapus dokumen'));
    },
  });

  const confirmDelete = () => {
    Alert.alert('Hapus Dokumen', 'Yakin ingin menghapus file ini? Tindakan ini tidak dapat dibatalkan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteMutation.mutate() }
    ]);
  };

  if (isLoading || !document) return <LoadingSpinner fullScreen message="Memuat detail..." />;

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      uploaded: 'Diunggah',
      processing: 'Diproses',
      ready: 'Siap',
      failed: 'Gagal',
    };
    return labels[status] ?? status;
  };

  const getFileIcon = (type: string | undefined | null) => {
    if (!type) return 'document-outline';
    if (type.includes('pdf')) return 'document-text';
    if (type.includes('word') || type.includes('docx')) return 'document';
    if (type.includes('presentation') || type.includes('pptx')) return 'easel';
    return 'document-outline';
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-6 py-6 max-w-5xl mx-auto w-full">
        {/* Breadcrumb */}
        <View className="flex-row items-center mb-6">
          <Pressable 
            onPress={() => router.back()}
            className="flex-row items-center text-gray-500 hover:text-gray-900 transition-colors"
          >
            <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
            <Text className="ml-1 text-gray-500 font-medium">Dokumen</Text>
          </Pressable>
          <Text className="mx-2 text-gray-400">/</Text>
          <Text className="text-gray-900 font-medium" numberOfLines={1}>Detail</Text>
        </View>

        {/* Main Info Card */}
        <Card className="mb-6 p-6">
          <View className="flex-row items-start">
            <View className="w-20 h-20 bg-red-50 rounded-2xl items-center justify-center mr-6">
              <Ionicons name={getFileIcon(document.file_type)} size={40} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900 mb-2">{document.filename}</Text>
              <View className="flex-row items-center flex-wrap gap-2 mb-4">
                <Badge 
                  label={getStatusLabel(document.status)} 
                  variant={document.status === 'ready' ? 'success' : document.status === 'failed' ? 'error' : 'warning'} 
                />
                <Text className="text-sm text-gray-500">•</Text>
                <Text className="text-sm text-gray-500">{document.created_at ? new Date(document.created_at).toLocaleDateString('id-ID') : '-'}</Text>
                <Text className="text-sm text-gray-500">•</Text>
                <Text className="text-sm text-gray-500">{document.file_type ?? '-'}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Status / Info */}
        <View className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Status Pemrosesan</Text>
          
          {document.status === 'ready' ? (
            <View className="bg-green-50 border border-green-100 rounded-lg p-4 flex-row items-start">
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <View className="ml-3 flex-1">
                <Text className="font-bold text-green-800 mb-1">Siap untuk Pembuatan Silabus</Text>
                <Text className="text-green-700 text-sm">
                  Dokumen ini telah berhasil diproses. Konten sudah terindeks dan siap digunakan untuk pembuatan silabus.
                </Text>
              </View>
            </View>
          ) : (
             <View className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex-row items-start">
              <LoadingSpinner />
              <View className="ml-3 flex-1">
                <Text className="font-bold text-blue-800 mb-1">Sedang Memproses...</Text>
                <Text className="text-blue-700 text-sm">
                  Kami sedang menganalisis konten dokumen. Ini mungkin memakan waktu beberapa saat tergantung pada ukuran file.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Actions */}
        <View className="flex-row flex-wrap justify-end gap-3">
          {document.status === 'ready' ? (
            <Button
              title="Buat Syllabus Baru"
              variant="outline"
              onPress={() => router.push('/syllabus/create')}
              icon={<Ionicons name="sparkles-outline" size={18} color={colors.primary} />}
            />
          ) : null}
          <Button 
            title="Hapus Dokumen" 
            variant="danger" 
            onPress={confirmDelete}
            isLoading={deleteMutation.isPending}
            icon={<Ionicons name="trash-outline" size={18} color="white" />}
          />
        </View>
      </View>
    </ScrollView>
  );
}
