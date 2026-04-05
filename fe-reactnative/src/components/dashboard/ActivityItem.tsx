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

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-xl border border-transparent px-3 py-4 hover:bg-neutral-50 active:bg-neutral-100"
    >
      <View className="mr-4 rounded-lg bg-neutral-100 p-3">
        <Ionicons name={iconName} size={20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-neutral-950" numberOfLines={1}>{title}</Text>
        <Text className="mt-1 text-sm text-neutral-600" numberOfLines={1}>{subtitle}</Text>
      </View>
      <Text className="text-xs font-medium text-neutral-600">{date}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted ?? '#94A3B8'} className="ml-2" />
    </Pressable>
  );
}
