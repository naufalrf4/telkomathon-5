import { View, Text, Pressable, Image } from 'react-native';
import { Link, usePathname, type Href } from 'expo-router';
import clsx from 'clsx';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { colors } from '../../theme/colors';

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
    ],
  },
];

function isMenuActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href || pathname === '';
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <View className="w-60 bg-white border-r border-gray-200 h-full flex-col justify-between py-6">
      <View>
        <View className="px-5 mb-8">
          <Image
            source={require('../../../assets/aispace-logo.png')}
            style={{ width: 124, height: 37 }}
            resizeMode="contain"
          />
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

      <View className="px-5 border-t border-gray-100 pt-4">
        <Text className="text-gray-400 text-[10px]">Powered by</Text>
        <Text className="text-gray-500 font-semibold text-[10px] mt-0.5">
          PRIMA — Personalized Responsive Intelligent Micro-Learning Assistant
        </Text>
      </View>
    </View>
  );
}
