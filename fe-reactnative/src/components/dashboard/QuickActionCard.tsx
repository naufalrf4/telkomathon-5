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
      className="flex-1 min-w-[220px] rounded-xl border border-neutral-300 bg-surface p-5 shadow-xs hover:bg-neutral-50 active:bg-neutral-100 active:scale-[0.98]"
    >
      <View className="mb-4 flex-row items-start justify-between gap-3">
        <View className="rounded-lg bg-neutral-100 p-3">
          <Ionicons name={iconName} size={22} color={color} />
        </View>
        <Ionicons name="arrow-forward" size={18} color={colors.textMuted ?? '#94A3B8'} />
      </View>
      <Text className="text-lg font-semibold text-neutral-950">{title}</Text>
      <Text className="mt-2 text-sm leading-6 text-neutral-600">{description}</Text>
    </Pressable>
  );
}
