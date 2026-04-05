import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertBanner } from '../../src/components/ui/AlertBanner';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import { colors } from '../../src/theme/colors';
import { getSyllabusStatusLabel, getSyllabusStatusVariant, syllabusTitle } from '../../src/utils/syllabus';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula',
  2: 'Dasar',
  3: 'Menengah',
  4: 'Lanjutan',
  5: 'Ahli',
};

export default function PersonalizationHubScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ syllabusId?: string }>();
  const selectedSyllabusId = params.syllabusId;
  const { syllabi, isLoading, error, refetch } = useSyllabus();

  if (isLoading && !syllabi) {
    return <LoadingSpinner fullScreen message="Memuat personalisasi..." />;
  }

  if (error && !syllabi) {
    return (
      <EmptyState
        title="Gagal memuat personalisasi"
        description={getErrorMessage(error, 'Daftar silabus belum dapat dimuat untuk personalisasi.')}
        icon="alert-circle-outline"
        action={{ label: 'Coba Lagi', onPress: () => void refetch() }}
      />
    );
  }

  const availableSyllabi = selectedSyllabusId
    ? (syllabi ?? []).filter((item) => item.id === selectedSyllabusId)
    : syllabi ?? [];

  return (
    <ScrollView className="flex-1 bg-neutral-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl gap-6 p-4 lg:p-8">
        <PageHeader
          eyebrow="Langkah 3"
          title={selectedSyllabusId ? 'Pilih mode personalisasi' : 'Buat rekomendasi belajar dari kurikulum final'}
          description={
            selectedSyllabusId
              ? 'Satu tombol dari halaman hasil kini mengarahkan Anda ke sini. Pilih apakah rekomendasi ingin dibuat untuk satu peserta atau banyak peserta sekaligus.'
              : 'Pilih kurikulum final, lalu tentukan mode personalisasi yang paling sesuai: single-user atau multi-user.'
          }
        />

        {error ? (
          <AlertBanner
            variant="warning"
            title="Sebagian data belum diperbarui"
            description={getErrorMessage(error, 'Terjadi masalah saat memuat daftar kurikulum.')}
            action={{ label: 'Muat ulang', onPress: () => void refetch() }}
          />
        ) : null}

        {availableSyllabi.length > 0 ? (
          <View className="grid gap-4 lg:grid-cols-2">
            {availableSyllabi.map((item) => (
              <Card key={item.id} className="h-full border border-neutral-300 bg-surface shadow-sm">
                <View className="gap-4">
                  <View className="flex-row flex-wrap items-center justify-between gap-3">
                    <View className="flex-row flex-wrap gap-2">
                      <Badge label={LEVEL_LABELS[item.target_level] || `Level ${item.target_level}`} variant="info" />
                      <Badge label={getSyllabusStatusLabel(item.status)} variant={getSyllabusStatusVariant(item.status)} />
                    </View>
                    {selectedSyllabusId ? (
                      <Button
                        title="Kembali ke hasil"
                        variant="ghost"
                        size="sm"
                        onPress={() => router.push(`/syllabus/${item.id}`)}
                      />
                    ) : null}
                  </View>
                  <View className="gap-2">
                    <Text className="text-xl font-semibold text-neutral-950">{syllabusTitle(item)}</Text>
                    <Text className="text-sm text-neutral-600">{item.company_profile_summary || item.commercial_overview || item.tlo}</Text>
                  </View>
                  <View className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                    <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Mode personalisasi</Text>
                    <View className="mt-3 flex-row flex-wrap gap-3">
                      <Button
                        title="Satu peserta"
                        onPress={() => router.push(`/personalize/${item.id}`)}
                        icon={<Ionicons name="person-outline" size={18} color="white" />}
                      />
                      <Button
                        title="Banyak peserta"
                        variant="outline"
                        onPress={() => router.push(`/personalize/${item.id}/bulk`)}
                        icon={<Ionicons name="people-outline" size={18} color={colors.textSecondary} />}
                      />
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            title={selectedSyllabusId ? 'Kurikulum tidak ditemukan' : 'Belum ada silabus final'}
            description={
              selectedSyllabusId
                ? 'Buka kembali halaman hasil kurikulum lalu ulangi masuk ke personalisasi.'
                : 'Selesaikan create flow terlebih dahulu sebelum menjalankan personalisasi peserta.'
            }
            icon="sparkles-outline"
            action={{ label: 'Buat silabus', onPress: () => router.push('/syllabus/create') }}
          />
        )}
      </View>
    </ScrollView>
  );
}
