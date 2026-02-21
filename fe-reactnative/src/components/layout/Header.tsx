import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export function Header() {
  return (
    <View className="bg-white border-b border-gray-200 px-6 py-4 flex-row justify-between items-center shadow-sm">
      <View>
        <Text className="text-xl font-bold text-gray-900">Dashboard</Text>
      </View>
      <View className="flex-row items-center space-x-4">
        <TouchableOpacity className="p-2">
          <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
          <Text className="text-white font-bold">U</Text>
        </View>
      </View>
    </View>
  );
}
