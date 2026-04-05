import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from './Button';

type AlertVariant = 'error' | 'warning' | 'info' | 'success';

interface AlertBannerProps {
  variant?: AlertVariant;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  children?: ReactNode;
}

const VARIANT_STYLES: Record<AlertVariant, { icon: ComponentProps<typeof Ionicons>['name']; box: string; text: string; body: string }> = {
  error: { icon: 'alert-circle', box: 'border-red-200 bg-red-50', text: 'text-red-700', body: 'text-red-700' },
  warning: { icon: 'warning', box: 'border-amber-200 bg-amber-50', text: 'text-amber-700', body: 'text-amber-700' },
  info: { icon: 'information-circle', box: 'border-blue-200 bg-blue-50', text: 'text-blue-700', body: 'text-blue-700' },
  success: { icon: 'checkmark-circle', box: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', body: 'text-emerald-700' },
};

export function AlertBanner({ variant = 'info', title, description, action, children }: AlertBannerProps) {
  const style = VARIANT_STYLES[variant];

  return (
    <View className={`rounded-xl border p-4 ${style.box}`}>
      <View className="flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <View className="flex-1 flex-row gap-3">
          <Ionicons name={style.icon} size={20} className={style.text} />
          <View className="flex-1 gap-1">
            <Text className={`font-semibold ${style.text}`}>{title}</Text>
            {description ? <Text className={`text-sm leading-6 ${style.body}`}>{description}</Text> : null}
            {children}
          </View>
        </View>
        {action ? <Button title={action.label} variant="outline" onPress={action.onPress} /> : null}
      </View>
    </View>
  );
}
