import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface QuickActionCardProps {
  title: string;
  description: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}

export function QuickActionCard({ title, description, iconName, onPress, color = colors.primary }: QuickActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1 min-w-[200px] mb-3 md:mb-0 md:mr-3 active:scale-[0.98] transition-transform"
    >
      <View className="flex-row items-center mb-3">
        <View className="p-2 rounded-full mr-3" style={{ backgroundColor: `${color}15` }}>
          <Ionicons name={iconName} size={24} color={color} />
        </View>
        <Text className="text-lg font-bold text-gray-900">{title}</Text>
      </View>
      <Text className="text-sm text-gray-500 leading-relaxed">{description}</Text>
    </Pressable>
  );
}
