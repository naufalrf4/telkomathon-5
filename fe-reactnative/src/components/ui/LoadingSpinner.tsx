import { View, ActivityIndicator, Text } from 'react-native';
import { colors } from '../../theme/colors';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
}

export function LoadingSpinner({ fullScreen = false, message }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <View className="absolute inset-0 z-50 flex-1 items-center justify-center bg-surface/90">
        <ActivityIndicator size="large" color={colors.primary} />
        {message && <Text className="mt-4 text-sm font-medium text-neutral-600">{message}</Text>}
      </View>
    );
  }
  return (
    <View className="items-center p-4">
      <ActivityIndicator size="small" color={colors.primary} />
      {message && <Text className="mt-2 text-xs font-medium text-neutral-600">{message}</Text>}
    </View>
  );
}
