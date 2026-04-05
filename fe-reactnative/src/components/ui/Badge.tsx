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
    primary: 'bg-primary-50 border-primary-100',
    secondary: 'bg-neutral-100 border-neutral-200',
    success: 'bg-emerald-50 border-emerald-100',
    warning: 'bg-amber-50 border-amber-100',
    error: 'bg-red-50 border-red-100',
    info: 'bg-blue-50 border-blue-100',
    default: 'bg-neutral-100 border-neutral-300',
  };

  const textColors = {
    primary: 'text-primary-700',
    secondary: 'text-neutral-700',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    error: 'text-red-700',
    info: 'text-blue-700',
    default: 'text-neutral-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <View 
      className={clsx(
        'self-start rounded-pill border px-2.5 py-1 items-center',
        variants[variant],
        className
      )}
    >
      <Text 
        className={clsx(
          'font-semibold uppercase tracking-[0.15em]',
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
