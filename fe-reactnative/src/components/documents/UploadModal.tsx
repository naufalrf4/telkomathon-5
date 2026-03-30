import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Alert, Modal, View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const MAX_UPLOAD_MB = Number(process.env.EXPO_PUBLIC_MAX_UPLOAD_MB ?? '100');
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

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
    return `Ukuran file terlalu besar. Maksimum ${MAX_UPLOAD_MB}MB.`;
  if (msg.includes('422') && msg.includes('File size exceeds'))
    return `Ukuran file terlalu besar. Maksimum ${MAX_UPLOAD_MB}MB.`;
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
  const webInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleWebFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      Alert.alert('Ukuran file terlalu besar', `Maksimum ukuran file adalah ${MAX_UPLOAD_MB}MB.`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const docTypeMap: Record<string, string> = { pdf: 'pdf', docx: 'docx', pptx: 'pptx' };
    const docType = docTypeMap[ext] ?? 'pdf';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);
    onUpload(formData);
  };

  const handleWebInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleWebFiles(event.target.files);
    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleWebFiles(event.dataTransfer.files);
  };

  const handlePickDocument = async () => {
    if (Platform.OS === 'web') {
      webInputRef.current?.click();
      return;
    }

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
      if ((file.size ?? 0) > MAX_UPLOAD_BYTES) {
        Alert.alert('Ukuran file terlalu besar', `Maksimum ukuran file adalah ${MAX_UPLOAD_MB}MB.`);
        return;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const docTypeMap: Record<string, string> = { pdf: 'pdf', docx: 'docx', pptx: 'pptx' };
      const docType = docTypeMap[ext] ?? 'pdf';

      const formData = new FormData();

      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);

      formData.append('doc_type', docType);
      onUpload(formData);
    } catch (err) {
      console.error('Error picking document:', err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center p-4">
        <View className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
          {Platform.OS === 'web' ? (
            <input
              ref={webInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              style={{ display: 'none' }}
              onChange={handleWebInputChange}
            />
          ) : null}
          {isUploading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="mt-4 text-gray-600 font-medium">Mengunggah dokumen...</Text>
              <Text className="mt-2 text-center text-sm text-gray-500">
                Dokumen sedang dikirim dan diproses. Tunggu sampai status dokumen berubah menjadi ready.
              </Text>
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
                 Maksimum ukuran file {MAX_UPLOAD_MB}MB.
                </Text>

              <View className="mb-6 flex-row flex-wrap gap-2">
                {['PDF', 'DOCX', 'PPTX'].map((label) => (
                  <View key={label} className="rounded-full bg-gray-100 px-3 py-1">
                    <Text className="text-xs font-semibold text-gray-600">{label}</Text>
                  </View>
                ))}
                <View className="rounded-full bg-red-50 px-3 py-1">
                  <Text className="text-xs font-semibold text-primary">Maks {MAX_UPLOAD_MB}MB</Text>
                </View>
              </View>

              {Platform.OS === 'web' ? (
                <>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => webInputRef.current?.click()}
                    style={{
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: isDragging ? colors.primary : colors.border,
                      backgroundColor: isDragging ? '#FFF1F2' : '#F9FAFB',
                      borderRadius: 16,
                      padding: 24,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
                      <Text className="text-lg font-bold text-gray-900">Drag & drop file</Text>
                      <Text className="text-center text-gray-500">Klik area ini atau jatuhkan file untuk mulai upload</Text>
                    </div>
                  </div>
                  <View className="gap-3">
                    <Pressable
                      onPress={handlePickDocument}
                      className="bg-primary py-3.5 rounded-xl items-center flex-row justify-center gap-2 shadow-sm"
                    >
                      <Ionicons name="document-text" size={20} color="white" />
                      <Text className="font-semibold text-white text-base">Pilih File Manual</Text>
                    </Pressable>
                    <Pressable
                      onPress={onClose}
                      className="py-3.5 rounded-xl items-center"
                    >
                      <Text className="font-semibold text-gray-500">Batal</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
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
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
