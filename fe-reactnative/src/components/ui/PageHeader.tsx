import { View, Text } from 'react-native';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  aside?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, aside }: PageHeaderProps) {
  return (
    <View className="rounded-2xl border border-primary-100 bg-surface px-6 py-6 shadow-sm">
      <View className="flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <View className="flex-1 gap-2">
          {eyebrow ? <Text className="text-xs font-semibold uppercase tracking-[0.28em] text-primary-600">{eyebrow}</Text> : null}
          <Text className="text-3xl font-semibold leading-tight text-neutral-950">{title}</Text>
          {description ? <Text className="max-w-3xl text-sm leading-6 text-neutral-600">{description}</Text> : null}
        </View>
        {aside ? <View className="rounded-3xl bg-primary-50 px-4 py-3">{aside}</View> : null}
      </View>
      {actions ? <View className="mt-5 flex-row flex-wrap gap-3">{actions}</View> : null}
    </View>
  );
}
