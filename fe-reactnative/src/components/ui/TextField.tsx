import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { colors } from '../../theme/colors';

interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  required?: boolean;
  containerClassName?: string;
  inputClassName?: string;
}

export function TextField({ label, hint, required = false, multiline = false, containerClassName = '', inputClassName = '', ...props }: TextFieldProps) {
  return (
    <View className={`gap-2 ${containerClassName}`.trim()}>
      <View className="flex-row items-center gap-1">
        <Text className="text-sm font-semibold text-neutral-800">{label}</Text>
        {required ? <Text className="text-sm font-semibold text-primary-600">*</Text> : null}
      </View>
      {hint ? <Text className="text-sm leading-5 text-neutral-600">{hint}</Text> : null}
      {/* Note: NativeWind focus rings are limited on React Native, relying on border changes or specific focus plugins if configured */}
      <TextInput
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : props.textAlignVertical}
        placeholderTextColor={colors.textMuted || "#94A3B8"}
        className={`rounded-lg border border-neutral-300 bg-surface px-4 py-3 text-base text-neutral-950 ${multiline ? 'min-h-[120px]' : ''} ${inputClassName}`.trim()}
        {...props}
      />
    </View>
  );
}
