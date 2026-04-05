import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertBanner } from '../../src/components/ui/AlertBanner';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { useDesignSession } from '../../src/hooks/useDesignSession';
import { useDocuments } from '../../src/hooks/useDocuments';
import { getErrorMessage } from '../../src/services/api';
import { colors } from '../../src/theme/colors';
import type { Document as SourceDocument } from '../../src/types/api';

const ACCEPTED_FILE_TYPES =
  '.pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation';
const MAX_UPLOAD_MB = Number(process.env.EXPO_PUBLIC_MAX_UPLOAD_MB ?? '100');
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const NON_TERMINAL_STATUSES = new Set(['uploaded', 'queued', 'processing', 'extracting']);

function docTypeFromFilename(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';
  const docTypeMap: Record<string, string> = {
    pdf: 'pdf',
    docx: 'docx',
    pptx: 'pptx',
  };
  return docTypeMap[extension] ?? 'pdf';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    uploaded: 'Baru diunggah',
    queued: 'Masuk antrean',
    processing: 'Sedang diparsing',
    extracting: 'Menyusun ringkasan perusahaan',
    ready: 'Siap dipakai',
    failed: 'Gagal diproses',
  };
  return labels[status] ?? status;
}

function statusChipClass(status: string) {
  if (status === 'ready') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (status === 'failed') {
    return 'bg-red-50 text-red-700';
  }
  return 'bg-amber-50 text-amber-700';
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
    retryDocumentAsync,
    isRetryingDocument,
  } = useDocuments();
  const { createSession, isCreatingSession } = useDesignSession();
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const availableDocuments = useMemo(() => documents ?? [], [documents]);
  const readyDocuments = availableDocuments.filter((document) => document.status === 'ready');
  const processingDocuments = availableDocuments.filter((document) => NON_TERMINAL_STATUSES.has(document.status));
  const failedDocuments = availableDocuments.filter((document) => document.status === 'failed');
  const canStartSession =
    selectedDocIds.length > 0 &&
    selectedDocIds.every((documentId) => readyDocuments.some((document) => document.id === documentId));

  useEffect(() => {
    if (processingDocuments.length === 0) {
      return undefined;
    }
    const interval = setInterval(() => {
      void refetch();
    }, 3000);
    return () => clearInterval(interval);
  }, [processingDocuments.length, refetch]);

  const markUploadedDocument = (document: SourceDocument) => {
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
      formData.append(
        'file',
        {
          uri: file.uri,
          name: file.name,
          type: file.mimeType ?? 'application/octet-stream',
        } as unknown as Blob
      );
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
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Gagal membuat create flow syllabus.'));
    }
  };

  const handleRetry = async (documentId: string) => {
    setErrorMessage(null);
    try {
      await retryDocumentAsync(documentId);
      await refetch();
    } catch (retryError) {
      setErrorMessage(getErrorMessage(retryError, 'Dokumen belum bisa diproses ulang.'));
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl gap-6 p-4 lg:p-8">
        <PageHeader
          eyebrow="Langkah 1"
          title="Unggah materi dan lanjutkan saat dokumen sudah siap"
          description="Upload sekarang, tinggalkan halaman bila perlu, lalu kembali saat status dokumen berubah menjadi siap. Sistem akan menyelesaikan parsing, OCR, dan ringkasan perusahaan di background."
          actions={<Button title="Lihat kurikulum" variant="outline" onPress={() => router.push('/syllabus/generated')} />}
        />

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
                borderColor: isDragging ? '#F47B81' : '#CBD5E1',
                backgroundColor: isDragging ? '#FFF1F3' : '#F8FAFC',
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
                    backgroundColor: '#FDE8E9',
                  }}
                >
                  <Ionicons name="cloud-upload-outline" size={34} color={colors.primary} />
                </div>
                <Text className="text-xl font-semibold text-neutral-900">Tarik file ke sini</Text>
                <Text className="text-center text-neutral-500">
                  Gunakan PDF, DOCX, atau PPTX hingga {MAX_UPLOAD_MB}MB per file.
                </Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {['PDF', 'DOCX', 'PPTX'].map((label) => (
                    <View key={label} className="rounded-full bg-neutral-100 px-3 py-1">
                      <Text className="text-xs font-semibold text-neutral-600">{label}</Text>
                    </View>
                  ))}
                </View>
              </div>
            </div>
          </>
        ) : (
          <Card className="border border-dashed border-neutral-300 bg-surface">
            <View className="items-center gap-3 py-6">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50">
                <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
              </View>
              <Text className="text-xl font-semibold text-neutral-900">Unggah file</Text>
              <Text className="text-center text-neutral-500">
                Gunakan PDF, DOCX, atau PPTX hingga {MAX_UPLOAD_MB}MB per file.
              </Text>
              <Button title="Pilih Dokumen" onPress={() => void uploadNativeDocument()} isLoading={isUploading} />
            </View>
          </Card>
        )}

        <View className="grid gap-4 lg:grid-cols-3">
          <Card>
            <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Dokumen</Text>
            <Text className="mt-2 text-2xl font-semibold text-neutral-950">{availableDocuments.length}</Text>
            <Text className="mt-1 text-sm text-neutral-600">Semua dokumen yang tersimpan di flow ini siap dipilih ulang kapan saja.</Text>
          </Card>
          <Card>
            <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Sedang diproses</Text>
            <Text className="mt-2 text-2xl font-semibold text-neutral-950">{processingDocuments.length}</Text>
            <Text className="mt-1 text-sm text-neutral-600">Status akan diperbarui otomatis selama Anda tetap di halaman.</Text>
          </Card>
          <Card>
            <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Siap disusun</Text>
            <Text className="mt-2 text-2xl font-semibold text-neutral-950">{readyDocuments.length}</Text>
            <Text className="mt-1 text-sm text-neutral-600">Pilih minimal satu dokumen siap lalu lanjutkan ke wizard.</Text>
          </Card>
        </View>

        {processingDocuments.length > 0 ? (
          <AlertBanner
            variant="info"
            title="Upload sudah aman ditinggalkan"
            description="Anda bisa menutup halaman sekarang. Saat kembali, daftar dokumen akan menampilkan status terbaru dan dokumen siap bisa langsung dipilih."
          />
        ) : null}

        {failedDocuments.length > 0 ? (
          <AlertBanner
            variant="warning"
            title="Sebagian dokumen perlu diproses ulang"
            description="Gunakan tombol coba lagi pada dokumen yang gagal untuk menjalankan parsing dan ekstraksi ulang."
          />
        ) : null}

        {isLoading && !documents ? (
          <Card>
            <LoadingSpinner message="Memuat dokumen create flow..." />
          </Card>
        ) : null}

        {error ? (
          <AlertBanner
            variant="error"
            title="Daftar dokumen belum dapat dimuat"
            description={error instanceof Error ? error.message : 'Daftar dokumen belum dapat dimuat.'}
            action={{ label: 'Muat ulang', onPress: () => void refetch() }}
          />
        ) : null}

        {uploadError ? <AlertBanner variant="error" title="Upload belum berhasil" description={uploadError} /> : null}
        {errorMessage ? <AlertBanner variant="error" title="Belum bisa lanjut" description={errorMessage} /> : null}

        {availableDocuments.length === 0 ? (
          <Card className="border border-neutral-200 bg-surface">
            <View className="items-center gap-3 py-6">
              <Ionicons name="document-text-outline" size={32} color={colors.textSecondary} />
              <Text className="text-lg font-semibold text-neutral-900">Belum ada materi</Text>
              <Text className="text-center text-sm text-neutral-500">
                Unggah minimal satu dokumen untuk memulai penyusunan kurikulum.
              </Text>
            </View>
          </Card>
        ) : (
          <View className="gap-4">
            {availableDocuments.map((document) => {
              const isSelected = selectedDocIds.includes(document.id);
              const isReady = document.status === 'ready';
              const isFailed = document.status === 'failed';

              return (
                <Card key={document.id} className={isSelected ? 'border-primary bg-primary-50' : ''}>
                  <View className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <View className="flex-1 gap-3">
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Text className="text-lg font-semibold text-neutral-900">{document.filename}</Text>
                        <View className={`rounded-full px-3 py-1 ${statusChipClass(document.status)}`}>
                          <Text className="text-xs font-semibold">{statusLabel(document.status)}</Text>
                        </View>
                      </View>
                      <Text className="text-sm text-neutral-500">
                        {(document.doc_type ?? document.file_type).toUpperCase()} • diunggah {new Date(document.created_at).toLocaleString('id-ID')}
                      </Text>
                      {document.extracted_company_name ? (
                        <View className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
                          <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Deteksi perusahaan</Text>
                          <Text className="mt-1 text-sm font-semibold text-neutral-900">{document.extracted_company_name}</Text>
                          {document.extracted_company_summary ? (
                            <Text className="mt-1 text-sm leading-6 text-neutral-600">{document.extracted_company_summary}</Text>
                          ) : null}
                        </View>
                      ) : null}
                      {document.last_error ? (
                        <Text className="text-sm text-red-600">{document.last_error}</Text>
                      ) : null}
                    </View>

                    <View className="w-full gap-2 lg:w-[220px]">
                      <Button
                        title={isSelected ? 'Batal pilih' : 'Pilih dokumen'}
                        variant={isSelected ? 'ghost' : 'primary'}
                        onPress={() => toggleDocument(document.id)}
                        disabled={!isReady}
                        icon={
                          <Ionicons
                            name={isSelected ? 'checkmark-circle-outline' : 'add-circle-outline'}
                            size={18}
                            color={isSelected ? colors.textSecondary : 'white'}
                          />
                        }
                      />
                      {isFailed ? (
                        <Button
                          title="Coba lagi"
                          variant="outline"
                          onPress={() => void handleRetry(document.id)}
                          isLoading={isRetryingDocument}
                          icon={<Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />}
                        />
                      ) : null}
                      {!isReady && !isFailed ? (
                        <Text className="text-sm leading-6 text-amber-700">
                          Dokumen ini masih diproses. Anda bisa meninggalkan halaman dan kembali lagi nanti.
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        <View className="flex-row justify-end">
          <Button
            title="Lanjut ke penyusunan"
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
