import React from 'react';
import { View, Text, ScrollView, useWindowDimensions, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { AlertBanner } from '../../src/components/ui/AlertBanner';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { getSyllabusStatusLabel, getSyllabusStatusVariant, syllabusTitle } from '../../src/utils/syllabus';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula', 2: 'Dasar', 3: 'Menengah', 4: 'Lanjutan', 5: 'Ahli'
};

export default function SyllabusListScreen() {
  const { syllabi, isLoading, error, refetch } = useSyllabus();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  if (isLoading) return <LoadingSpinner fullScreen message="Memuat silabus..." />;

  if (error && !syllabi) {
    return (
      <EmptyState
        title="Gagal memuat daftar silabus"
        description={getErrorMessage(error, 'Daftar silabus belum dapat dimuat. Coba lagi.')}
        icon="alert-circle-outline"
        action={{ label: 'Coba Lagi', onPress: () => void refetch() }}
      />
    );
  }

  const hasSyllabi = syllabi && syllabi.length > 0;

  return (
    <View className="flex-1 bg-neutral-50 relative">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: isDesktop ? 0 : 100 }}>
        <View className="p-6 max-w-7xl mx-auto w-full">
          {error ? (
            <View className="mb-6">
              <AlertBanner
                variant="warning"
                title="Daftar kurikulum belum sepenuhnya baru"
                description={getErrorMessage(error, 'Terjadi masalah saat memuat daftar kurikulum.')}
                action={{ label: 'Muat ulang', onPress: () => void refetch() }}
              />
            </View>
          ) : null}

          <PageHeader
            eyebrow="Langkah 2"
            title="Pilih kurikulum yang ingin Anda gunakan"
            description="Buka kurikulum final untuk meninjau hasilnya, lalu lanjutkan ke personalisasi ketika sudah siap."
            actions={isDesktop ? <Button title="Buat kurikulum" onPress={() => router.push('/syllabus/create')} icon={<Ionicons name="add-circle" size={20} color="white" />} /> : undefined}
          />

          {!hasSyllabi ? (
            <EmptyState 
              title="Belum ada kurikulum" 
              description="Mulai buat kurikulum pertama Anda dengan mengunggah materi pelajaran."
              icon="school-outline"
              action={isDesktop ? { label: 'Buat kurikulum', onPress: () => router.push('/syllabus/create') } : undefined}
            />
          ) : (
            <View className="-mx-3 mt-8 flex-row flex-wrap">
              {syllabi.map((item) => (
                <View key={item.id} className="w-full md:w-1/2 lg:w-1/3 px-3 mb-6">
                  <Card className="h-full border border-neutral-300 bg-surface shadow-sm rounded-xl border-t-4 border-t-primary-600 overflow-hidden">
                    <View className="flex-row justify-between items-start mb-3">
                      <Badge 
                        label={LEVEL_LABELS[item.target_level] || `Level ${item.target_level}`} 
                        variant="info" 
                        className="opacity-90"
                      />
                      <Badge 
                        label={getSyllabusStatusLabel(item.status)} 
                        variant={getSyllabusStatusVariant(item.status)} 
                      />
                    </View>
                    
                    <Text className="mb-2 text-xl font-semibold leading-tight text-neutral-950" numberOfLines={2}>
                      {syllabusTitle(item)}
                    </Text>
                    
                    <Text className="text-neutral-600 text-sm mb-4 leading-relaxed h-10" numberOfLines={2}>
                      {item.tlo || 'Memproses TLO...'}
                    </Text>

                    <View className="flex-row items-center space-x-4 mb-4 pt-4 border-t border-neutral-100">
                      <View className="flex-row items-center">
                        <Ionicons name="list-outline" size={16} color={colors.textSecondary} />
                        <Text className="text-xs text-neutral-600 ml-1">{item.elos?.length || 0} ELOs</Text>
                      </View>
                      <View className="flex-row items-center">
                        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                        <Text className="text-xs text-neutral-600 ml-1">
                          {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    <Button 
                      title="Buka kurikulum" 
                      variant="outline" 
                      fullWidth
                      onPress={() => router.push(`/syllabus/${item.id}`)}
                      icon={<Ionicons name="arrow-forward" size={16} color={colors.primary} />}
                    />
                  </Card>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
      
      {!isDesktop && (
        <Pressable
          onPress={() => router.push('/syllabus/create')}
          style={[{ bottom: 80, right: 24, zIndex: 999 }, Platform.OS === 'web' ? { position: 'fixed' as 'absolute' } : { position: 'absolute' }]}
          className="w-14 h-14 bg-primary-600 rounded-full items-center justify-center shadow-lg active:scale-95"
        >
          <Ionicons name="add-circle-outline" size={28} color="white" />
        </Pressable>
      )}
    </View>
  );
}
