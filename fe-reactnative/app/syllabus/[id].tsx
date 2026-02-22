import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { ELOAccordion } from '../../src/features/ELOAccordion';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula', 2: 'Dasar', 3: 'Menengah', 4: 'Lanjutan', 5: 'Ahli'
};

export default function SyllabusDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { syllabus, isLoading } = useSyllabus(id as string);

  if (isLoading || !syllabus) return <LoadingSpinner fullScreen message="Memuat detail kursus..." />;

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="max-w-7xl mx-auto w-full p-4 lg:p-8">
        {/* Header Section */}
        <View className="flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <View>
            <View className="flex-row items-center space-x-2 mb-2">
              <Pressable onPress={() => router.back()} className="p-1 -ml-1">
                <Ionicons name="arrow-back" size={24} color={colors.secondary} />
              </Pressable>
              <Badge label={LEVEL_LABELS[syllabus.target_level] || `Level ${syllabus.target_level}`} variant="info" />
              <Badge label={syllabus.status} variant={syllabus.status === 'completed' ? 'success' : 'warning'} />
            </View>
            <Text className="text-3xl font-bold text-gray-900">{syllabus.topic}</Text>
          </View>
          
          <View className="flex-row flex-wrap gap-3">
            <Button 
              title="Chat / Revisi" 
              variant="secondary"
              icon={<Ionicons name="chatbubbles-outline" size={18} color="white" />}
              onPress={() => router.push(`/chat/${id}`)}
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
              title="Ekspor PDF" 
              variant="outline"
              icon={<Ionicons name="document-text-outline" size={18} color={colors.secondary} />}
              onPress={() => router.push(`/export/${id}`)}
            />
          </View>
        </View>

        {/* TLO Section */}
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

        {/* Main Content Grid */}
        <View className="flex-col xl:flex-row gap-8">
          {/* Left Column: ELOs */}
          <View className="flex-1 xl:w-1/3">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-gray-900">Rincian Modul</Text>
              <Badge label={`${syllabus.elos.length} Modul`} variant="default" />
            </View>
            <ELOAccordion elos={syllabus.elos} />
          </View>

          {/* Right Column: Learning Journey */}
          <View className="flex-[2] xl:w-2/3">
            <Text className="text-xl font-bold text-gray-900 mb-4">Perjalanan Belajar</Text>
            <View className="flex-col lg:flex-row gap-4">
              <JourneyCard 
                title="Pra-Pembelajaran" 
                icon="book-outline"
                items={syllabus.journey.pre_learning} 
                accentColor="border-indigo-500" 
                bgColor="bg-indigo-50"
                iconColor="text-indigo-600"
              />
              <JourneyCard 
                title="Di Kelas" 
                icon="people-outline"
                items={syllabus.journey.classroom} 
                accentColor="border-emerald-500" 
                bgColor="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <JourneyCard 
                title="Pasca-Pembelajaran" 
                icon="rocket-outline"
                items={syllabus.journey.after_learning} 
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
