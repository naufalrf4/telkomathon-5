import { Pressable, Text, ActivityIndicator } from 'react-native';
import clsx from 'clsx';
import { colors } from '../../theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  disabled = false,
  className,
  icon
}: ButtonProps) {
  const baseStyles = 'flex-row items-center justify-center rounded-lg font-medium transition-opacity';
  
  const variants = {
    primary: 'bg-primary text-white',
    secondary: 'bg-secondary text-white',
    outline: 'bg-transparent border border-gray-300 text-gray-700',
    danger: 'bg-red-500 text-white',
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
        disabled && 'opacity-50',
        className
      )}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : '#fff'} className="mr-2" />
      ) : icon ? (
        <Text className={clsx("mr-2", variant === 'outline' ? 'text-gray-700' : 'text-white')}>{icon}</Text>
      ) : null}
      <Text className={clsx("font-bold", variant === 'outline' ? 'text-gray-700' : 'text-white')}>{title}</Text>
    </Pressable>
  );
}
