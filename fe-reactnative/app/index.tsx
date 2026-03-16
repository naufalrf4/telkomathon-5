import { View, Text, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDocuments } from '../src/hooks/useDocuments';
import { useDesignSessionList } from '../src/hooks/useDesignSession';
import { useSyllabus } from '../src/hooks/useSyllabus';
import { getErrorMessage } from '../src/services/api';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { StatsCard } from '../src/components/dashboard/StatsCard';
import { QuickActionCard } from '../src/components/dashboard/QuickActionCard';
import { ActivityItem } from '../src/components/dashboard/ActivityItem';
import { colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { isFinalizedSyllabus, syllabusTitle } from '../src/utils/syllabus';

export default function DashboardScreen() {
  const router = useRouter();
  const { documents, isLoading: isLoadingDocs, error: documentsError, refetch: refetchDocs } = useDocuments();
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

  const isLoading = isLoadingDocs || isLoadingSessions || isLoadingSyllabi;
  const dashboardError = documentsError ?? sessionsError ?? syllabiError ?? null;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDocs(), refetchSessions(), refetchSyllabi()]);
    setRefreshing(false);
  }, [refetchDocs, refetchSessions, refetchSyllabi]);

  const stats = {
    documents: documents?.length || 0,
    syllabi: syllabi?.length || 0,
    generated: syllabi?.filter((s) => isFinalizedSyllabus(s.status)).length || 0,
  };

  const activeSession = sessions?.find((session) => !session.finalized_syllabus_id) ?? null;

  const recentActivity = [
    ...(documents?.map((d) => ({
      id: d.id,
      title: d.filename,
      subtitle: d.file_type.split('/')[1]?.toUpperCase() || 'FILE',
      date: d.created_at,
      type: 'document' as const,
      route: '/documents',
    })) || []),
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

  if (isLoading && !documents && !syllabi) {
    return <LoadingSpinner fullScreen message="Memuat dasbor..." />;
  }

  if (dashboardError && !documents && !syllabi) {
    return (
      <ScrollView className="flex-1 bg-background px-4 py-6">
        <View className="max-w-4xl mx-auto w-full mt-8">
          <View className="bg-red-50 border border-red-200 rounded-2xl p-6 gap-4">
            <Text className="text-2xl font-bold text-red-700">Gagal memuat dasbor</Text>
            <Text className="text-red-700">{getErrorMessage(dashboardError, 'Data dasbor belum dapat dimuat saat ini.')}</Text>
            <View className="flex-row flex-wrap gap-3">
              <QuickActionCard
                title="Coba Lagi"
                description="Muat ulang dokumen dan silabus terbaru."
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
      <View className="mb-8 mt-2">
        <Text className="text-3xl font-bold text-gray-900 mb-2">Selamat datang, Pengajar!</Text>
        <Text className="text-gray-500 text-lg">Siap merancang kurikulum Anda berikutnya?</Text>
      </View>

      {dashboardError ? (
        <View className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Text className="font-semibold text-amber-700">Sebagian data dasbor belum terbarui</Text>
          <Text className="mt-1 text-amber-700">{getErrorMessage(dashboardError, 'Terjadi masalah saat menyegarkan dasbor.')}</Text>
        </View>
      ) : null}

      {activeSession ? (
        <View className="mb-8">
          <Card
            title="Lanjutkan Sesi Desain"
            subtitle={activeSession.course_context?.topic ?? 'Progres sesi tersimpan di backend dan siap dilanjutkan.'}
             action={
              <Button
                title="Lanjutkan"
                size="sm"
                onPress={() => router.push(`/syllabus/create/${activeSession.id}`)}
              />
            }
          >
            <View className="gap-2">
              <Text className="text-gray-600">
                Langkah aktif: {activeSession.wizard_step.replaceAll('_', ' ')}
              </Text>
              <Text className="text-gray-500">
                Diperbarui {new Date(activeSession.updated_at).toLocaleDateString('id-ID')} • {activeSession.document_ids.length} dokumen sumber
              </Text>
            </View>
          </Card>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-4 mb-8">
        <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '47%' }}>
          <StatsCard
            title="Dokumen"
            value={stats.documents}
            iconName="document-text"
            color={colors.info}
          />
        </View>
        <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '47%' }}>
          <StatsCard
            title="Silabus"
            value={stats.syllabi}
            iconName="school"
            color={colors.primary}
          />
        </View>
        <View style={{ flex: isDesktop ? 1 : undefined, width: isDesktop ? undefined : '47%' }}>
          <StatsCard
            title="Dibuat"
            value={stats.generated}
            iconName="checkmark-circle"
            color={colors.success}
          />
        </View>
      </View>

      <View className="mb-8">
        <Text className="text-xl font-bold text-gray-900 mb-4">Aksi Cepat</Text>
        <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: 16 }}>
          {activeSession ? (
            <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Lanjutkan Sesi"
                description="Teruskan create flow yang belum selesai dari langkah terakhir."
                iconName="play"
                onPress={() => router.push(`/syllabus/create/${activeSession.id}`)}
                color={colors.warning}
              />
            </View>
          ) : null}
          <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Upload Dokumen"
                description="Masuk ke create flow untuk unggah atau pilih dokumen siap pakai."
                iconName="cloud-upload"
                onPress={() => router.push('/syllabus/create')}
                color={colors.info}
              />
            </View>
          <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Buat Silabus"
                description="Buat silabus baru dari dokumen Anda."
                iconName="flash"
                onPress={() => router.push('/syllabus/create')}
                color={colors.primary}
              />
            </View>
          <View style={{ flex: isDesktop ? 1 : undefined }}>
              <QuickActionCard
                title="Silabus Saya"
                description="Lihat syllabus final yang siap direvisi dan diekspor."
                iconName="library"
                onPress={() => router.push('/syllabus/generated')}
                color={colors.secondary}
              />
            </View>
        </View>
      </View>

      <View className="mb-8">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-900">Aktivitas Terbaru</Text>
          <Text onPress={() => router.push('/syllabus/generated')} className="text-primary font-medium">
            Lihat Semua
          </Text>
        </View>

        <View className="bg-white rounded-xl shadow-sm border border-gray-100 p-2">
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
            <View className="p-8 items-center">
              <Ionicons name="file-tray-outline" size={48} color={colors.textSecondary} />
              <Text className="text-gray-500 mt-2 text-center">Belum ada aktivitas.</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}
