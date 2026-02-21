import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface ActivityItemProps {
  title: string;
  subtitle: string;
  date: string;
  type: 'document' | 'syllabus';
  onPress: () => void;
}

export function ActivityItem({ title, subtitle, date, type, onPress }: ActivityItemProps) {
  const iconName = type === 'document' ? 'document-text-outline' : 'school-outline';
  const iconColor = type === 'document' ? colors.info : colors.primary;
  const bg = type === 'document' ? 'bg-blue-50' : 'bg-red-50';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 border-b border-gray-100 active:bg-gray-50 px-2 rounded-lg"
    >
      <View className={`p-3 rounded-lg mr-4 ${bg}`}>
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-gray-900 text-base" numberOfLines={1}>{title}</Text>
        <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text className="text-xs text-gray-400 font-medium">{date}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} className="ml-2" />
    </Pressable>
  );
}
