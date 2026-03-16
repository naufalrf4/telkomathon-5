import { ScrollView, View, Text, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import { designSessionsService } from '../../src/services/designSessions';
import { colors } from '../../src/theme/colors';
import { emptyLearningJourney, syllabusTitle } from '../../src/utils/syllabus';

function previewText(value: string | null | undefined, fallback = 'Belum diisi'): string {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function previewList(values: string[] | undefined, fallback = 'Belum ada item'): string[] {
  return values && values.length > 0 ? values : [fallback];
}

export default function ExportScreen() {
  const { syllabusId: syllabusIdParam, id } = useLocalSearchParams<{ syllabusId?: string; id?: string }>();
  const syllabusId = syllabusIdParam ?? id ?? '';
  const router = useRouter();
  const { syllabus, isLoading, error, refetch } = useSyllabus(syllabusId);

  const handleDownload = async () => {
    const url = designSessionsService.getSyllabusDocxDownloadUrl(syllabusId);
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await Linking.openURL(url);
    }
  };

  const journey = syllabus?.journey ?? emptyLearningJourney();
  const templateFields = syllabus
    ? [
        ['course_category', previewText(syllabus.course_category)],
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
        <Text className="mt-4 text-gray-500 font-medium">Menyiapkan ekspor...</Text>
      </View>
    );
  }

  if (error && !syllabus) {
    return (
      <View className="flex-1 justify-center items-center p-6 bg-gray-50">
        <Card className="w-full max-w-md p-8 gap-4 border border-red-200 bg-red-50">
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
      <View className="flex-1 justify-center items-center p-6 bg-gray-50">
        <Card className="w-full max-w-md p-8 gap-4 border border-amber-200 bg-amber-50">
          <Text className="text-xl font-bold text-amber-700">Silabus tidak ditemukan</Text>
          <Text className="text-amber-700">Buka detail silabus lain lalu coba ekspor kembali.</Text>
          <Button title="Kembali ke Daftar" onPress={() => router.push('/syllabus')} />
        </Card>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl gap-6 p-6 lg:p-8">
        <View className="items-center">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Ekspor Silabus</Text>
        <Text className="text-center text-gray-500">
          Review isi DOCX sebelum mengunduh. Preview ini memakai field yang sama dengan renderer template backend.
        </Text>
        </View>

        <View className="gap-6 lg:flex-row">
          <Card className="lg:w-[360px] lg:self-start">
            <View className="items-center">
              <View className="mb-6 h-24 w-24 items-center justify-center rounded-full border border-red-100 bg-red-50 shadow-sm">
                <Ionicons name="document-text" size={48} color={colors.primary} />
              </View>
              <Text className="mb-2 px-4 text-center text-xl font-bold text-gray-900 leading-tight">
                {syllabusTitle(syllabus)}
              </Text>
              <View className="mb-6 w-full rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <Text className="text-sm font-semibold text-gray-800">Snapshot Export</Text>
                <Text className="mt-1 text-sm text-gray-500">Kategori: {previewText(syllabus.course_category)}</Text>
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
                <Button
                  title="Unduh DOCX"
                  onPress={handleDownload}
                  size="lg"
                  className="w-full rounded-xl bg-primary py-4 shadow-md"
                  icon={<Ionicons name="download-outline" size={20} color="white" />}
                />
                <Button
                  title="Kembali ke Silabus"
                  variant="ghost"
                  onPress={() => router.push(`/syllabus/${syllabusId}`)}
                  className="w-full py-3"
                  textClassName="font-medium text-gray-500"
                />
              </View>
            </View>
          </Card>

          <View className="flex-1 gap-6">
            <Card>
              <Text className="text-sm font-semibold uppercase tracking-wide text-primary">Template mapping</Text>
              <Text className="mt-2 text-sm text-gray-500">
                Runtime DOCX template sudah memakai tag `docxtpl`. Panel ini memperlihatkan field yang akan dipetakan ke template saat export dijalankan.
              </Text>
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
                <Text className="mt-2 text-sm text-gray-200">{previewText(syllabus.client_company_name)} • {previewText(syllabus.course_category)}</Text>
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
                  <View className="grid gap-3 lg:flex-row lg:flex">
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
                          <View className="mt-2 gap-1">
                            {elo.pce.map((point, pointIndex) => (
                              <Text key={`${elo.elo}-${pointIndex}`} className="text-sm text-gray-600">- {point}</Text>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  </Card>
                </View>

                <View className="gap-3">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-primary">3. Learning journey</Text>
                  <View className="grid gap-3 lg:flex-row lg:flex">
                    <Card className="border-gray-100 bg-gray-50 lg:flex-1">
                      <Text className="text-sm font-semibold text-gray-900">Pre-learning</Text>
                      <View className="mt-2 gap-1">
                        {previewList(journey.pre_learning, 'Belum ada aktivitas pre-learning.').map((item, index) => (
                          <Text key={`pre-${index}`} className="text-sm text-gray-700">- {item}</Text>
                        ))}
                      </View>
                    </Card>
                    <Card className="border-gray-100 bg-gray-50 lg:flex-1">
                      <Text className="text-sm font-semibold text-gray-900">Classroom</Text>
                      <View className="mt-2 gap-1">
                        {previewList(journey.classroom, 'Belum ada aktivitas classroom.').map((item, index) => (
                          <Text key={`classroom-${index}`} className="text-sm text-gray-700">- {item}</Text>
                        ))}
                      </View>
                    </Card>
                    <Card className="border-gray-100 bg-gray-50 lg:flex-1">
                      <Text className="text-sm font-semibold text-gray-900">After-learning</Text>
                      <View className="mt-2 gap-1">
                        {previewList(journey.after_learning, 'Belum ada aktivitas after-learning.').map((item, index) => (
                          <Text key={`after-${index}`} className="text-sm text-gray-700">- {item}</Text>
                        ))}
                      </View>
                    </Card>
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
