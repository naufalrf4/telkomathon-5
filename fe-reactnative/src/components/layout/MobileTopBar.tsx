import { View, Image, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export function MobileTopBar() {
  const router = useRouter();
  const { clearSession } = useAuthStore();

  return (
    <View className="bg-white border-b border-gray-200/70 shadow-sm px-6 py-3 flex-row items-center justify-between">
      <Image
        source={require('../../../assets/aispace-logo.png')}
        style={{ width: 124, height: 37 }}
        resizeMode="contain"
      />
      <Pressable onPress={() => { clearSession(); router.replace('/login'); }} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        <Text className="text-xs font-semibold text-gray-600">Logout</Text>
      </Pressable>
    </View>
  );
}
