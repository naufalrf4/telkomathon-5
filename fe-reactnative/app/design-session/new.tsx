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
import { SectionTabs } from '../../src/components/ui/SectionTabs';
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
type UploadMode = 'upload' | 'library';

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

function progressValue(status: string) {
  const values: Record<string, number> = {
    uploaded: 20,
    queued: 35,
    processing: 68,
    extracting: 88,
    ready: 100,
    failed: 100,
  };
  return values[status] ?? 0;
}

function progressBarClass(status: string) {
  if (status === 'failed') return 'bg-red-500';
  if (status === 'ready') return 'bg-emerald-500';
  return 'bg-primary-600';
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
    deleteDocumentAsync,
    isDeleting,
  } = useDocuments();
  const { createSession, isCreatingSession } = useDesignSession();
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState<UploadMode>('upload');
  const [uploadedDocIds, setUploadedDocIds] = useState<string[]>([]);

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

  useEffect(() => {
    if (uploadedDocIds.length === 0) {
      return;
    }

    const readyUploadedIds = readyDocuments
      .filter((document) => uploadedDocIds.includes(document.id))
      .map((document) => document.id);

    if (readyUploadedIds.length === 0) {
      return;
    }

    setSelectedDocIds((current) => {
      const next = new Set(current);
      readyUploadedIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }, [readyDocuments, uploadedDocIds]);

  const markUploadedDocument = (document: SourceDocument) => {
    setUploadedDocIds((current) => (current.includes(document.id) ? current : [...current, document.id]));
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
      setUploadMode('upload');
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
      setUploadMode('upload');
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

  const handleDelete = async (documentId: string) => {
    setErrorMessage(null);
    try {
      await deleteDocumentAsync(documentId);
      setSelectedDocIds((current) => current.filter((id) => id !== documentId));
      setUploadedDocIds((current) => current.filter((id) => id !== documentId));
      await refetch();
    } catch (deleteError) {
      setErrorMessage(getErrorMessage(deleteError, 'Dokumen belum bisa dihapus.'));
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl gap-4 p-4 lg:p-8">
        <PageHeader
          eyebrow="Langkah 1"
          title="Unggah dokumen sumber"
        />

        <Card className="overflow-hidden border-neutral-300 bg-surface p-0 shadow-sm">
          <View className="border-b border-neutral-200 px-4 py-4 lg:px-6">
            <SectionTabs
              value={uploadMode}
              onChange={setUploadMode}
              items={[
                { value: 'upload', label: 'Upload baru' },
                { value: 'library', label: 'Dokumen sebelumnya' },
              ]}
            />
          </View>

          <View className="gap-5 p-4 lg:p-6">
            {uploadMode === 'upload' ? (
              <>
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
                        backgroundColor: isDragging ? '#FFF1F3' : '#FFFFFF',
                        borderRadius: 20,
                        padding: 32,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
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
                        <Text className="text-xl font-semibold text-neutral-900">Upload dokumen</Text>
                        <View className="flex-row flex-wrap justify-center gap-2">
                          {['PDF', 'DOCX', 'PPTX'].map((label) => (
                            <View key={label} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                              <Text className="text-xs font-semibold text-neutral-600">{label}</Text>
                            </View>
                          ))}
                          <View className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                            <Text className="text-xs font-semibold text-neutral-600">Max {MAX_UPLOAD_MB}MB</Text>
                          </View>
                        </View>
                      </div>
                    </div>
                  </>
                ) : (
                  <Card className="border border-dashed border-neutral-300 bg-surface shadow-none">
                    <View className="items-center gap-3 py-6">
                      <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-50">
                        <Ionicons name="cloud-upload-outline" size={32} color={colors.primary} />
                      </View>
                      <Text className="text-xl font-semibold text-neutral-900">Upload dokumen</Text>
                      <View className="flex-row flex-wrap justify-center gap-2">
                        {['PDF', 'DOCX', 'PPTX'].map((label) => (
                          <View key={label} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                            <Text className="text-xs font-semibold text-neutral-600">{label}</Text>
                          </View>
                        ))}
                      </View>
                      <Button title="Pilih dokumen" onPress={() => void uploadNativeDocument()} isLoading={isUploading} />
                    </View>
                  </Card>
                )}

                {processingDocuments.length > 0 ? (
                  <Card className="border-neutral-300 bg-surface shadow-sm">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-row items-center gap-2">
                        <Ionicons name="sync-outline" size={18} color={colors.primary} />
                        <Text className="text-sm font-semibold text-neutral-900">Progress dokumen</Text>
                      </View>
                      <Text className="text-xs font-medium text-neutral-500">Bisa ditinggal dulu</Text>
                    </View>

                    <View className="mt-4 gap-3">
                      {processingDocuments.map((document) => {
                        const progress = progressValue(document.status);
                        return (
                          <View key={document.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                            <View className="flex-row items-start justify-between gap-3">
                              <View className="flex-1">
                                <Text className="text-sm font-semibold text-neutral-900">{document.filename}</Text>
                                <Text className="mt-1 text-xs text-neutral-500">{statusLabel(document.status)}</Text>
                              </View>
                              <Text className="text-sm font-semibold text-neutral-700">{progress}%</Text>
                            </View>
                            <View className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
                              <View className={`h-full rounded-full ${progressBarClass(document.status)}`} style={{ width: `${progress}%` }} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </Card>
                ) : null}

                {uploadedDocIds.length > 0 ? (
                  <Card className="border-neutral-300 bg-surface shadow-sm">
                    <View className="gap-3">
                      {availableDocuments
                        .filter((document) => uploadedDocIds.includes(document.id))
                        .map((document) => {
                          const isSelected = selectedDocIds.includes(document.id);
                          return (
                            <View key={document.id} className="flex-row items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                              <View className="flex-1">
                                <Text className="text-sm font-semibold text-neutral-900">{document.filename}</Text>
                                <Text className="mt-1 text-xs text-neutral-500">{statusLabel(document.status)}</Text>
                              </View>
                              {isSelected ? (
                                <View className="rounded-full bg-emerald-50 px-3 py-1">
                                  <Text className="text-xs font-semibold text-emerald-700">Terpilih</Text>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                    </View>
                  </Card>
                ) : null}
              </>
            ) : (
              <>
                {readyDocuments.length === 0 ? (
                  <Card className="border border-neutral-200 bg-surface shadow-none">
                    <View className="items-center gap-3 py-8">
                      <Ionicons name="document-text-outline" size={30} color={colors.textSecondary} />
                      <Text className="text-base font-semibold text-neutral-900">Belum ada dokumen siap</Text>
                    </View>
                  </Card>
                ) : (
                  <Card className="overflow-hidden border-neutral-300 bg-surface p-0 shadow-sm">
                    <View className="hidden lg:flex flex-row border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                      <Text className="flex-[1.4] text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Dokumen</Text>
                      <Text className="flex-1 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Perusahaan</Text>
                      <Text className="w-28 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Tanggal</Text>
                      <Text className="w-32 text-right text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Aksi</Text>
                    </View>

                    <View>
                      {readyDocuments.map((document, index) => {
                        const isSelected = selectedDocIds.includes(document.id);
                        return (
                          <View
                            key={document.id}
                            className={`border-b border-neutral-200 px-4 py-4 last:border-b-0 ${isSelected ? 'bg-primary-50' : 'bg-surface'}`}
                          >
                            <View className="hidden lg:flex flex-row items-center gap-4">
                              <View className="flex-[1.4]">
                                <View className="flex-row flex-wrap items-center gap-2">
                                  <Text className="text-sm font-semibold text-neutral-900">{document.filename}</Text>
                                  <View className={`rounded-full px-2.5 py-1 ${statusChipClass(document.status)}`}>
                                    <Text className="text-[11px] font-semibold">{statusLabel(document.status)}</Text>
                                  </View>
                                </View>
                                <Text className="mt-1 text-sm text-neutral-500">
                                  {(document.doc_type ?? document.file_type).toUpperCase()}
                                </Text>
                              </View>

                              <View className="flex-1">
                                <Text className="text-sm font-medium text-neutral-900">
                                  {document.extracted_company_name ?? '—'}
                                </Text>
                                {document.extracted_company_summary ? (
                                  <Text className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-500">
                                    {document.extracted_company_summary}
                                  </Text>
                                ) : null}
                              </View>

                              <Text className="w-28 text-sm text-neutral-500">
                                {new Date(document.created_at).toLocaleDateString('id-ID')}
                              </Text>

                              <View className="w-32 items-end gap-2">
                                <Button
                                  title={isSelected ? 'Batal pilih' : 'Pilih'}
                                  variant={isSelected ? 'ghost' : 'primary'}
                                  size="sm"
                                  onPress={() => toggleDocument(document.id)}
                                  icon={
                                    <Ionicons
                                      name={isSelected ? 'checkmark-circle-outline' : 'add-circle-outline'}
                                      size={16}
                                      color={isSelected ? colors.textSecondary : 'white'}
                                    />
                                  }
                                />
                                <Button
                                  title="Hapus"
                                  variant="outline"
                                  size="sm"
                                  onPress={() => void handleDelete(document.id)}
                                  isLoading={isDeleting}
                                  icon={<Ionicons name="trash-outline" size={16} color={colors.textSecondary} />}
                                />
                              </View>
                            </View>

                            <View className="gap-4 lg:hidden">
                              <View className="flex-row items-start justify-between gap-3">
                                <View className="flex-1">
                                  <Text className="text-base font-semibold text-neutral-900">{document.filename}</Text>
                                  <Text className="mt-1 text-sm text-neutral-500">
                                    {(document.doc_type ?? document.file_type).toUpperCase()} • {new Date(document.created_at).toLocaleDateString('id-ID')}
                                  </Text>
                                </View>
                                <View className={`rounded-full px-3 py-1 ${statusChipClass(document.status)}`}>
                                  <Text className="text-xs font-semibold">{statusLabel(document.status)}</Text>
                                </View>
                              </View>

                              {document.extracted_company_name ? (
                                <View className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
                                  <Text className="text-sm font-semibold text-neutral-900">{document.extracted_company_name}</Text>
                                  {document.extracted_company_summary ? (
                                    <Text className="mt-1 text-sm leading-6 text-neutral-600">{document.extracted_company_summary}</Text>
                                  ) : null}
                                </View>
                              ) : null}

                              <View className="flex-col gap-2 sm:flex-row">
                                <Button
                                  title={isSelected ? 'Batal pilih' : 'Pilih dokumen'}
                                  variant={isSelected ? 'ghost' : 'primary'}
                                  onPress={() => toggleDocument(document.id)}
                                  icon={
                                    <Ionicons
                                      name={isSelected ? 'checkmark-circle-outline' : 'add-circle-outline'}
                                      size={18}
                                      color={isSelected ? colors.textSecondary : 'white'}
                                    />
                                  }
                                />
                                <Button
                                  title="Hapus"
                                  variant="outline"
                                  onPress={() => void handleDelete(document.id)}
                                  isLoading={isDeleting}
                                  icon={<Ionicons name="trash-outline" size={18} color={colors.textSecondary} />}
                                />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </Card>
                )}

                {failedDocuments.length > 0 ? (
                  <View className="gap-3">
                    {failedDocuments.map((document) => (
                      <Card key={document.id} className="border-red-200 bg-red-50 shadow-none">
                        <View className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-red-900">{document.filename}</Text>
                            {document.last_error ? (
                              <Text className="mt-1 text-sm text-red-700">{document.last_error}</Text>
                            ) : null}
                          </View>
                          <Button
                            title="Coba lagi"
                            variant="outline"
                            onPress={() => void handleRetry(document.id)}
                            isLoading={isRetryingDocument}
                            icon={<Ionicons name="refresh-outline" size={18} color={colors.textSecondary} />}
                          />
                        </View>
                      </Card>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>
        </Card>

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
