import { Pressable, Text, View } from 'react-native';
import clsx from 'clsx';

interface SectionTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
}

export function SectionTabs<T extends string>({ value, onChange, items }: SectionTabsProps<T>) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            className={clsx(
              'rounded-full border px-4 py-2',
              isActive ? 'border-primary bg-primary-50' : 'border-neutral-200 bg-surface'
            )}
          >
            <Text className={clsx('text-sm font-semibold', isActive ? 'text-primary' : 'text-neutral-700')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
