import { View, Text, ScrollView, Alert, TextInput } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { GapInputCard } from '../../src/components/personalize/GapInputCard';
import { RecommendationCard } from '../../src/components/personalize/RecommendationCard';
import { Ionicons } from '@expo/vector-icons';
import { CompetencyGap, PersonalizationResult, LearningRecommendation } from '../../src/types/api';
import { colors } from '../../src/theme/colors';

// Helper to filter/group recommendations
const groupRecommendations = (recommendations: LearningRecommendation[]) => {
  const getPriorityLabel = (p: number | string) => {
    if (p === 1 || p === 'High') return 'High';
    if (p === 2 || p === 'Medium') return 'Medium';
    return 'Low';
  };

  const grouped: Record<string, LearningRecommendation[]> = {
    High: [],
    Medium: [],
    Low: []
  };

  recommendations.forEach(r => {
    const label = getPriorityLabel(r.priority);
    if (grouped[label]) {
      grouped[label].push(r);
    }
  });

  return grouped;
};

export default function PersonalizeScreen() {
  const { syllabusId } = useLocalSearchParams();
  const router = useRouter();
  const { personalize, isPersonalizing, personalization, syllabus } = useSyllabus(syllabusId as string, {
    includePersonalization: true,
  });

  const [gaps, setGaps] = useState<CompetencyGap[]>([
    { skill: '', current_level: 1, required_level: 3, gap_description: '' }
  ]);
  const [participantName, setParticipantName] = useState('');

  const addGap = () => {
    setGaps([...gaps, { skill: '', current_level: 1, required_level: 3, gap_description: '' }]);
  };

  const removeGap = (index: number) => {
    if (gaps.length > 1) {
      setGaps(gaps.filter((_, i) => i !== index));
    }
  };

  const updateGap = (index: number, field: keyof CompetencyGap, value: string | number) => {
    const newGaps = [...gaps];
    const gap = { ...newGaps[index] };
    
    if (field === 'current_level') {
      gap.current_level = Number(value);
    } else if (field === 'required_level') {
      gap.required_level = Number(value);
    } else if (field === 'skill') {
      gap.skill = String(value);
    } else if (field === 'gap_description') {
      gap.gap_description = String(value);
    }
    
    newGaps[index] = gap;
    setGaps(newGaps);
  };

  const handleSubmit = () => {
    if (!participantName.trim()) {
      Alert.alert('Kesalahan', 'Nama peserta wajib diisi');
      return;
    }
    const validGaps = gaps.filter(g => g.skill.trim() !== '');
    if (validGaps.length === 0) {
      Alert.alert('Kesalahan', 'Harap tambahkan setidaknya satu kesenjangan kompetensi');
      return;
    }
    personalize({ participantName: participantName.trim(), gaps: validGaps });
  };

  if (personalization) {
    return <PersonalizationResultView result={personalization} currentRevisionIndex={syllabus?.revision_history.length ?? 0} onBack={() => router.back()} />;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="max-w-4xl mx-auto w-full p-6">
        <View className="mb-8 flex-row items-center">
          <Button 
            variant="ghost" 
            onPress={() => router.back()} 
            className="mr-4 p-2"
            icon={<Ionicons name="arrow-back" size={24} color={colors.secondary} />}
          />
          <View>
            <Text className="text-2xl font-bold text-gray-900">Personalisasi Jalur Belajar</Text>
            <Text className="text-gray-500 mt-1">Identifikasi kesenjangan keterampilan Anda untuk mendapatkan modul pembelajaran yang disesuaikan</Text>
          </View>
        </View>

        <Card className="mb-6 border border-indigo-100 bg-indigo-50">
          <View className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <View className="flex-1">
              <Text className="font-semibold text-indigo-900">Butuh rekomendasi untuk banyak peserta?</Text>
              <Text className="mt-1 text-sm text-indigo-700">Gunakan bulk recommendation untuk upload/paste CSV peserta dan memproses beberapa gap sekaligus.</Text>
            </View>
            <Button
              title="Buka Bulk Recommendation"
              variant="outline"
              onPress={() => router.push(`/syllabus/${syllabusId}/bulk`)}
              icon={<Ionicons name="people-outline" size={18} color={colors.secondary} />}
            />
          </View>
        </Card>

        <View className="space-y-6">
          <Card className="border border-gray-200 bg-white shadow-sm rounded-xl">
            <View className="gap-2">
              <Text className="text-xs font-medium text-gray-500">Nama Peserta *</Text>
              <Text className="text-sm text-gray-500">Masukkan nama peserta agar rekomendasi dan riwayat personalisasi tersimpan jelas.</Text>
              <View className="rounded-lg border border-gray-300 bg-white px-3 py-1">
                <TextInput
                  className="py-2 text-gray-900"
                  placeholder="contoh: Aulia Rahman"
                  placeholderTextColor="#9CA3AF"
                  value={participantName}
                  onChangeText={setParticipantName}
                />
              </View>
            </View>
          </Card>

          {gaps.map((gap, index) => (
            <GapInputCard
              key={index}
              gap={gap}
              index={index}
              onUpdate={(field, value) => updateGap(index, field, value)}
              onRemove={() => removeGap(index)}
              canRemove={gaps.length > 1}
            />
          ))}

          <View className="flex-col md:flex-row gap-4 mt-6">
            <Button
              title="Tambah Kesenjangan"
              variant="outline"
              onPress={addGap}
              className="flex-1 border-dashed border-gray-300 py-3"
              icon={<Ionicons name="add" size={18} color={colors.primary} />}
            />
            <Button
              title="Analisis Kesenjangan & Buat"
              onPress={handleSubmit}
              isLoading={isPersonalizing}
              size="lg"
              className="flex-[2] py-3 shadow-md"
              icon={<Ionicons name="analytics" size={18} color="white" />}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function PersonalizationResultView({ result, currentRevisionIndex, onBack }: { result: PersonalizationResult, currentRevisionIndex: number, onBack: () => void }) {
  const grouped = groupRecommendations(result.recommendations);
  const isOutdated = result.revision_index !== currentRevisionIndex;
  
  const getPriorityText = (priority: string) => {
    if (priority === 'High') return 'Prioritas Tinggi';
    if (priority === 'Medium') return 'Prioritas Sedang';
    return 'Prioritas Rendah';
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
        <View className="max-w-5xl mx-auto w-full p-6">
          <View className="mb-8 flex-row items-center">
          <Button 
            variant="ghost" 
            onPress={onBack} 
            className="mr-4 p-2"
            icon={<Ionicons name="arrow-back" size={24} color={colors.secondary} />}
          />
          <View>
            <Text className="text-2xl font-bold text-gray-900">Rencana Personal Anda</Text>
            <Text className="text-gray-500 mt-1">Peserta: {result.participant_name || 'Tanpa nama peserta'}</Text>
          </View>
        </View>

        <Card className={`mb-6 ${isOutdated ? 'border border-amber-200 bg-amber-50' : 'border border-emerald-200 bg-emerald-50'}`}>
          <Text className={`font-semibold ${isOutdated ? 'text-amber-700' : 'text-emerald-700'}`}>
            {isOutdated ? 'Hasil personalisasi ini berasal dari revision lama' : 'Hasil personalisasi sudah sinkron dengan revision aktif'}
          </Text>
          <Text className={`mt-1 text-sm ${isOutdated ? 'text-amber-700' : 'text-emerald-700'}`}>
            Dibuat dari Version {result.revision_index + 1}. Revision aktif saat ini: Version {currentRevisionIndex + 1}.
          </Text>
        </Card>

        {Object.entries(grouped).map(([priority, items]) => (
          items.length > 0 && (
            <View key={priority} className="mb-8">
              <View className={`flex-row items-center mb-4 px-3 py-1.5 rounded-lg self-start
                ${priority === 'High' ? 'bg-red-50 border border-red-100' : 
                  priority === 'Medium' ? 'bg-yellow-50 border border-yellow-100' : 
                  'bg-blue-50 border border-blue-100'}`}>
                <View className={`w-2 h-2 rounded-full mr-2 
                  ${priority === 'High' ? 'bg-red-500' : priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                <Text className={`font-bold text-sm uppercase tracking-wide
                  ${priority === 'High' ? 'text-red-700' : priority === 'Medium' ? 'text-yellow-700' : 'text-blue-700'}`}>
                  {getPriorityText(priority)}
                </Text>
              </View>
              
              {/* Responsive Grid for cards */}
              <View className="flex-row flex-wrap -mx-2">
                {items.map((item, idx) => (
                  <View key={idx} className="w-full md:w-1/2 px-2">
                    <RecommendationCard recommendation={item} />
                  </View>
                ))}
              </View>
            </View>
          )
        ))}
      </View>
    </ScrollView>
  );
}
