import { View, Text } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { LearningRecommendation } from '../../types/api';
import { colors } from '../../theme/colors';

interface RecommendationCardProps {
  recommendation: LearningRecommendation;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
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

  return (
    <Card className="mb-4 bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <View className="flex-row justify-between items-start mb-2">
        <Badge 
          label={recommendation.type} 
          variant="outline" 
          className="bg-gray-50 text-gray-700 border-gray-200"
        />
        <Text className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
          ~{recommendation.estimated_duration_minutes} menit
        </Text>
      </View>
      
      <Text className="text-lg font-bold text-gray-900 mb-2 leading-tight">
        {recommendation.title}
      </Text>
      
      <Text className="text-sm text-gray-600 leading-relaxed mb-3">
        {recommendation.description}
      </Text>
      
      <View className="flex-row items-center mt-2 pt-3 border-t border-gray-50">
        <View className={`w-2 h-2 rounded-full mr-2 bg-${
          recommendation.priority === 'High' ? 'red-500' : 
          recommendation.priority === 'Medium' ? 'yellow-500' : 'blue-500'
        }`} />
        <Text className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {getPriorityText(recommendation.priority)}
        </Text>
      </View>
    </Card>
  );
}
