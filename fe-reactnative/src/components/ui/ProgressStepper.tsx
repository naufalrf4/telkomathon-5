import { ScrollView, Text, View } from 'react-native';
import clsx from 'clsx';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface StepItem {
  value: string;
  label: string;
}

interface ProgressStepperProps {
  steps: StepItem[];
  activeIndex: number;
}

export function ProgressStepper({ steps, activeIndex }: ProgressStepperProps) {
  return (
    <View className="rounded-2xl border border-neutral-200 bg-surface p-4 shadow-sm">
      <Text className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Progress wizard</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          return (
            <View
              key={step.value}
              className={clsx(
                'min-w-[140px] rounded-2xl border px-4 py-3',
                isActive
                  ? 'border-primary-200 bg-primary-50'
                  : isComplete
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-neutral-200 bg-neutral-50'
              )}
            >
              <View className="flex-row items-center gap-2">
                <View
                  className={clsx(
                    'h-8 w-8 items-center justify-center rounded-full',
                    isActive || isComplete ? 'bg-primary' : 'bg-neutral-200'
                  )}
                >
                  <Ionicons
                    name={isComplete ? 'checkmark' : 'ellipse-outline'}
                    size={16}
                    color={isActive || isComplete ? '#fff' : colors.textSecondary}
                  />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Langkah {index + 1}</Text>
                  <Text className={clsx('text-sm font-semibold', isActive ? 'text-neutral-950' : 'text-neutral-700')}>
                    {step.label}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
