import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { apiGetBlob, getErrorMessage } from '../../src/services/api';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { colors } from '../../src/theme/colors';
import { emptyLearningJourney, syllabusTitle } from '../../src/utils/syllabus';
import type { LearningJourneyStage } from '../../src/types/api';

function previewText(value: string | null | undefined, fallback = 'Belum diisi'): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

export default function ExportScreen() {
  const { syllabusId: syllabusIdParam, id } = useLocalSearchParams<{ syllabusId?: string; id?: string }>();
  const syllabusId = syllabusIdParam ?? id ?? '';
  const router = useRouter();
  const { syllabus, isLoading, error, refetch } = useSyllabus(syllabusId);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadError(null);
      const blob = await apiGetBlob(`/syllabi/${syllabusId}/download.docx`);

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = objectUrl;
        link.download = `${syllabusTitle(syllabus ?? { topic: 'syllabus' } as never)}.docx`;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);
        return;
      }

      setDownloadError('Unduhan langsung mobile belum diaktifkan untuk mode auth. Gunakan web terlebih dahulu.');
    } catch (downloadActionError) {
      setDownloadError(getErrorMessage(downloadActionError, 'Gagal mengunduh DOCX.'));
    } finally {
      setIsDownloading(false);
    }
  };

  const journey = syllabus?.journey ?? emptyLearningJourney();
  const templateFields = syllabus
    ? [
        ['course_category', previewText(syllabus.course_category)],
        ['course_expertise_level', previewText(syllabus.course_expertise_level)],
        ['client_company_name', previewText(syllabus.client_company_name)],
        ['course_title', previewText(syllabus.course_title, syllabus.topic)],
        ['company_profile_summary', previewText(syllabus.company_profile_summary)],
        ['commercial_overview', previewText(syllabus.commercial_overview)],
        ['performance_result', previewText(syllabus.performance_result)],
        ['condition_result', previewText(syllabus.condition_result)],
        ['standard_result', previewText(syllabus.standard_result)],
      ]
    : [];

  if (isLoading && !syllabus) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <LoadingSpinner />
        <Text className="mt-4 font-medium text-gray-500">Menyiapkan ekspor...</Text>
      </View>
    );
  }

  if (error && !syllabus) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md gap-4 border border-red-200 bg-red-50 p-8">
          <Text className="text-xl font-bold text-red-700">Gagal menyiapkan ekspor</Text>
          <Text className="text-red-700">{getErrorMessage(error, 'Halaman ekspor belum dapat dimuat.')}</Text>
          <View className="flex-row flex-wrap gap-3">
            <Button title="Coba Lagi" onPress={() => void refetch()} />
            <Button title="Kembali ke Silabus" variant="outline" onPress={() => router.push(`/syllabus/${syllabusId}`)} />
          </View>
        </Card>
      </View>
    );
  }

  if (!syllabus) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md gap-4 border border-amber-200 bg-amber-50 p-8">
          <Text className="text-xl font-bold text-amber-700">Silabus tidak ditemukan</Text>
          <Text className="text-amber-700">Buka detail silabus lain lalu coba ekspor kembali.</Text>
          <Button title="Kembali ke Daftar" onPress={() => router.push('/syllabus/generated')} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl gap-6 p-6 lg:p-8">
        <View className="items-center">
          <Text className="mb-2 text-2xl font-bold text-gray-900">Ekspor Silabus</Text>
          <Text className="text-center text-gray-500">Review isi DOCX sebelum mengunduh. Preview ini memakai field yang sama dengan renderer template backend.</Text>
        </View>

        <View className="gap-6 lg:flex-row">
          <Card className="lg:w-[360px] lg:self-start">
            <View className="items-center">
              <View className="mb-6 h-24 w-24 items-center justify-center rounded-full border border-red-100 bg-red-50 shadow-sm">
                <Ionicons name="document-text" size={48} color={colors.primary} />
              </View>
              <Text className="mb-2 px-4 text-center text-xl font-bold leading-tight text-gray-900">{syllabusTitle(syllabus)}</Text>
              <View className="mb-6 w-full rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <Text className="text-sm font-semibold text-gray-800">Snapshot Export</Text>
                <Text className="mt-1 text-sm text-gray-500">Kategori: {previewText(syllabus.course_category)}</Text>
                <Text className="text-sm text-gray-500">Expertise: {previewText(syllabus.course_expertise_level)}</Text>
                <Text className="text-sm text-gray-500">Klien: {previewText(syllabus.client_company_name)}</Text>
                <Text className="text-sm text-gray-500">Riwayat revisi: {syllabus.revision_history.length}</Text>
              </View>
              <View className="mb-8 flex-row items-center justify-center space-x-4">
                <View className="rounded-md bg-gray-100 px-3 py-1">
                  <Text className="text-xs font-medium text-gray-600">Format DOCX</Text>
                </View>
                <View className="h-1 w-1 rounded-full bg-gray-300" />
                <Text className="text-xs text-gray-400">{new Date().toLocaleDateString()}</Text>
              </View>
              <View className="w-full gap-3">
                <Button title="Unduh DOCX" onPress={() => void handleDownload()} isLoading={isDownloading} size="lg" className="w-full rounded-xl bg-primary py-4 shadow-md" icon={<Ionicons name="download-outline" size={20} color="white" />} />
                <Button title="Kembali ke Silabus" variant="ghost" onPress={() => router.push(`/syllabus/${syllabusId}`)} className="w-full py-3" textClassName="font-medium text-gray-500" />
              </View>
              {downloadError ? (
                <View className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <Text className="text-sm text-red-700">{downloadError}</Text>
                </View>
              ) : null}
            </View>
          </Card>

          <View className="flex-1 gap-6">
            <Card>
              <Text className="text-sm font-semibold uppercase tracking-wide text-primary">Template mapping</Text>
              <Text className="mt-2 text-sm text-gray-500">Panel ini memperlihatkan field yang dipetakan ke template runtime DOCX saat export dijalankan.</Text>
              <View className="mt-4 gap-3">
                {templateFields.map(([key, value]) => (
                  <View key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">{key}</Text>
                    <Text className="mt-1 text-sm text-gray-900">{value}</Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card className="overflow-hidden border-gray-300 p-0">
              <View className="border-b border-gray-200 bg-gray-900 px-6 py-5">
                <Text className="text-sm font-semibold uppercase tracking-[2px] text-white">DOCX Preview</Text>
                <Text className="mt-3 text-3xl font-bold text-white">{previewText(syllabus.course_title, syllabus.topic)}</Text>
                <Text className="mt-2 text-sm text-gray-200">{previewText(syllabus.client_company_name)} • {previewText(syllabus.course_category)} • {previewText(syllabus.course_expertise_level)}</Text>
              </View>

              <View className="gap-6 p-6 lg:p-8">
                <View className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tanggal export</Text>
                  <Text className="mt-1 text-sm text-gray-900">{new Date().toLocaleDateString('id-ID')}</Text>
                </View>

                <View className="gap-3">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-primary">1. Profil perusahaan</Text>
                  <Card className="border-gray-100 bg-gray-50">
                    <Text className="text-sm font-semibold text-gray-900">Profile perusahaan</Text>
                    <Text className="mt-2 text-sm leading-6 text-gray-700">{previewText(syllabus.company_profile_summary)}</Text>
                  </Card>
                  <Card className="border-gray-100 bg-gray-50">
                    <Text className="text-sm font-semibold text-gray-900">Rangkuman komersial</Text>
                    <Text className="mt-2 text-sm leading-6 text-gray-700">{previewText(syllabus.commercial_overview)}</Text>
                  </Card>
                </View>

                <View className="gap-3">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-primary">2. Course blueprint</Text>
                  <Card className="border-gray-100 bg-gray-50">
                    <Text className="text-sm font-semibold text-gray-900">Course name</Text>
                    <Text className="mt-2 text-sm leading-6 text-gray-700">{previewText(syllabus.topic)}</Text>
                  </Card>
                  <Card className="border-gray-100 bg-gray-50">
                    <Text className="text-sm font-semibold text-gray-900">Terminal learning objective</Text>
                    <Text className="mt-2 text-sm leading-6 text-gray-700">{previewText(syllabus.tlo)}</Text>
                  </Card>
                  <View className="grid gap-3 lg:flex lg:flex-row">
                    <Card className="border-gray-100 bg-gray-50 lg:flex-1">
                      <Text className="text-sm font-semibold text-gray-900">Performance</Text>
                      <Text className="mt-2 text-sm leading-6 text-gray-700">{previewText(syllabus.performance_result)}</Text>
                    </Card>
                    <Card className="border-gray-100 bg-gray-50 lg:flex-1">
                      <Text className="text-sm font-semibold text-gray-900">Condition</Text>
                      <Text className="mt-2 text-sm leading-6 text-gray-700">{previewText(syllabus.condition_result)}</Text>
                    </Card>
                    <Card className="border-gray-100 bg-gray-50 lg:flex-1">
                      <Text className="text-sm font-semibold text-gray-900">Standard</Text>
                      <Text className="mt-2 text-sm leading-6 text-gray-700">{previewText(syllabus.standard_result)}</Text>
                    </Card>
                  </View>
                  <Card className="border-gray-100 bg-gray-50">
                    <Text className="text-sm font-semibold text-gray-900">Enabling learning outcomes</Text>
                    <View className="mt-3 gap-3">
                      {syllabus.elos.map((elo, index) => (
                        <View key={`${elo.elo}-${index}`} className="rounded-xl border border-gray-200 bg-white p-4">
                          <Text className="text-sm font-semibold text-gray-900">{index + 1}. {elo.elo}</Text>
                        </View>
                      ))}
                    </View>
                  </Card>
                </View>

                <View className="gap-3">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-primary">3. Learning journey</Text>
                  <View className="grid gap-3 lg:flex lg:flex-row">
                    <JourneyPreviewCard title="Pre-learning" stage={journey.pre_learning} />
                    <JourneyPreviewCard title="Classroom" stage={journey.classroom} />
                    <JourneyPreviewCard title="After-learning" stage={journey.after_learning} />
                  </View>
                </View>
              </View>
            </Card>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function JourneyPreviewCard({ title, stage }: { title: string; stage: LearningJourneyStage }) {
  return (
    <Card className="border-gray-100 bg-gray-50 lg:flex-1">
      <Text className="text-sm font-semibold text-gray-900">{title}</Text>
      <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Duration</Text>
      <Text className="mt-1 text-sm text-gray-700">{previewText(stage.duration)}</Text>
      <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Method</Text>
      <View className="mt-2 gap-1">
        {stage.method.length > 0 ? stage.method.map((item, index) => <Text key={`${title}-method-${index}`} className="text-sm text-gray-700">- {item}</Text>) : <Text className="text-sm italic text-gray-400">Belum ada metode.</Text>}
      </View>
      <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Description</Text>
      <Text className="mt-1 text-sm text-gray-700">{previewText(stage.description)}</Text>
      <Text className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Content</Text>
      <View className="mt-2 gap-1">
        {stage.content.length > 0 ? stage.content.map((item, index) => <Text key={`${title}-${index}`} className="text-sm text-gray-700">- {item}</Text>) : <Text className="text-sm italic text-gray-400">Belum ada aktivitas.</Text>}
      </View>
    </Card>
  );
}
