import { View, Text } from 'react-native';
import clsx from 'clsx';
import { colors } from '../../theme/colors';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ label, variant = 'default', size = 'sm', className }: BadgeProps) {
  const variants = {
    primary: 'bg-primary/10 border-primary/20',
    secondary: 'bg-secondary/10 border-secondary/20',
    success: 'bg-green-100 border-green-200',
    warning: 'bg-yellow-100 border-yellow-200',
    error: 'bg-red-100 border-red-200',
    info: 'bg-blue-100 border-blue-200',
    default: 'bg-gray-100 border-gray-200',
  };

  const textColors = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    success: 'text-green-700',
    warning: 'text-yellow-700',
    error: 'text-red-700',
    info: 'text-blue-700',
    default: 'text-gray-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <View 
      className={clsx(
        "rounded-full border items-center self-start",
        variants[variant],
        className
      )}
    >
      <Text 
        className={clsx(
          "font-medium",
          textColors[variant],
          sizes[size].split(' ').filter(c => c.startsWith('text-')).join(' ')
        )}
        style={{ fontSize: size === 'sm' ? 12 : 14 }}
      >
        {label}
      </Text>
    </View>
  );
}
