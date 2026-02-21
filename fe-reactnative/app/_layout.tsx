import { View, useWindowDimensions } from 'react-native';
import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Header } from '../src/components/layout/Header';
import { BottomNav } from '../src/components/layout/BottomNav';
import { MobileTopBar } from '../src/components/layout/MobileTopBar';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <View className={`flex-1 ${isDesktop ? 'flex-row' : 'flex-col'} bg-gray-50`}>
          {isDesktop && <Sidebar />}
          <View className="flex-1 flex-col relative">
            {isDesktop && <Header />}
            {!isDesktop && <MobileTopBar />}
            <View className="flex-1 overflow-y-auto">
              <View className={`w-full max-w-7xl mx-auto ${isDesktop ? 'p-6' : 'p-4 pb-24'}`}>
                <Slot />
              </View>
            </View>
            {!isDesktop && <BottomNav />}
          </View>
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
