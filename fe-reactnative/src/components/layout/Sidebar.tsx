import { View, Text, Pressable } from 'react-native';
import { Link, usePathname } from 'expo-router';
import clsx from 'clsx';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const MENU_ITEMS = [
  { href: '/documents', label: 'Documents', icon: 'document-text-outline' },
  { href: '/syllabus', label: 'Syllabi', icon: 'school-outline' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <View className="flex-1 bg-white border-r border-gray-200 h-full w-[250px] flex-col justify-between py-6">
      <View>
        <View className="px-6 mb-8 flex-row items-center">
           <View className="w-10 h-10 bg-primary rounded-lg mr-3 items-center justify-center shadow-sm">
             <Text className="text-white font-bold text-xl">T</Text>
           </View>
           <View>
             <Text className="text-gray-900 font-bold text-lg">MyDigiLearn</Text>
             <Text className="text-primary text-[10px] uppercase tracking-wider font-semibold">AI Powered</Text>
           </View>
        </View>

        <View className="px-3 space-y-1">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href as any} asChild>
                <Pressable className={clsx(
                  "flex-row items-center px-4 py-3 rounded-lg mb-1 transition-colors",
                  isActive ? "bg-primary/5 border-r-2 border-primary" : "hover:bg-gray-50"
                )}>
                  <Ionicons 
                    name={item.icon as any} 
                    size={20} 
                    color={isActive ? colors.primary : '#6B7280'} 
                    style={{ marginRight: 12 }}
                  />
                  <Text className={clsx(
                    "font-medium text-sm",
                    isActive ? "text-primary font-semibold" : "text-gray-500"
                  )}>
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>

      <View className="px-6 border-t border-gray-100 pt-6">
        <Text className="text-gray-400 text-xs">Powered by</Text>
        <Text className="text-gray-600 font-bold text-xs mt-1">AI Space Telkom Indonesia</Text>
      </View>
    </View>
  );
}
