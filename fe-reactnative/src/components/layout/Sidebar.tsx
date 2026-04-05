import { View, Text, Pressable, Image } from 'react-native';
import { Link, usePathname, type Href } from 'expo-router';
import clsx from 'clsx';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import { colors } from '../../theme/colors';
import { appQueryClient } from '../../queryClient';
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
      { href: '/syllabus/generated', label: 'Library' },
    ],
  },
  {
    href: '/personalize',
    label: 'Personalisasi',
    icon: 'sparkles-outline',
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
    appQueryClient.clear();
    clearSession();
    router.replace('/login');
  };

  return (
    <View className="h-full w-72 flex-col justify-between border-r border-neutral-300 bg-surface py-6 shadow-sm">
      <View>
        <View className="mx-4 mb-8 px-4 py-5">
          <View className="flex-row items-center gap-3">
            <Image
              source={require('../../../assets/aispace-logo.png')}
              style={{ width: 124, height: 37 }}
              resizeMode="contain"
            />
          </View>
          <Text className="mt-3 text-sm leading-6 text-neutral-600">Susun kurikulum, lanjutkan draf aktif, lalu buat rekomendasi belajar dari satu alur kerja.</Text>
        </View>

        <View className="px-3">
          {MENU_ITEMS.map((item) => {
            const active = isMenuActive(pathname, String(item.href), item.matchExact);
            return (
              <View key={String(item.href)}>
                <Link href={item.href} asChild>
                  <Pressable
                    className={clsx(
                      'flex-row items-center px-3 py-2.5 rounded-lg mb-0.5 border-l-2',
                       active ? 'bg-primary-50 border-primary-600' : 'bg-transparent border-transparent hover:bg-neutral-100'
                    )}
                  >
                    <Ionicons
                      name={active ? (item.icon.replace('-outline', '') as IoniconsName) : item.icon}
                      size={18}
                      color={active ? colors.primary : colors.textMuted}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      className={clsx(
                        'text-sm',
                         active ? 'font-semibold text-primary-700' : 'font-medium text-neutral-600 hover:text-neutral-700'
                      )}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                </Link>

                {active && item.children?.length ? (
                  <View className="mb-3 ml-6 mt-1 gap-1 border-l border-neutral-300 pl-4">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href || pathname.startsWith(`${String(child.href)}/`);
                      return (
                        <Link key={String(child.href)} href={child.href} asChild>
                          <Pressable className={clsx('rounded-md px-2 py-2', childActive ? 'bg-primary-50' : 'hover:bg-neutral-100')}>
                            <Text className={clsx('text-sm', childActive ? 'font-semibold text-primary-700' : 'font-medium text-neutral-600 hover:text-neutral-700')}>
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

      <View className="mx-4 gap-3 rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
        <View className="gap-1">
          <Text className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Akun aktif</Text>
          <Text className="mt-0.5 text-xs font-semibold text-neutral-950">{user?.full_name ?? user?.email ?? 'Akun aktif'}</Text>
        </View>
        <Pressable onPress={handleLogout} className="rounded-lg border border-neutral-300 bg-surface px-3 py-3 hover:bg-neutral-100 group">
          <Text className="text-xs font-semibold text-neutral-600 group-hover:text-primary-600">Keluar</Text>
        </Pressable>
      </View>
    </View>
  );
}
