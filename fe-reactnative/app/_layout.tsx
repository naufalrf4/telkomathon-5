import { View, useWindowDimensions, SafeAreaView } from 'react-native';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Header } from '../src/components/layout/Header';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <View className="flex-1 flex-row bg-gray-50 h-full">
          {isDesktop && <Sidebar />}
          <View className="flex-1 flex-col h-full">
            {isDesktop && <Header />}
            <View className="flex-1 p-6 h-full w-full max-w-7xl mx-auto">
              <Slot />
            </View>
          </View>
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
