import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { ELOAccordion } from '../../src/features/ELOAccordion';
import { colors } from '../../src/theme/colors';
import { emptyLearningJourney, getSyllabusStatusLabel, getSyllabusStatusVariant, syllabusTitle } from '../../src/utils/syllabus';
import type { LearningJourneyStage } from '../../src/types/api';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula',
  2: 'Dasar',
  3: 'Menengah',
  4: 'Lanjutan',
  5: 'Ahli',
};

export default function SyllabusDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { syllabus, isLoading, error, refetch } = useSyllabus(id as string);
  const journey = syllabus?.journey ?? emptyLearningJourney();

  if (isLoading && !syllabus) {
    return <LoadingSpinner fullScreen message="Memuat detail kursus..." />;
  }

  if (error && !syllabus) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <Card className="border border-red-200 bg-red-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-red-700">Gagal memuat detail silabus</Text>
              <Text className="text-red-700">{getErrorMessage(error, 'Detail silabus belum dapat dimuat.')}</Text>
              <View className="flex-row flex-wrap gap-3">
                <Button title="Coba Lagi" onPress={() => void refetch()} />
                <Button title="Kembali" variant="outline" onPress={() => router.push('/syllabus/generated')} />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  if (!syllabus) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <Card className="border border-amber-200 bg-amber-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-amber-700">Silabus tidak ditemukan</Text>
              <Text className="text-amber-700">Buka daftar silabus untuk memilih silabus lain.</Text>
              <Button title="Kembali ke Daftar" onPress={() => router.push('/syllabus/generated')} />
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-7xl p-4 lg:p-8">
        <View className="mb-8 flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
          <View>
            <View className="mb-2 flex-row items-center space-x-2">
              <Pressable onPress={() => router.back()} className="-ml-1 p-1">
                <Ionicons name="arrow-back" size={24} color={colors.secondary} />
              </Pressable>
              <Badge label={LEVEL_LABELS[syllabus.target_level] || `Level ${syllabus.target_level}`} variant="info" />
              <Badge label={syllabus.course_expertise_level} variant="default" />
              <Badge label={getSyllabusStatusLabel(syllabus.status)} variant={getSyllabusStatusVariant(syllabus.status)} />
            </View>
            <Text className="text-3xl font-bold text-gray-900">{syllabusTitle(syllabus)}</Text>
          </View>

          <View className="flex-row flex-wrap gap-3">
            <Button title="Revision Workspace" variant="secondary" icon={<Ionicons name="chatbubbles-outline" size={18} color="white" />} onPress={() => router.push(`/syllabus/${id}/revision`)} className="shadow-sm" />
            <Button title="Personalisasi" variant="primary" icon={<Ionicons name="options-outline" size={18} color="white" />} onPress={() => router.push(`/personalize/${id}`)} className="shadow-sm" />
            <Button title="Ekspor DOCX" variant="outline" icon={<Ionicons name="document-text-outline" size={18} color={colors.secondary} />} onPress={() => router.push(`/syllabus/${id}/export`)} />
          </View>
        </View>

        <View className="mb-8 flex-col gap-4 lg:flex-row">
          <Card className="flex-1 border border-gray-100 bg-white shadow-sm">
            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Course Snapshot</Text>
              <Text className="text-base font-semibold text-gray-900">{syllabus.course_category || 'Kategori belum diisi'}</Text>
              <Text className="text-sm text-gray-500">Expertise: {syllabus.course_expertise_level}</Text>
              <Text className="text-sm text-gray-500">Klien: {syllabus.client_company_name || 'Belum diset'}</Text>
              <Text className="text-sm text-gray-500">Judul ekspor: {syllabus.course_title || syllabus.topic}</Text>
            </View>
          </Card>
          <Card className="flex-1 border border-gray-100 bg-white shadow-sm">
            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Revision Readiness</Text>
              <Text className="text-sm text-gray-700">Riwayat revisi: {syllabus.revision_history.length}</Text>
              <Text className="text-sm text-gray-600">Performance: {syllabus.performance_result || 'Belum tersedia'}</Text>
              <Text className="text-sm text-gray-600">Condition: {syllabus.condition_result || 'Belum tersedia'}</Text>
              <Text className="text-sm text-gray-600">Standard: {syllabus.standard_result || 'Belum tersedia'}</Text>
            </View>
          </Card>
        </View>

        <Card className="mb-8 border-l-4 border-l-primary bg-white shadow-sm">
          <View className="flex-row items-start">
            <View className="mr-4 rounded-full bg-primary/10 p-3">
              <Ionicons name="trophy-outline" size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-sm font-bold uppercase tracking-wider text-primary">Tujuan Pembelajaran Terminal (TLO)</Text>
              <Text className="text-lg font-medium leading-relaxed text-gray-800">{syllabus.tlo}</Text>
            </View>
          </View>
        </Card>

        <View className="mb-8 grid gap-4 lg:grid-cols-3">
          <Card className="border-gray-100 bg-white shadow-sm">
            <Text className="text-sm font-semibold text-gray-900">Performance</Text>
            <Text className="mt-2 text-sm leading-6 text-gray-700">{syllabus.performance_result || 'Belum tersedia'}</Text>
          </Card>
          <Card className="border-gray-100 bg-white shadow-sm">
            <Text className="text-sm font-semibold text-gray-900">Condition</Text>
            <Text className="mt-2 text-sm leading-6 text-gray-700">{syllabus.condition_result || 'Belum tersedia'}</Text>
          </Card>
          <Card className="border-gray-100 bg-white shadow-sm">
            <Text className="text-sm font-semibold text-gray-900">Standard</Text>
            <Text className="mt-2 text-sm leading-6 text-gray-700">{syllabus.standard_result || 'Belum tersedia'}</Text>
          </Card>
        </View>

        <View className="flex-col gap-8 xl:flex-row">
          <View className="xl:w-1/3 xl:flex-1">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-gray-900">Enabling Learning Outcomes</Text>
              <Badge label={`${syllabus.elos.length} ELO`} variant="default" />
            </View>
            <ELOAccordion elos={syllabus.elos} />
          </View>

          <View className="xl:w-2/3 xl:flex-[2]">
            <Text className="mb-4 text-xl font-bold text-gray-900">Learning Journey</Text>
            <View className="flex-col gap-4 lg:flex-row">
              <JourneyCard title="Pra-Pembelajaran" icon="book-outline" stage={journey.pre_learning} accentColor="border-indigo-500" bgColor="bg-indigo-50" iconColor="text-indigo-600" />
              <JourneyCard title="Di Kelas" icon="people-outline" stage={journey.classroom} accentColor="border-emerald-500" bgColor="bg-emerald-50" iconColor="text-emerald-600" />
              <JourneyCard title="Pasca-Pembelajaran" icon="rocket-outline" stage={journey.after_learning} accentColor="border-amber-500" bgColor="bg-amber-50" iconColor="text-amber-600" />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

