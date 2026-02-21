import { View, Text, ScrollView, RefreshControl, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useDocuments } from '../src/hooks/useDocuments';
import { useSyllabus } from '../src/hooks/useSyllabus';
import { LoadingSpinner } from '../src/components/ui/LoadingSpinner';
import { StatsCard } from '../src/components/dashboard/StatsCard';
import { QuickActionCard } from '../src/components/dashboard/QuickActionCard';
import { ActivityItem } from '../src/components/dashboard/ActivityItem';
import { colors } from '../src/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';

export default function DashboardScreen() {
  const router = useRouter();
  const { documents, isLoading: isLoadingDocs, refetch: refetchDocs } = useDocuments();
  const { syllabi, isLoading: isLoadingSyllabi, refetch: refetchSyllabi } = useSyllabus();
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const isLoading = isLoadingDocs || isLoadingSyllabi;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchDocs(), refetchSyllabi()]);
    setRefreshing(false);
  }, [refetchDocs, refetchSyllabi]);

  const stats = {
    documents: documents?.length || 0,
    syllabi: syllabi?.length || 0,
    generated: syllabi?.filter((s) => s.status === 'completed').length || 0,
  };

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
      title: s.topic,
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
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <QuickActionCard
              title="Unggah"
              description="Unggah materi PDF, DOCX, atau PPTX."
              iconName="cloud-upload"
              onPress={() => router.push('/documents')}
              color={colors.info}
            />
          </View>
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <QuickActionCard
              title="Buat Silabus"
              description="Buat silabus baru dari dokumen Anda."
              iconName="flash"
              onPress={() => router.push('/syllabus/generate')}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: isDesktop ? 1 : undefined }}>
            <QuickActionCard
              title="Silabus Saya"
              description="Lihat koleksi silabus yang telah dibuat."
              iconName="library"
              onPress={() => router.push('/syllabus')}
              color={colors.secondary}
            />
          </View>
        </View>
      </View>

      <View className="mb-8">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-xl font-bold text-gray-900">Aktivitas Terbaru</Text>
          <Text onPress={() => router.push('/documents')} className="text-primary font-medium">
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
