import { View, Text, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDesignSessionList } from '../src/hooks/useDesignSession';
import { useSyllabus } from '../src/hooks/useSyllabus';
import { getErrorMessage } from '../src/services/api';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { AlertBanner } from '../src/components/ui/AlertBanner';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { PageHeader } from '../src/components/ui/PageHeader';
import { StatsCard } from '../src/components/dashboard/StatsCard';
import { QuickActionCard } from '../src/components/dashboard/QuickActionCard';
import { ActivityItem } from '../src/components/dashboard/ActivityItem';
import { colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { isFinalizedSyllabus, syllabusTitle } from '../src/utils/syllabus';

function formatWizardStepLabel(step: string) {
  const labels: Record<string, string> = {
    uploaded: 'Materi dipilih',
    summary_ready: 'Ringkasan siap',
    course_context_set: 'Arah kursus ditetapkan',
    tlo_options_ready: 'Tujuan akhir siap dipilih',
    tlo_selected: 'Tujuan akhir dipilih',
    performance_options_ready: 'Target performa siap dipilih',
    performance_selected: 'Target performa dipilih',
    elo_options_ready: 'Modul belajar siap dipilih',
    elo_selected: 'Modul belajar dipilih',
    finalized: 'Kurikulum selesai',
  };

  return labels[step] ?? step.replaceAll('_', ' ');
}

export default function DashboardScreen() {
  const router = useRouter();
  const {
    data: sessions,
    isLoading: isLoadingSessions,
    error: sessionsError,
    refetch: refetchSessions,
  } = useDesignSessionList();
  const { syllabi, isLoading: isLoadingSyllabi, error: syllabiError, refetch: refetchSyllabi } = useSyllabus();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const isLoading = isLoadingSessions || isLoadingSyllabi;
  const dashboardError = sessionsError ?? syllabiError ?? null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSessions(), refetchSyllabi()]);
    setRefreshing(false);
  }, [refetchSessions, refetchSyllabi]);

  const stats = {
    draftSessions: sessions?.filter((session) => !session.finalized_syllabus_id).length || 0,
    syllabi: syllabi?.length || 0,
    generated: syllabi?.filter((s) => isFinalizedSyllabus(s.status)).length || 0,
  };

  const activeSession = sessions?.find((session) => !session.finalized_syllabus_id) ?? null;

  const recentActivity = [
    ...(syllabi?.map((s) => ({
      id: s.id,
      title: syllabusTitle(s),
      subtitle: `Level ${s.target_level} • ${s.status}`,
      date: s.created_at,
      type: 'syllabus' as const,
      route: `/syllabus/${s.id}`,
    })) || []),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  if (isLoading && !syllabi) {
    return <LoadingSpinner fullScreen message="Memuat dasbor..." />;
  }

  if (dashboardError && !syllabi) {
    return (
      <ScrollView className="flex-1 bg-background px-4 py-6">
        <View className="max-w-4xl mx-auto w-full mt-8">
          <View className="bg-red-50 border border-red-200 rounded-xl p-6 gap-4">
            <Text className="text-2xl font-bold text-red-700">Gagal memuat dasbor</Text>
            <Text className="text-red-700">{getErrorMessage(dashboardError, 'Data dasbor belum dapat dimuat saat ini.')}</Text>
            <View className="flex-row flex-wrap gap-3">
              <QuickActionCard
                title="Coba Lagi"
                description="Muat ulang sesi aktif dan silabus terbaru."
                iconName="refresh"
                onPress={() => void onRefresh()}
                color={colors.primary}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background px-4 py-6"
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <PageHeader
        eyebrow="Langkah kerja"
        title="Pilih langkah kerja berikutnya"
        actions={(
          <>
            <Button title="Buat kurikulum" onPress={() => router.push('/syllabus/create')} />
            {activeSession ? <Button title="Lanjutkan draf" variant="outline" onPress={() => router.push(`/syllabus/create/${activeSession.id}`)} /> : null}
            <Button title="Buka personalisasi" variant="outline" onPress={() => router.push('/personalize')} />
          </>
        )}
      />

      {dashboardError ? (
        <View className="mb-6 mt-6">
          <AlertBanner
            variant="warning"
            title="Sebagian data belum diperbarui"
            description={getErrorMessage(dashboardError, 'Terjadi masalah saat menyegarkan dashboard.')}
            action={{ label: 'Muat ulang', onPress: () => void onRefresh() }}
          />
        </View>
      ) : null}

      {activeSession ? (
        <View className="mb-8 mt-6">
          <Card
            title="Lanjutkan draf aktif"
            subtitle={activeSession.course_context?.topic ?? 'Draf terakhir Anda masih terbuka dan bisa dilanjutkan kapan saja.'}
             action={
               <Button
                 title="Lanjutkan"
                 size="sm"
                 onPress={() => router.push(`/syllabus/create/${activeSession.id}`)}
               />
            }
          >
            <View className="gap-2">
              <Text className="text-neutral-700">Tahap saat ini: {formatWizardStepLabel(activeSession.wizard_step)}</Text>
              <Text className="text-neutral-500">
                Diperbarui {new Date(activeSession.updated_at).toLocaleDateString('id-ID')} • {activeSession.document_ids.length} dokumen sumber
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      <View className="mb-8 flex-row flex-wrap gap-4">
        <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '47%' }}>
          <StatsCard title="Draft aktif" value={stats.draftSessions} iconName="layers" color={colors.warning} />
        </View>
        <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '47%' }}>
          <StatsCard title="Kurikulum" value={stats.syllabi} iconName="school" color={colors.primary} />
        </View>
        <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '47%' }}>
          <StatsCard title="Siap dipakai" value={stats.generated} iconName="checkmark-circle" color={colors.success} />
        </View>
      </View>

      <View className="mb-8">
        <Text className="mb-4 text-xl font-semibold text-neutral-950">Lanjutkan dari sini</Text>
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16 }}>
          {activeSession ? (
            <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Lanjutkan draf"
                description="Lanjutkan tahap terakhir yang belum selesai."
                iconName="play"
                onPress={() => router.push(`/syllabus/create/${activeSession.id}`)}
                color={colors.warning}
              />
            </View>
          ) : null}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Buat kurikulum"
                description="Unggah materi dan finalkan kurikulum baru."
                iconName="cloud-upload"
                onPress={() => router.push('/syllabus/create')}
                color={colors.primary}
              />
            </View>
          <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Buka kurikulum"
                description="Buka kurikulum final yang sudah siap dipakai."
                iconName="library"
                onPress={() => router.push('/syllabus/generated')}
                color={colors.info}
              />
            </View>
            <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Buat rekomendasi"
                description="Masuk ke personalisasi dari kurikulum final."
                iconName="library"
                onPress={() => router.push('/personalize')}
                color={colors.textMuted ?? '#94A3B8'}
              />
            </View>
        </View>
      </View>

      <View className="mb-8">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-semibold text-neutral-950">Kurikulum terbaru</Text>
          <Text onPress={() => router.push('/syllabus/generated')} className="font-medium text-primary-600">
            Lihat semua
          </Text>
        </View>

        <View className="rounded-2xl border border-neutral-200 bg-surface p-2 shadow-sm">
          {recentActivity.length > 0 ? (
            recentActivity.map((item) => (
              <ActivityItem
                key={`${item.type}-${item.id}`}
                title={item.title}
                subtitle={item.subtitle}
                date={new Date(item.date).toLocaleDateString()}
                type={item.type}
                onPress={() => router.push(item.route)}
              />
            ))
          ) : (
            <View className="items-center p-8">
              <Ionicons name="file-tray-outline" size={48} color={colors.textMuted ?? '#94A3B8'} />
              <Text className="mt-3 text-center text-sm text-neutral-500">Belum ada kurikulum yang dibuat. Mulai dari tombol buat kurikulum.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