interface JourneyCardProps {
  title: string;
  stage: LearningJourneyStage;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accentColor: string;
  bgColor: string;
  iconColor: string;
}

function JourneyCard({ title, stage, icon, accentColor, bgColor, iconColor }: JourneyCardProps) {
  return (
    <View className={`flex-1 overflow-hidden rounded-xl border-t-4 bg-white shadow-sm ${accentColor}`}>
      <View className={`${bgColor} flex-row items-center border-b border-gray-100 p-4`}>
        <Ionicons name={icon} size={20} className={`mr-2 ${iconColor}`} />
        <Text className={`ml-2 text-xs font-bold uppercase tracking-wide ${iconColor}`}>{title}</Text>
      </View>
      <View className="space-y-4 p-4">
        <StageField label="Duration" value={stage.duration} fallback="Belum diisi" />
        <StageField label="Description" value={stage.description} fallback="Belum diisi" />
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-gray-400">Content</Text>
          {stage.content.length > 0 ? (
            stage.content.map((item, idx) => (
              <View key={`${title}-${idx}`} className="flex-row items-start">
                <View className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <Text className="flex-1 text-sm leading-5 text-gray-700">{item}</Text>
              </View>
            ))
          ) : (
            <Text className="text-sm italic text-gray-400">Belum ada konten terjadwal</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function StageField({ label, value, fallback }: { label: string; value: string; fallback: string }) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</Text>
      <Text className="text-sm leading-6 text-gray-700">{value?.trim() ? value : fallback}</Text>
    </View>
  );
}
