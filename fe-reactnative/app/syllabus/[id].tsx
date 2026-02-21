import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { ELOAccordion } from '../../src/features/ELOAccordion';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

export default function SyllabusDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { syllabus, isLoading } = useSyllabus(id as string);

  if (isLoading || !syllabus) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView className="flex-1">
      <View className="mb-6 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Button 
            title="Back" 
            variant="outline" 
            size="sm" 
            onPress={() => router.back()} 
            icon={<Ionicons name="arrow-back" size={16} color="black" />}
            className="mr-4"
          />
          <Text className="text-2xl font-bold text-gray-900">{syllabus.topic}</Text>
        </View>
        <View className="flex-row space-x-2">
          <Button 
            title="Chat/Revise" 
            size="sm"
            variant="secondary"
            icon={<Ionicons name="chatbubbles-outline" size={16} color="white" />}
            onPress={() => router.push(`/chat/${id}`)}
          />
          <Button 
            title="Personalize" 
            size="sm"
            variant="primary"
            icon={<Ionicons name="options-outline" size={16} color="white" />}
            onPress={() => router.push(`/personalize/${id}`)}
          />
          <Button 
            title="Export" 
            size="sm"
            variant="outline"
            icon={<Ionicons name="download-outline" size={16} color="black" />}
            onPress={() => router.push(`/export/${id}`)}
          />
        </View>
      </View>

      <Card className="mb-6 bg-blue-50 border-blue-100">
        <Text className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Terminal Learning Objective (TLO)</Text>
        <Text className="text-lg font-medium text-gray-900 leading-7">{syllabus.tlo}</Text>
      </Card>

      <View className="flex-row mb-6 space-x-4">
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900 mb-3">Enabling Learning Objectives (ELOs)</Text>
          <ELOAccordion elos={syllabus.elos} />
        </View>
      </View>

      <Text className="text-lg font-bold text-gray-900 mb-3">Learning Journey</Text>
      <View className="flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4 mb-8">
        <JourneyCard title="Pre-Learning" items={syllabus.journey.pre_learning} color="bg-indigo-50" />
        <JourneyCard title="Classroom" items={syllabus.journey.classroom} color="bg-emerald-50" />
        <JourneyCard title="After-Learning" items={syllabus.journey.after_learning} color="bg-amber-50" />
      </View>
    </ScrollView>
  );
}

function JourneyCard({ title, items, color }: { title: string, items: string[], color: string }) {
  return (
    <View className={`flex-1 p-4 rounded-xl border border-gray-200 ${color}`}>
      <Text className="font-bold text-gray-900 mb-3 text-center uppercase tracking-wide text-xs">{title}</Text>
      <View className="space-y-2">
        {items.map((item, idx) => (
          <View key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex-row">
            <Text className="text-gray-500 font-bold mr-2 text-xs">{idx + 1}.</Text>
            <Text className="text-gray-800 text-sm flex-1">{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
