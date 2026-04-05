import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors } from '../../theme/colors';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ title, description, icon = 'file-tray-outline', action }: EmptyStateProps) {
  return (
    <View className="min-h-[300px] items-center justify-center p-8">
      <View className="mb-5 rounded-xl bg-primary-50 p-5">
        <Ionicons name={icon} size={40} color={colors.primary} />
      </View>
      <Text className="mb-2 text-center text-2xl font-semibold text-neutral-950">{title}</Text>
      <Text className="mb-6 max-w-md text-center text-sm leading-6 text-neutral-600">{description}</Text>
      {action && (
        <Button 
          title={action.label} 
          onPress={action.onPress} 
          variant="primary"
        />
      )}
    </View>
  );
}
