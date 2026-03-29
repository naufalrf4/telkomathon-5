import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useDesignSession } from '../../src/hooks/useDesignSession';
import { getErrorMessage } from '../../src/services/api';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { colors } from '../../src/theme/colors';
import type { Document as SourceDocument } from '../../src/types/api';

const ACCEPTED_FILE_TYPES =
  '.pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MAX_UPLOAD_MB = Number(process.env.EXPO_PUBLIC_MAX_UPLOAD_MB ?? '100');
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

function docTypeFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const docTypeMap: Record<string, string> = {
    pdf: 'pdf',
    docx: 'docx',
    pptx: 'pptx',
  };
  return docTypeMap[extension] ?? 'pdf';
}

export default function NewDesignSessionScreen() {
  const router = useRouter();
  const webInputRef = useRef<HTMLInputElement | null>(null);
  const {
    documents,
    isLoading,
    error,
    refetch,
    uploadDocumentAsync,
    isUploading,
  } = useDocuments();
  const { createSession, isCreatingSession } = useDesignSession();
  const [createdDocIds, setCreatedDocIds] = useState<string[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const flowDocuments = useMemo(
    () => (documents ?? []).filter((document) => createdDocIds.includes(document.id)),
    [createdDocIds, documents]
  );

  const readyDocuments = flowDocuments.filter((document) => document.status === 'ready');
  const processingDocuments = flowDocuments.filter((document) => document.status !== 'ready');
  const canStartSession =
    selectedDocIds.length > 0 &&
    selectedDocIds.every((documentId) =>
      flowDocuments.some((document) => document.id === documentId && document.status === 'ready')
    );

  const markUploadedDocument = (document: SourceDocument) => {
    setCreatedDocIds((current) => (current.includes(document.id) ? current : [...current, document.id]));
    if (document.status === 'ready') {
      setSelectedDocIds((current) => (current.includes(document.id) ? current : [...current, document.id]));
    }
  };

  const uploadNativeDocument = async () => {
    setUploadError(null);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if ((file.size ?? 0) > MAX_UPLOAD_BYTES) {
        setUploadError(`Ukuran file terlalu besar. Maksimum ${MAX_UPLOAD_MB}MB.`);
        return;
      }
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? 'application/octet-stream',
      } as unknown as Blob);
      formData.append('doc_type', docTypeFromFilename(file.name));

      const uploaded = await uploadDocumentAsync(formData);
      markUploadedDocument(uploaded);
      await refetch();
    } catch (uploadErr) {
      setUploadError(getErrorMessage(uploadErr, 'Gagal mengunggah dokumen ke create flow.'));
    }
  };

  const uploadWebFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setUploadError(null);
    setErrorMessage(null);

    try {
      const oversized = files.find((file) => file.size > MAX_UPLOAD_BYTES);
      if (oversized) {
        setUploadError(`Ukuran file terlalu besar. Maksimum ${MAX_UPLOAD_MB}MB.`);
        return;
      }
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('doc_type', docTypeFromFilename(file.name));
        const uploaded = await uploadDocumentAsync(formData);
        markUploadedDocument(uploaded);
      }
      await refetch();
    } catch (uploadErr) {
      setUploadError(getErrorMessage(uploadErr, 'Gagal mengunggah dokumen ke create flow.'));
    }
  };

  const handleWebInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    await uploadWebFiles(files);
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

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []).filter((file) => file.name.includes('.'));
    await uploadWebFiles(files);
  };

  const toggleDocument = (documentId: string) => {
    setSelectedDocIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId]
    );
  };

  const handleStartSession = async () => {
    setErrorMessage(null);

    try {
      const session = await createSession(selectedDocIds);
      router.replace(`/syllabus/create/${session.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Gagal membuat create flow syllabus.'));
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="max-w-4xl mx-auto w-full p-4 lg:p-8 gap-5">
        <View className="flex-row flex-wrap justify-between gap-3 items-center">
          <Text className="text-3xl font-bold text-gray-900">Create Syllabus</Text>
          <Button title="Lihat Draft" variant="outline" onPress={() => router.push('/design-session')} />
        </View>

        {Platform.OS === 'web' ? (
          <>
            <input
              ref={webInputRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              multiple
              style={{ display: 'none' }}
              onChange={(event) => {
                void handleWebInputChange(event);
              }}
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(event) => {
                void handleDrop(event);
              }}
              onClick={() => webInputRef.current?.click()}
              style={{
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: isDragging ? colors.primary : colors.border,
                backgroundColor: isDragging ? '#FFF1F2' : colors.surface,
                borderRadius: 20,
                padding: 28,
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FEE2E2',
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={34} color={colors.primary} />
                </div>
                <Text className="text-xl font-bold text-gray-900">Drag & drop file</Text>
                <Text className="text-center text-gray-500">PDF, DOCX, atau PPTX • maks {MAX_UPLOAD_MB}MB</Text>
              </div>
            </div>
          </>
        ) : (
          <Card className="border border-dashed border-gray-300 bg-white">
            <View className="items-center gap-3 py-6">
               <View className="h-16 w-16 items-center justify-center rounded-full bg-red-50">
                 <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
               </View>
               <Text className="text-xl font-bold text-gray-900">Unggah file</Text>
               <Text className="text-center text-gray-500">PDF, DOCX, atau PPTX • maks {MAX_UPLOAD_MB}MB</Text>
               <Button title="Pilih Dokumen" onPress={() => void uploadNativeDocument()} isLoading={isUploading} />
             </View>
           </Card>
         )}

        {isLoading && !documents ? (
          <Card>
            <LoadingSpinner message="Memuat dokumen create flow..." />
          </Card>
        ) : null}

        {error ? (
          <Card className="border border-red-200 bg-red-50">
            <Text className="text-red-700 font-medium">
              {error instanceof Error ? error.message : 'Daftar dokumen belum dapat dimuat.'}
            </Text>
            <View className="mt-3 flex-row justify-end">
              <Button title="Muat Ulang" variant="outline" onPress={() => void refetch()} />
            </View>
          </Card>
        ) : null}

        {uploadError ? (
          <Card className="border border-red-200 bg-red-50">
            <Text className="text-red-700 font-medium">{uploadError}</Text>
          </Card>
        ) : null}

        {errorMessage ? (
          <Card className="border border-red-200 bg-red-50">
            <Text className="text-red-700 font-medium">{errorMessage}</Text>
          </Card>
        ) : null}

        {flowDocuments.length === 0 ? (
          <Card className="border border-gray-200 bg-white">
            <View className="items-center gap-3 py-6">
              <Ionicons name="document-text-outline" size={32} color={colors.textSecondary} />
              <Text className="text-lg font-bold text-gray-900">Belum ada file</Text>
            </View>
          </Card>
        ) : (
          <View className="gap-4">
            <View className="flex-row flex-wrap gap-2">
              <View className="rounded-full bg-red-50 px-3 py-1">
                <Text className="text-xs font-semibold text-primary">{flowDocuments.length} file</Text>
              </View>
              <View className="rounded-full bg-emerald-50 px-3 py-1">
                <Text className="text-xs font-semibold text-emerald-700">{readyDocuments.length} ready</Text>
              </View>
              <View className="rounded-full bg-amber-50 px-3 py-1">
                <Text className="text-xs font-semibold text-amber-700">{processingDocuments.length} processing</Text>
              </View>
            </View>
            {flowDocuments.map((document) => {
            const isSelected = selectedDocIds.includes(document.id);
            const isReady = document.status === 'ready';

            return (
              <Pressable key={document.id} onPress={() => isReady && toggleDocument(document.id)} disabled={!isReady}>
                <Card className={`${isSelected ? 'border-primary bg-red-50' : ''} ${!isReady ? 'opacity-60' : ''}`}>
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1 gap-1">
                        <Text className="text-lg font-bold text-gray-900">{document.filename}</Text>
                      <Text className="text-gray-500">
                          {(document.doc_type ?? document.file_type).toUpperCase()} • {document.status}
                        </Text>
                      {!isReady ? (
                        <Text className="text-sm text-amber-600">Masih diproses</Text>
                      ) : null}
                    </View>
                    <View className={`w-7 h-7 rounded-full items-center justify-center ${isSelected ? 'bg-primary' : 'bg-gray-100'}`}>
                      <Ionicons name={isSelected ? 'checkmark' : isReady ? 'add' : 'time-outline'} size={18} color={isSelected ? '#FFFFFF' : colors.textSecondary} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
            })}
          </View>
        )}

        <View className="flex-row justify-end">
          <Button
            title="Lanjut"
            onPress={handleStartSession}
            disabled={!canStartSession}
            isLoading={isCreatingSession || isUploading}
            icon={<Ionicons name="sparkles-outline" size={18} color="white" />}
            className="shadow-sm"
          />
        </View>
      </View>
    </ScrollView>
  );
}
