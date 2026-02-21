import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

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
    <View className="flex-1 justify-center items-center p-8 min-h-[300px]">
      <View className="bg-gray-100 p-6 rounded-full mb-4">
        <Ionicons name={icon} size={48} color="#9CA3AF" />
      </View>
      <Text className="text-xl font-bold text-gray-900 mb-2 text-center">{title}</Text>
      <Text className="text-gray-500 text-center mb-6 max-w-xs">{description}</Text>
      {action && (
        <Button 
          title={action.label} 
          onPress={action.onPress} 
          variant="primary"
          icon={<Ionicons name="add" size={18} color="white" />}
        />
      )}
    </View>
  );
}
