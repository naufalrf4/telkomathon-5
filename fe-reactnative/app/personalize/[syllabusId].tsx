import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { CompetencyGap, LearningRecommendation } from '../../src/types/api';

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
    setGaps(gaps.filter((_, i) => i !== index));
  };

  const updateGap = (index: number, field: keyof CompetencyGap, value: any) => {
    const newGaps = [...gaps];
    newGaps[index] = { ...newGaps[index], [field]: value };
    setGaps(newGaps);
  };

  const handleSubmit = () => {
    const validGaps = gaps.filter(g => g.skill.trim() !== '');
    if (validGaps.length === 0) {
      Alert.alert('Error', 'Please add at least one competency gap');
      return;
    }
    personalize(validGaps);
  };

  if (personalization) {
    return <PersonalizationResultView result={personalization} onBack={() => router.back()} />;
  }

  return (
    <ScrollView className="flex-1">
      <View className="mb-6 flex-row items-center">
        <Button title="Back" variant="outline" size="sm" onPress={() => router.back()} icon={<Ionicons name="arrow-back" size={16} />} className="mr-4" />
        <Text className="text-2xl font-bold text-gray-900">Personalize Learning</Text>
      </View>

      <Text className="mb-4 text-gray-600">Identify competency gaps to get personalized learning recommendations.</Text>

      {gaps.map((gap, index) => (
        <Card key={index} className="mb-4 bg-white border border-gray-200">
          <View className="flex-row justify-between mb-2">
            <Text className="font-bold text-gray-700">Gap #{index + 1}</Text>
            {gaps.length > 1 && (
              <TouchableOpacity onPress={() => removeGap(index)}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
          
          <Text className="text-xs text-gray-500 mb-1">Skill Name</Text>
          <TextInput 
            className="border border-gray-300 rounded p-2 mb-3 bg-white" 
            placeholder="e.g. Python Programming"
            value={gap.skill}
            onChangeText={(t) => updateGap(index, 'skill', t)}
          />

          <View className="flex-row space-x-4 mb-3">
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-1">Current Level (1-5)</Text>
              <TextInput 
                className="border border-gray-300 rounded p-2 bg-white" 
                keyboardType="numeric"
                value={String(gap.current_level)}
                onChangeText={(t) => updateGap(index, 'current_level', parseInt(t) || 1)}
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-1">Required Level (1-5)</Text>
              <TextInput 
                className="border border-gray-300 rounded p-2 bg-white" 
                keyboardType="numeric"
                value={String(gap.required_level)}
                onChangeText={(t) => updateGap(index, 'required_level', parseInt(t) || 1)}
              />
            </View>
          </View>

          <Text className="text-xs text-gray-500 mb-1">Description (Optional)</Text>
          <TextInput 
            className="border border-gray-300 rounded p-2 bg-white h-16" 
            multiline
            placeholder="Describe the gap..."
            textAlignVertical="top"
            value={gap.gap_description}
            onChangeText={(t) => updateGap(index, 'gap_description', t)}
          />
        </Card>
      ))}

      <Button title="Add Another Gap" variant="outline" onPress={addGap} className="mb-6 border-dashed" icon={<Ionicons name="add" size={18} />} />
      <Button title="Generate Recommendations" onPress={handleSubmit} isLoading={isPersonalizing} size="lg" className="mb-10" />
    </ScrollView>
  );
}

function PersonalizationResultView({ result, onBack }: { result: any, onBack: () => void }) {
  const grouped = {
    High: result.recommendations.filter((r: any) => r.priority === 1),
    Medium: result.recommendations.filter((r: any) => r.priority === 2),
    Low: result.recommendations.filter((r: any) => r.priority === 3),
  };

  return (
    <ScrollView className="flex-1">
      <View className="mb-6 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Button title="Back" variant="outline" size="sm" onPress={onBack} icon={<Ionicons name="arrow-back" size={16} />} className="mr-4" />
          <Text className="text-2xl font-bold text-gray-900">Recommendations</Text>
        </View>
      </View>

      {Object.entries(grouped).map(([priority, items]: [string, any[]]) => (
        items.length > 0 && (
          <View key={priority} className="mb-6">
            <Text className={`text-lg font-bold mb-3 ${
              priority === 'High' ? 'text-red-600' : priority === 'Medium' ? 'text-yellow-600' : 'text-blue-600'
            }`}>{priority} Priority</Text>
            {items.map((item, idx) => (
              <Card key={idx} className="mb-3 border-l-4" style={{ borderLeftColor: priority === 'High' ? colors.primary : priority === 'Medium' ? colors.warning : colors.info }}>
                <View className="flex-row justify-between mb-1">
                  <Badge label={item.type} size="sm" variant="secondary" />
                  <Text className="text-xs text-gray-500">{item.estimated_duration_minutes} min</Text>
                </View>
                <Text className="font-bold text-gray-900 text-lg mb-1">{item.title}</Text>
                <Text className="text-gray-600 leading-5">{item.description}</Text>
              </Card>
            ))}
          </View>
        )
      ))}
    </ScrollView>
  );
}
