import { Modal, View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface UploadModalProps {
  visible: boolean;
  onClose: () => void;
  onUpload: (formData: FormData) => void;
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccess: boolean;
}

function friendlyError(msg: string): string {
  if (msg.includes('503') || msg.includes('Service Unavailable'))
    return 'Server sedang tidak tersedia. Coba beberapa saat lagi.';
  if (msg.includes('413') || msg.includes('too large'))
    return 'Ukuran file terlalu besar. Maksimum 50MB.';
  if (msg.includes('415') || msg.includes('unsupported'))
    return 'Format file tidak didukung. Gunakan PDF, DOCX, atau PPTX.';
  if (msg.includes('network') || msg.includes('fetch'))
    return 'Tidak dapat terhubung ke server. Periksa koneksi internet.';
  return msg || 'Terjadi kesalahan yang tidak diketahui.';
}

export function UploadModal({
  visible,
  onClose,
  onUpload,
  isUploading,
  uploadError,
  uploadSuccess,
}: UploadModalProps) {
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // @ts-expect-error - React Native Web specific handling
        formData.append('file', file.file);
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        } as any);
      }

      onUpload(formData);
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center p-4">
        <View className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
          {isUploading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-4 text-gray-600 font-medium">Mengunggah dokumen...</Text>
            </View>
          ) : uploadSuccess ? (
            <View className="items-center py-4">
              <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="checkmark" size={32} color={colors.success} />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2">Berhasil Diunggah!</Text>
              <Text className="text-gray-500 text-center mb-6">
                Dokumen Anda telah berhasil ditambahkan ke sistem.
              </Text>
              <View className="flex-row gap-3 w-full">
                <Pressable
                  onPress={() => {
                    onClose();
                    // Reset state happens in parent via onClose logic usually, but here handleUpload resets
                  }}
                  className="flex-1 border border-gray-200 py-3 rounded-lg items-center"
                >
                  <Text className="font-semibold text-gray-700">Tutup</Text>
                </Pressable>
                <Pressable
                  onPress={onClose}
                  className="flex-1 bg-primary py-3 rounded-lg items-center"
                >
                  <Text className="font-semibold text-white">Selesai</Text>
                </Pressable>
              </View>
            </View>
          ) : uploadError ? (
            <View className="items-center py-4">
              <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                <Ionicons name="alert" size={32} color={colors.error} />
              </View>
              <Text className="text-xl font-bold text-gray-900 mb-2">Gagal Mengunggah</Text>
              <Text className="text-gray-500 text-center mb-6 px-4">
                {friendlyError(uploadError)}
              </Text>
              <View className="flex-row gap-3 w-full">
                <Pressable
                  onPress={onClose}
                  className="flex-1 border border-gray-200 py-3 rounded-lg items-center"
                >
                  <Text className="font-semibold text-gray-700">Batal</Text>
                </Pressable>
                <Pressable
                  onPress={handlePickDocument}
                  className="flex-1 bg-primary py-3 rounded-lg items-center"
                >
                  <Text className="font-semibold text-white">Coba Lagi</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-gray-900">Unggah Dokumen</Text>
                <Pressable onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
              
              <Text className="text-gray-500 mb-8 leading-relaxed">
                Pilih file materi pembelajaran Anda (PDF, DOCX, atau PPTX) untuk dianalisis oleh AI.
                Maksimum ukuran file 50MB.
              </Text>

              <View className="gap-3">
                <Pressable
                  onPress={handlePickDocument}
                  className="bg-primary py-3.5 rounded-xl items-center flex-row justify-center gap-2 shadow-sm"
                >
                  <Ionicons name="document-text" size={20} color="white" />
                  <Text className="font-semibold text-white text-base">Pilih File</Text>
                </Pressable>
                
                <Pressable
                  onPress={onClose}
                  className="py-3.5 rounded-xl items-center"
                >
                  <Text className="font-semibold text-gray-500">Batal</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
