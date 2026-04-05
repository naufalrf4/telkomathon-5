import { View, Image, Pressable, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { appQueryClient } from '../../queryClient';
import { useAuthStore } from '../../stores/authStore';

export function MobileTopBar() {
  const router = useRouter();
  const { clearSession } = useAuthStore();

  return (
    <View className="flex-row items-center justify-between border-b border-neutral-300 bg-surface px-5 py-3 shadow-sm">
      <View className="gap-1">
        <Image
          source={require('../../../assets/aispace-logo.png')}
          style={{ width: 124, height: 37 }}
          resizeMode="contain"
        />
        <Text className="text-xs text-neutral-600">Kurikulum dan personalisasi dalam satu alur.</Text>
      </View>
      <Pressable
        onPress={() => {
          appQueryClient.clear();
          clearSession();
          router.replace('/login');
        }}
        className="rounded-2xl border border-neutral-300 bg-neutral-50 px-3 py-2.5 active:bg-neutral-100 min-h-[44px] justify-center"
      >
        <Text className="text-xs font-semibold text-neutral-700">Keluar</Text>
      </Pressable>
    </View>
  );
}
