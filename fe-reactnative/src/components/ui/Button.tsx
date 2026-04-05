import { Pressable, Text, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { colors } from '../../theme/colors';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  textClassName?: string;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export function Button({ 
  title = '', 
  onPress, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  disabled = false,
  className,
  textClassName,
  fullWidth = false,
  icon
}: ButtonProps) {
  const baseStyles = 'flex-row items-center justify-center rounded-lg border font-semibold transition-opacity active:opacity-90';
  
  const variants = {
    primary: 'bg-primary-600 border-primary-600 text-white shadow-sm hover:bg-primary-700 active:bg-primary-800',
    secondary: 'bg-neutral-900 border-neutral-900 text-white shadow-sm hover:bg-neutral-800 active:bg-neutral-950',
    outline: 'bg-surface border-neutral-300 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100',
    danger: 'bg-red-600 border-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
    ghost: 'bg-transparent border-transparent text-neutral-700 hover:bg-neutral-100',
  };

  const sizes = {
    sm: 'px-3.5 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-5 py-3.5 text-lg',
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || isLoading}
      className={clsx(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        disabled && 'opacity-50',
        variant === 'ghost' && 'shadow-none',
        className
      )}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : '#fff'} className="mr-2" />
      ) : icon ? (
        <Text className={clsx(title ? 'mr-2' : '', variant === 'outline' || variant === 'ghost' ? 'text-neutral-700' : 'text-white')}>{icon}</Text>
      ) : null}
      {title ? (
        <Text className={clsx('font-semibold', variant === 'outline' || variant === 'ghost' ? 'text-neutral-700' : 'text-white', textClassName)}>{title}</Text>
      ) : null}
    </Pressable>
  );
}
