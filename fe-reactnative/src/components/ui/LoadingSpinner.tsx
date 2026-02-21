import { View, ActivityIndicator, Text } from 'react-native';
import { colors } from '../../theme/colors';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
}

export function LoadingSpinner({ fullScreen = false, message }: LoadingSpinnerProps) {
  if (fullScreen) {
    return (
      <View className="flex-1 justify-center items-center bg-white/80 absolute inset-0 z-50">
        <ActivityIndicator size="large" color={colors.primary} />
        {message && <Text className="mt-4 text-gray-600 font-medium">{message}</Text>}
      </View>
    );
  }
  return (
    <View className="p-4 items-center">
      <ActivityIndicator size="small" color={colors.primary} />
      {message && <Text className="mt-2 text-xs text-gray-500">{message}</Text>}
    </View>
  );
}
