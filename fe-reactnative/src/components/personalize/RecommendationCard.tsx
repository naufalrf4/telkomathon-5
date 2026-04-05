import { View, Text } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LearningRecommendation } from '../../types/api';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface RecommendationCardProps {
  recommendation: LearningRecommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const getPriorityLabel = (priority: number | string) => {
    if (priority === 1 || priority === 'High') {
      return 'High';
    }

    if (priority === 2 || priority === 'Medium') {
      return 'Medium';
    }

    return 'Low';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return colors.error;
      case 'Medium': return colors.warning;
      case 'Low': return colors.info;
      default: return colors.primary;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'High': return 'Prioritas Tinggi';
      case 'Medium': return 'Prioritas Sedang';
      case 'Low': return 'Prioritas Rendah';
      default: return 'Prioritas';
    }
  };

  const priorityLabel = getPriorityLabel(recommendation.priority);

  return (
    <Card className="mb-4 border border-neutral-300 bg-surface shadow-sm">
      <View className="mb-3 flex-row items-start justify-between gap-3">
        <Badge 
          label={recommendation.type} 
          variant="default" 
          className="bg-neutral-100 border-neutral-300"
        />
        <View className="rounded-full bg-primary-50 px-3 py-1 flex-row items-center gap-1.5">
          <Ionicons name="time-outline" size={12} color={colors.primary} />
          <Text className="text-xs font-semibold text-primary">~{recommendation.estimated_duration_minutes} menit</Text>
        </View>
      </View>
      
      <Text className="mb-2 text-lg font-semibold leading-tight text-neutral-950">
        {recommendation.title}
      </Text>
      
      <Text className="mb-4 text-sm leading-6 text-neutral-700">
        {recommendation.description}
      </Text>
      
      <View className="mt-2 flex-row items-center justify-between border-t border-neutral-100 pt-3">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: getPriorityColor(priorityLabel) }} />
          <Text className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
            {getPriorityText(priorityLabel)}
          </Text>
        </View>
        <Text className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
          Rekomendasi belajar
        </Text>
      </View>
    </Card>
  );
}
