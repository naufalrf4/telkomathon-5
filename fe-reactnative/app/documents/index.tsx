import { View, Text, FlatList, Alert, Platform, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { colors } from '../../src/theme/colors';
import { Document } from '../../src/types/api';
import { useState } from 'react';
import { UploadModal } from '../../src/components/documents/UploadModal';

export default function DocumentsScreen() {
  const router = useRouter();
  const { documents, isLoading, uploadDocument, isUploading, deleteDocument } = useDocuments();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const [modalVisible, setModalVisible] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const confirmDelete = (id: string) => {
    Alert.alert('Hapus Dokumen', 'Yakin ingin menghapus file ini? Tindakan ini tidak dapat dibatalkan.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Hapus', style: 'destructive', onPress: () => deleteDocument(id) }
    ]);
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      uploaded: 'Diunggah',
      processing: 'Diproses',
      processed: 'Selesai',
      ready: 'Siap',
      failed: 'Gagal',
    };
    return map[status] ?? status;
  };

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('id-ID');
  };

  const getFileIcon = (type: string | undefined | null) => {
    if (!type) return 'document-outline';
    if (type.includes('pdf')) return 'document-text';
    if (type.includes('word') || type.includes('docx')) return 'document';
    if (type.includes('presentation') || type.includes('pptx')) return 'easel';
    return 'document-outline';
  };

  const renderItem = ({ item }: { item: Document }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow duration-200">
      <View className="flex-row items-center justify-between">
        <Pressable 
          className="flex-row items-center flex-1" 
          onPress={() => router.push(`/documents/${item.id}`)}
        >
          <View className="w-12 h-12 rounded-lg bg-red-50 items-center justify-center mr-4">
            <Ionicons name={getFileIcon(item.file_type)} size={24} color={colors.primary} />
          </View>
          <View className="flex-1 pr-4">
            <Text className="text-base font-semibold text-gray-900 mb-1" numberOfLines={1}>{item.filename}</Text>
            <View className="flex-row items-center space-x-2">
              <Badge 
                label={getStatusLabel(item.status)} 
                variant={item.status === 'processed' || item.status === 'ready' ? 'success' : item.status === 'failed' ? 'error' : 'warning'} 
                size="sm"
              />
              <Text className="text-xs text-gray-500">
                {formatDate(item.created_at)}
              </Text>
            </View>
          </View>
        </Pressable>
        
        <View className="flex-row items-center space-x-2">
          {isDesktop && (
            <Button 
              title="Lihat" 
              variant="outline" 
              size="sm" 
              onPress={() => router.push(`/documents/${item.id}`)}
            />
          )}
          <Pressable 
            onPress={() => confirmDelete(item.id)}
            className="p-2 rounded-full hover:bg-red-50"
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </Card>
  );

  if (isLoading) return <LoadingSpinner fullScreen message="Memuat dokumen..." />;

  return (
    <View className="flex-1 bg-gray-50 relative">
      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 24, paddingBottom: isDesktop ? 40 : 100 }}
        ListHeaderComponent={
          <View>
            <View className="flex-row justify-between items-center mb-8">
              <View>
                <Text className="text-2xl font-bold text-gray-900">Dokumen Saya</Text>
                <Text className="text-sm text-gray-500 mt-1">Kelola materi pembelajaran Anda</Text>
              </View>
              {isDesktop && (
                <Button 
                  title="Unggah" 
                  onPress={() => setModalVisible(true)} 
                  isLoading={isUploading}
                  icon={<Ionicons name="cloud-upload" size={18} color="white" />}
                  variant="primary"
                />
              )}
            </View>
            
            {isDesktop && (
              <Pressable 
                onPress={() => setModalVisible(true)}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 mb-6 items-center justify-center bg-white hover:bg-gray-50 transition-colors"
              >
                <View className="w-16 h-16 bg-red-50 rounded-full items-center justify-center mb-4">
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
                </View>
                <Text className="text-lg font-semibold text-gray-900 mb-1">Seret file atau klik untuk mengunggah</Text>
                <Text className="text-sm text-gray-500 text-center">
                  Format yang didukung: PDF, DOCX, PPTX
                </Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState 
              title="Belum ada dokumen" 
              description="Mulai dengan mengunggah dokumen pertama Anda."
              action={isDesktop ? { label: "Unggah Sekarang", onPress: () => setModalVisible(true) } : undefined}
            />
          ) : null
        }
      />
      
      {!isDesktop && (
        <Pressable
          onPress={() => setModalVisible(true)}
          style={[{ bottom: 80, right: 24, zIndex: 999 }, Platform.OS === 'web' ? { position: 'fixed' as 'absolute' } : { position: 'absolute' }]}
          className="w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg active:scale-95"
        >
          <Ionicons name="cloud-upload-outline" size={28} color="white" />
        </Pressable>
      )}
      <UploadModal
        visible={modalVisible}
        onClose={() => { setModalVisible(false); setUploadError(null); setUploadSuccess(false); }}
        onUpload={(formData) => {
          setUploadError(null);
          setUploadSuccess(false);
          uploadDocument(formData, {
            onSuccess: () => setUploadSuccess(true),
            onError: (err) => setUploadError(err.message),
          });
        }}
        isUploading={isUploading}
        uploadError={uploadError}
        uploadSuccess={uploadSuccess}
      />
    </View>
  );
}
