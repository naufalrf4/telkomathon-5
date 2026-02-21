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
    <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1 min-w-[150px] mx-1">
      <View className="flex-row justify-between items-start mb-2">
        <View className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Ionicons name={iconName} size={20} color={color} />
        </View>
        {trend && (
          <Text className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            {trend}
          </Text>
        )}
      </View>
      <Text className="text-2xl font-bold text-gray-900 mb-1">{value}</Text>
      <Text className="text-sm text-gray-500 font-medium">{title}</Text>
    </View>
  );
}
