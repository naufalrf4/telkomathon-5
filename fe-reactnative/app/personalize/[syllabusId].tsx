import { View, Text, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
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
  const { personalize, isPersonalizing, personalization } = useSyllabus(syllabusId as string);

  const [gaps, setGaps] = useState<CompetencyGap[]>([
    { skill: '', current_level: 1, required_level: 3, gap_description: '' }
  ]);

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
    const validGaps = gaps.filter(g => g.skill.trim() !== '');
    if (validGaps.length === 0) {
      Alert.alert('Kesalahan', 'Harap tambahkan setidaknya satu kesenjangan kompetensi');
      return;
    }
    personalize(validGaps);
  };

  if (personalization) {
    return <PersonalizationResultView result={personalization} onBack={() => router.back()} />;
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

        <View className="space-y-6">
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

function PersonalizationResultView({ result, onBack }: { result: PersonalizationResult, onBack: () => void }) {
  const grouped = groupRecommendations(result.recommendations);
  
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
            <Text className="text-gray-500 mt-1">Berdasarkan analisis kesenjangan Anda</Text>
          </View>
        </View>

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
