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
  const baseStyles = 'flex-row items-center justify-center rounded-lg font-medium transition-opacity';
  
  const variants = {
    primary: 'bg-primary text-white',
    secondary: 'bg-secondary text-white',
    outline: 'bg-transparent border border-gray-300 text-gray-700',
    danger: 'bg-red-500 text-white',
    ghost: 'bg-transparent text-gray-700',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
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
        className
      )}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : '#fff'} className="mr-2" />
      ) : icon ? (
        <Text className={clsx(title ? 'mr-2' : '', variant === 'outline' || variant === 'ghost' ? 'text-gray-700' : 'text-white')}>{icon}</Text>
      ) : null}
      {title ? (
        <Text className={clsx("font-bold", variant === 'outline' || variant === 'ghost' ? 'text-gray-700' : 'text-white', textClassName)}>{title}</Text>
      ) : null}
    </Pressable>
  );
}
