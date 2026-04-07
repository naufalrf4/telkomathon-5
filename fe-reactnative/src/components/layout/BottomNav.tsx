import { View, Text, Pressable } from 'react-native';
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
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/', label: 'Dashboard', icon: 'grid-outline', matchExact: true },
  { href: '/syllabus/create', label: 'Create', icon: 'add-circle-outline' },
  { href: '/syllabus/generated', label: 'Kurikulum', icon: 'library-outline' },
  { href: '/personalize', label: 'Personalisasi', icon: 'sparkles-outline' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <View className="fixed bottom-0 left-0 right-0 z-50 flex-row border-t border-neutral-300 bg-surface pb-safe shadow-xs">
      {MENU_ITEMS.map((item) => {
        const isActive = item.matchExact
          ? pathname === item.href
          : pathname.startsWith(item.href as string);

        const iconName = isActive
          ? (item.icon.replace('-outline', '') as IoniconsName)
          : item.icon;

        return (
          <Link key={item.href as string} href={item.href} asChild>
            <Pressable className="flex-1 items-center justify-center py-3 gap-1 active:bg-neutral-50 min-h-[44px]">
              <Ionicons
                name={iconName}
                size={24}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text
                className={clsx(
                  'text-xs font-medium',
                  isActive ? 'text-primary-600' : 'text-neutral-500'
                )}
              >
                {item.label}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
