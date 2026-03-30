import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Redirect, Slot, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { Sidebar } from '../src/components/layout/Sidebar';
import { Header } from '../src/components/layout/Header';
import { BottomNav } from '../src/components/layout/BottomNav';
import { MobileTopBar } from '../src/components/layout/MobileTopBar';
import { getMe } from '../src/services/auth';
import { useAuthStore } from '../src/stores/authStore';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const pathname = usePathname();
  const { accessToken, hydrated, hydrate, clearSession, setSession } = useAuthStore();

  useEffect(() => {
    if (!hydrated) {
      hydrate();
    }
  }, [hydrate, hydrated]);

  useEffect(() => {
    if (!hydrated || !accessToken) {
      return;
    }

    let cancelled = false;

    void getMe()
      .then((user) => {
        if (!cancelled) {
          setSession({ accessToken, user });
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, clearSession, hydrated, setSession]);

  const isAuthRoute = pathname === '/login' || pathname === '/register';

  if (!hydrated) {
    return null;
  }

  if (!accessToken && !isAuthRoute) {
    return <Redirect href="/login" />;
  }

  if (accessToken && isAuthRoute) {
    return <Redirect href="/" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <View className={`flex-1 ${isDesktop ? 'flex-row' : 'flex-col'} ${isAuthRoute ? 'bg-white' : 'bg-gray-50'}`}>
          {isDesktop && !isAuthRoute ? <Sidebar /> : null}
          <View className="flex-1 flex-col relative">
            {isDesktop && !isAuthRoute ? <Header /> : null}
            {!isDesktop && !isAuthRoute ? <MobileTopBar /> : null}
            <View className="flex-1 overflow-y-auto">
              <View className={`w-full max-w-7xl mx-auto ${isDesktop ? 'p-6' : 'p-4 pb-24'} ${isAuthRoute ? 'min-h-screen flex-1 justify-center' : ''}`}>
                <Slot />
              </View>
            </View>
            {!isDesktop && !isAuthRoute ? <BottomNav /> : null}
          </View>
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
