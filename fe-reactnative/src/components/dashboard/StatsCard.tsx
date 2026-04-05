import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface StatsCardProps {
  title: string;
  value: string | number;
  iconName: keyof typeof Ionicons.glyphMap;
  color?: string;
  trend?: string;
}

export function StatsCard({ title, value, iconName, color = colors.primary, trend }: StatsCardProps) {
  return (
    <View className="min-w-[150px] flex-1 rounded-xl border border-neutral-300 bg-surface p-5 shadow-sm">
      <View className="mb-3 flex-row items-start justify-between">
        <View className="rounded-lg bg-neutral-100 p-3">
          <Ionicons name={iconName} size={20} color={color} />
        </View>
        {trend && (
          <Text className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            {trend}
          </Text>
        )}
      </View>
      <Text className="mb-1 text-3xl font-bold text-neutral-950">{value}</Text>
      <Text className="text-sm font-medium text-neutral-600">{title}</Text>
    </View>
  );
}
