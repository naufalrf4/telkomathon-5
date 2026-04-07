import { View, Text, Image } from 'react-native';
import type { ReactNode } from 'react';
import { Card } from '../ui/Card';

interface AuthLayoutProps {
  title: string;
  description: string;
  formTitle: string;
  formDescription?: string;
  children: ReactNode;
}

export function AuthLayout({ title: _title, description: _description, formTitle, formDescription, children }: AuthLayoutProps) {
  return (
    <View className="flex-1 items-center justify-center py-6 bg-white">
      <View className="w-full max-w-md gap-4">
        <View className="items-center">
          <View className="rounded-2xl border border-neutral-200 bg-surface px-6 py-5 shadow-sm">
            <Image source={require('../../../assets/aispace-logo.png')} style={{ width: 148, height: 44 }} resizeMode="contain" />
          </View>
        </View>

        <Card className="p-7 bg-surface rounded-2xl shadow-md border border-neutral-300">
          <View className="mb-6 gap-2">
            <Text className="text-2xl font-semibold text-neutral-950">{formTitle}</Text>
            {formDescription ? <Text className="text-sm leading-6 text-neutral-600">{formDescription}</Text> : null}
          </View>
          {children}
        </Card>
      </View>
    </View>
  );
}
