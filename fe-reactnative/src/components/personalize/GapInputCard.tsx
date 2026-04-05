import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { CompetencyGap } from '../../types/api';
import { Card } from '../ui/Card';

interface GapInputCardProps {
  gap: CompetencyGap;
  index: number;
  onUpdate: (field: keyof CompetencyGap, value: string | number) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function GapInputCard({ gap, index, onUpdate, onRemove, canRemove }: GapInputCardProps) {
  const renderLevelSelector = (label: string, field: 'current_level' | 'required_level', value: number) => (
    <View className="flex-1">
      <Text className="text-xs font-medium text-neutral-600 mb-2">{label}</Text>
      <View className="flex-row justify-between bg-neutral-100 p-1 rounded-lg border border-neutral-300">
        {[1, 2, 3, 4, 5].map((level) => (
          <Pressable
            key={level}
            onPress={() => onUpdate(field, level)}
            className={`w-8 h-8 rounded-md items-center justify-center ${
              value === level ? 'bg-primary-600 shadow-sm' : 'bg-transparent'
            }`}
          >
            <Text className={`font-bold ${value === level ? 'text-white' : 'text-neutral-600'}`}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Card className="mb-4 overflow-hidden border border-neutral-300 bg-surface p-0 shadow-sm">
      <View className="flex-row items-center justify-between border-b border-neutral-100 bg-primary-50/60 px-5 py-4">
        <View className="flex-row items-center gap-2">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            <Text className="text-primary font-bold text-xs">{index + 1}</Text>
          </View>
          <Text className="font-semibold text-neutral-800">Kesenjangan kemampuan</Text>
        </View>
        {canRemove && (
          <Pressable onPress={onRemove} className="rounded-full p-1 hover:bg-primary-100">
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        )}
      </View>

      <View className="space-y-4 p-5">
        <View>
          <Text className="mb-1 text-xs font-medium text-neutral-600">Kemampuan yang perlu ditingkatkan</Text>
          <TextInput
            className="border border-neutral-300 rounded-lg p-3 bg-surface text-neutral-800 focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
            placeholder="contoh: Pemrograman Python Lanjutan"
            placeholderTextColor={colors.textMuted}
            value={gap.skill}
            onChangeText={(t) => onUpdate('skill', t)}
          />
        </View>

        <View className="flex-row gap-4">
          {renderLevelSelector('Level Saat Ini', 'current_level', gap.current_level)}
          {renderLevelSelector('Level Target', 'required_level', gap.required_level)}
        </View>

        <View>
          <Text className="mb-1 text-xs font-medium text-neutral-600">Catatan tambahan (opsional)</Text>
          <TextInput
            className="border border-neutral-300 rounded-lg p-3 bg-surface text-neutral-800 min-h-[80px] focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
            multiline
            placeholder="Jelaskan detail kesenjangan secara spesifik..."
            placeholderTextColor={colors.textMuted}
            textAlignVertical="top"
            value={gap.gap_description}
            onChangeText={(t) => onUpdate('gap_description', t)}
          />
        </View>
      </View>
    </Card>
  );
}
