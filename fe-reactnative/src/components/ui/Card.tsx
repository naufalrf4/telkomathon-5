import { View, Text, ViewProps } from 'react-native';
import clsx from 'clsx';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Card({ children, className, title, subtitle, action, ...props }: CardProps) {
  return (
    <View 
      className={clsx('rounded-xl border border-neutral-300 bg-surface p-5 shadow-sm', className)} 
      {...props}
    >
      {(title || action) && (
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            {title && <Text className="text-lg font-semibold text-neutral-950">{title}</Text>}
            {subtitle && <Text className="mt-1 text-sm leading-6 text-neutral-600">{subtitle}</Text>}
          </View>
          {action && <View className="ml-2">{action}</View>}
        </View>
      )}
      <View>{children}</View>
    </View>
  );
}
