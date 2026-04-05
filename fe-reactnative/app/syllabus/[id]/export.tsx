import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertBanner } from '../../../src/components/ui/AlertBanner';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { LoadingSpinner } from '../../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { useSyllabus } from '../../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../../src/services/api';
import { colors } from '../../../src/theme/colors';
import { syllabusTitle } from '../../../src/utils/syllabus';

function triggerBrowserDownload(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(blobUrl);
}

export default function SyllabusExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    syllabus,
    isLoading,
    error,
    refetch,
    downloadSyllabusPdfAsync,
    isDownloadingSyllabusPdf,
  } = useSyllabus(id as string);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState(false);

  useEffect(() => {
    if (!id || Platform.OS !== 'web') {
      return undefined;
    }

    let active = true;
    setIsPreparingPreview(true);
    setExportError(null);

    void downloadSyllabusPdfAsync()
      .then((blob) => {
        if (!active || typeof window === 'undefined') {
          return;
        }
        const nextUrl = window.URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPreviewUrl(nextUrl);
      })
      .catch((previewError) => {
        if (!active) {
          return;
        }
        setExportError(getErrorMessage(previewError, 'Pratinjau PDF belum berhasil dibuat.'));
      })
      .finally(() => {
        if (active) {
          setIsPreparingPreview(false);
        }
      });

    return () => {
      active = false;
      if (previewUrl && typeof window !== 'undefined') {
        window.URL.revokeObjectURL(previewUrl);
      }
    };
  }, [downloadSyllabusPdfAsync, id]);

  const previewReady = useMemo(() => Platform.OS === 'web' && !!previewUrl, [previewUrl]);

  const handleExport = async () => {
    setExportError(null);
    setExportSuccess(null);

    try {
      const blob = pdfBlob ?? (await downloadSyllabusPdfAsync());
      setPdfBlob(blob);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        triggerBrowserDownload(blob, `syllabus-${id}.pdf`);
      }
      setExportSuccess('File PDF berhasil disiapkan untuk diunduh.');
    } catch (downloadError) {
      setExportError(getErrorMessage(downloadError, 'Ekspor PDF belum berhasil dibuat.'));
    }
  };

  if (isLoading && !syllabus) {
    return <LoadingSpinner fullScreen message="Memuat panel ekspor..." />;
  }

  if (error && !syllabus) {
    return (
      <ScrollView className="flex-1 bg-neutral-50">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <AlertBanner
            variant="error"
            title="Panel ekspor belum dapat dimuat"
            description={getErrorMessage(error, 'Buka ulang kurikulum yang ingin diekspor.')}
            action={{ label: 'Muat ulang', onPress: () => void refetch() }}
          />
        </View>
      </ScrollView>
    );
  }

  if (!syllabus) {
    return <LoadingSpinner fullScreen message="Menyiapkan ekspor..." />;
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl gap-6 p-4 lg:p-8">
        <PageHeader
          eyebrow="Ekspor"
          title="Pratinjau PDF kurikulum final"
          description="Struktur ekspor dipertahankan dari dokumen sumber, tetapi tampilan pengguna sekarang fokus pada pratinjau PDF yang siap dibagikan dan diunduh."
          actions={
            <>
              <Button
                title="Kembali"
                variant="ghost"
                onPress={() => router.push(`/syllabus/${id}`)}
                icon={<Ionicons name="arrow-back" size={18} color={colors.textSecondary} />}
              />
              <Button
                title="Unduh PDF"
                onPress={() => void handleExport()}
                isLoading={isDownloadingSyllabusPdf}
                icon={<Ionicons name="download-outline" size={18} color="white" />}
              />
            </>
          }
        />

        {exportError ? <AlertBanner variant="error" title="Ekspor belum berhasil" description={exportError} /> : null}
        {exportSuccess ? <AlertBanner variant="success" title="Ekspor siap diunduh" description={exportSuccess} /> : null}

        <View className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <Card className="border-neutral-300 bg-surface shadow-sm">
            <View className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-600">File yang akan diunduh</Text>
              <Text className="text-base font-semibold text-neutral-950">{syllabusTitle(syllabus)}</Text>
              <Text className="text-sm leading-6 text-neutral-600">
                PDF memuat konteks perusahaan, tujuan akhir, target performa, modul belajar, alur belajar, dan ringkasan revisi terakhir.
              </Text>
              <View className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Konteks perusahaan</Text>
                <Text className="mt-2 text-sm font-semibold text-neutral-900">
                  {syllabus.client_company_name || 'Belum diisi'}
                </Text>
                <Text className="mt-1 text-sm leading-6 text-neutral-600">
                  {syllabus.company_profile_summary || syllabus.commercial_overview || 'Belum tersedia'}
                </Text>
              </View>
            </View>
          </Card>

          <Card className="border-neutral-300 bg-surface shadow-sm">
            <View className="gap-4">
              <View>
                <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-600">Pratinjau</Text>
                <Text className="mt-1 text-sm leading-6 text-neutral-600">
                  Gunakan pratinjau ini untuk memastikan struktur export sudah siap sebelum file PDF diunduh.
                </Text>
              </View>
              {Platform.OS !== 'web' ? (
                <AlertBanner
                  variant="info"
                  title="Pratinjau embedded tersedia di web"
                  description="Pada platform non-web, file tetap dapat diunduh sebagai PDF dari tombol di bagian atas."
                />
              ) : isPreparingPreview ? (
                <LoadingSpinner message="Menyiapkan pratinjau PDF..." />
              ) : previewReady ? (
                <View style={{ height: 720, overflow: 'hidden', borderRadius: 16 }}>
                  <iframe
                    src={previewUrl ?? undefined}
                    title="PDF preview"
                    style={{ width: '100%', height: '100%', border: '1px solid #E2E8F0', borderRadius: 16, background: '#fff' }}
                  />
                </View>
              ) : (
                <AlertBanner
                  variant="warning"
                  title="Pratinjau belum tersedia"
                  description="Muat ulang halaman ini atau gunakan tombol unduh PDF untuk tetap mendapatkan hasil export."
                />
              )}
            </View>
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}
