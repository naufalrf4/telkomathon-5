import { View, Text, Pressable, Image } from 'react-native';
import { Link, usePathname, type Href } from 'expo-router';
import clsx from 'clsx';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { useAuthStore } from '../../stores/authStore';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  href: Href;
  label: string;
  icon: IoniconsName;
  matchExact?: boolean;
  children?: Array<{
    href: Href;
    label: string;
  }>;
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/', label: 'Dashboard', icon: 'grid-outline', matchExact: true },
  {
    href: '/syllabus',
      label: 'Syllabus',
      icon: 'library-outline',
      children: [
        { href: '/syllabus/create', label: 'Create' },
        { href: '/syllabus/generated', label: 'Generated' },
        { href: '/syllabus/roadmap', label: 'Roadmap' },
        { href: '/syllabus/history', label: 'History' },
      ],
    },
];

function isMenuActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href || pathname === '';
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearSession } = useAuthStore();

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  return (
    <View className="w-64 bg-white border-r border-gray-200 h-full flex-col justify-between py-6 shadow-sm">
      <View>
        <View className="mx-4 mb-8 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
          <View className="flex-row items-center gap-3">
            <Image
              source={require('../../../assets/aispace-logo.png')}
              style={{ width: 124, height: 37 }}
              resizeMode="contain"
            />
          </View>
          <Text className="mt-3 text-xs uppercase tracking-[0.25em] text-gray-400">PRIMA Workspace</Text>
          <Text className="mt-1 text-sm text-gray-500">Create, revise, roadmap, personalize, and export in one owner-scoped shell.</Text>
        </View>

        <View className="px-3">
          {MENU_ITEMS.map((item) => {
            const active = isMenuActive(pathname, String(item.href), item.matchExact);
            return (
              <View key={String(item.href)}>
                <Link href={item.href} asChild>
                  <Pressable
                    className={clsx(
                      'flex-row items-center px-3 py-2.5 rounded-lg mb-0.5',
                      active ? 'bg-red-50' : ''
                    )}
                  >
                    <Ionicons
                      name={active ? (item.icon.replace('-outline', '') as IoniconsName) : item.icon}
                      size={18}
                      color={active ? colors.primary : '#9CA3AF'}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      className={clsx(
                        'text-sm',
                        active ? 'text-primary font-semibold' : 'text-gray-500 font-medium'
                      )}
                    >
                      {item.label}
                    </Text>
                    {active && (
                      <View className="ml-auto w-1 h-5 bg-primary rounded-full" />
                    )}
                  </Pressable>
                </Link>

                {active && item.children?.length ? (
                  <View className="mb-3 ml-6 mt-1 gap-1 border-l border-red-100 pl-4">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(`${String(child.href)}/`);
                      return (
                        <Link key={String(child.href)} href={child.href} asChild>
                          <Pressable className="rounded-md px-2 py-2">
                            <Text className={clsx('text-sm', childActive ? 'font-semibold text-primary' : 'text-gray-500')}>
                              {child.label}
                            </Text>
                          </Pressable>
                        </Link>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

        <View className="mx-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 gap-3">
          <View className="gap-1">
            <Text className="text-gray-400 text-[10px]">Masuk sebagai</Text>
            <Text className="text-gray-700 font-semibold text-xs mt-0.5">{user?.full_name ?? user?.email ?? 'Akun aktif'}</Text>
          </View>
          <Pressable onPress={handleLogout} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <Text className="text-xs font-semibold text-gray-600">Logout</Text>
          </Pressable>
        </View>
      </View>
  );
}
