import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { ELOAccordion } from '../../src/features/ELOAccordion';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { getSyllabusStatusLabel, getSyllabusStatusVariant, syllabusTitle } from '../../src/utils/syllabus';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula', 2: 'Dasar', 3: 'Menengah', 4: 'Lanjutan', 5: 'Ahli'
};

export default function SyllabusDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { syllabus, isLoading, error, refetch } = useSyllabus(id as string);
  const journey = syllabus?.journey ?? { pre_learning: [], classroom: [], after_learning: [] };

  if (isLoading && !syllabus) return <LoadingSpinner fullScreen message="Memuat detail kursus..." />;

  if (error && !syllabus) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="max-w-3xl mx-auto w-full p-4 lg:p-8">
          <Card className="border border-red-200 bg-red-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-red-700">Gagal memuat detail silabus</Text>
              <Text className="text-red-700">{getErrorMessage(error, 'Detail silabus belum dapat dimuat.')}</Text>
              <View className="flex-row flex-wrap gap-3">
                <Button title="Coba Lagi" onPress={() => void refetch()} />
                <Button title="Kembali" variant="outline" onPress={() => router.push('/syllabus')} />
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
        <View className="max-w-3xl mx-auto w-full p-4 lg:p-8">
          <Card className="border border-amber-200 bg-amber-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-amber-700">Silabus tidak ditemukan</Text>
              <Text className="text-amber-700">Buka daftar silabus untuk memilih silabus lain.</Text>
              <Button title="Kembali ke Daftar" onPress={() => router.push('/syllabus')} />
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="max-w-7xl mx-auto w-full p-4 lg:p-8">
        <View className="flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <View>
            <View className="flex-row items-center space-x-2 mb-2">
              <Pressable onPress={() => router.back()} className="p-1 -ml-1">
                <Ionicons name="arrow-back" size={24} color={colors.secondary} />
              </Pressable>
              <Badge label={LEVEL_LABELS[syllabus.target_level] || `Level ${syllabus.target_level}`} variant="info" />
              <Badge label={getSyllabusStatusLabel(syllabus.status)} variant={getSyllabusStatusVariant(syllabus.status)} />
            </View>
            <Text className="text-3xl font-bold text-gray-900">{syllabusTitle(syllabus)}</Text>
          </View>
          
          <View className="flex-row flex-wrap gap-3">
            <Button 
              title="Revision Workspace" 
              variant="secondary"
              icon={<Ionicons name="chatbubbles-outline" size={18} color="white" />}
              onPress={() => router.push(`/syllabus/${id}/revision`)}
              className="shadow-sm"
            />
            <Button 
              title="Personalisasi" 
              variant="primary"
              icon={<Ionicons name="options-outline" size={18} color="white" />}
              onPress={() => router.push(`/personalize/${id}`)}
              className="shadow-sm"
            />
            <Button 
              title="Ekspor DOCX" 
              variant="outline"
              icon={<Ionicons name="document-text-outline" size={18} color={colors.secondary} />}
              onPress={() => router.push(`/syllabus/${id}/export`)}
            />
          </View>
        </View>

        <View className="mb-8 flex-col gap-4 lg:flex-row">
          <Card className="flex-1 border border-gray-100 bg-white shadow-sm">
            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Course Snapshot</Text>
              <Text className="text-base font-semibold text-gray-900">{syllabus.course_category || 'Kategori belum diisi'}</Text>
              <Text className="text-sm text-gray-500">Klien: {syllabus.client_company_name || 'Belum diset'}</Text>
              <Text className="text-sm text-gray-500">Judul ekspor: {syllabus.course_title || syllabus.topic}</Text>
            </View>
          </Card>
          <Card className="flex-1 border border-gray-100 bg-white shadow-sm">
            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Revision Readiness</Text>
              <Text className="text-sm text-gray-700">Riwayat revisi: {syllabus.revision_history.length}</Text>
              <Text className="text-sm text-gray-600">Performa: {syllabus.performance_result || 'Belum tersedia'}</Text>
              <Text className="text-sm text-gray-600">Condition: {syllabus.condition_result || 'Belum tersedia'}</Text>
              <Text className="text-sm text-gray-600">Standard: {syllabus.standard_result || 'Belum tersedia'}</Text>
            </View>
          </Card>
        </View>

        <Card className="mb-8 border-l-4 border-l-primary bg-white shadow-sm">
          <View className="flex-row items-start">
            <View className="bg-primary/10 p-3 rounded-full mr-4">
              <Ionicons name="trophy-outline" size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-primary uppercase tracking-wider mb-1">Tujuan Pembelajaran Terminal (TLO)</Text>
              <Text className="text-lg text-gray-800 leading-relaxed font-medium">{syllabus.tlo}</Text>
            </View>
          </View>
        </Card>

        <View className="flex-col xl:flex-row gap-8">
          <View className="flex-1 xl:w-1/3">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-gray-900">Rincian Modul</Text>
              <Badge label={`${syllabus.elos.length} Modul`} variant="default" />
            </View>
            <ELOAccordion elos={syllabus.elos} />
          </View>

          <View className="flex-[2] xl:w-2/3">
            <Text className="text-xl font-bold text-gray-900 mb-4">Perjalanan Belajar</Text>
            <View className="flex-col lg:flex-row gap-4">
              <JourneyCard 
                title="Pra-Pembelajaran" 
                icon="book-outline"
                items={journey.pre_learning} 
                accentColor="border-indigo-500" 
                bgColor="bg-indigo-50"
                iconColor="text-indigo-600"
              />
              <JourneyCard 
                title="Di Kelas" 
                icon="people-outline"
                items={journey.classroom} 
                accentColor="border-emerald-500" 
                bgColor="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <JourneyCard 
                title="Pasca-Pembelajaran" 
                icon="rocket-outline"
                items={journey.after_learning} 
                accentColor="border-amber-500" 
                bgColor="bg-amber-50"
                iconColor="text-amber-600"
              />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

interface JourneyCardProps {
  title: string;
  items: string[];
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accentColor: string;
  bgColor: string;
  iconColor: string;
}

function JourneyCard({ title, items, icon, accentColor, bgColor, iconColor }: JourneyCardProps) {
  return (
    <View className={`flex-1 rounded-xl border-t-4 shadow-sm bg-white overflow-hidden ${accentColor}`}>
      <View className={`${bgColor} p-4 flex-row items-center border-b border-gray-100`}>
        <Ionicons name={icon} size={20} className={`mr-2 ${iconColor}`} />
        <Text className={`font-bold ${iconColor} uppercase tracking-wide text-xs ml-2`}>{title}</Text>
      </View>
      <View className="p-4 space-y-3">
        {items?.map((item: string, idx: number) => (
          <View key={idx} className="flex-row items-start">
            <View className="w-6 h-6 rounded-full bg-gray-100 items-center justify-center mr-3 mt-0.5">
              <Text className="text-xs font-bold text-gray-600">{idx + 1}</Text>
            </View>
            <Text className="text-gray-700 text-sm flex-1 leading-5">{item}</Text>
          </View>
        ))}
        {(!items || items.length === 0) && (
          <Text className="text-gray-400 italic text-sm">Tidak ada item terjadwal</Text>
        )}
      </View>
    </View>
  );
}
