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
      className={clsx("bg-white rounded-xl shadow-sm border border-gray-200 p-4", className)} 
      {...props}
    >
      {(title || action) && (
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            {title && <Text className="font-bold text-lg text-gray-900">{title}</Text>}
            {subtitle && <Text className="text-sm text-gray-500 mt-1">{subtitle}</Text>}
          </View>
          {action && <View className="ml-2">{action}</View>}
        </View>
      )}
      <View>{children}</View>
    </View>
  );
}
