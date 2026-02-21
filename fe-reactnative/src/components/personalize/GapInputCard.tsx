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
      <Text className="text-xs font-medium text-gray-500 mb-2">{label}</Text>
      <View className="flex-row justify-between bg-gray-50 p-1 rounded-lg border border-gray-200">
        {[1, 2, 3, 4, 5].map((level) => (
          <Pressable
            key={level}
            onPress={() => onUpdate(field, level)}
            className={`w-8 h-8 rounded-md items-center justify-center ${
              value === level ? 'bg-primary shadow-sm' : 'bg-transparent'
            }`}
          >
            <Text className={`font-bold ${value === level ? 'text-white' : 'text-gray-400'}`}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Card className="mb-4 border border-gray-200 bg-white shadow-sm rounded-xl overflow-hidden">
      <View className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex-row justify-between items-center">
        <View className="flex-row items-center gap-2">
          <View className="bg-primary/10 w-6 h-6 rounded-full items-center justify-center">
            <Text className="text-primary font-bold text-xs">{index + 1}</Text>
          </View>
          <Text className="font-semibold text-gray-700">Kesenjangan Kompetensi</Text>
        </View>
        {canRemove && (
          <Pressable onPress={onRemove} className="p-1 rounded-full hover:bg-red-50">
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        )}
      </View>

      <View className="p-4 space-y-4">
        <View>
          <Text className="text-xs font-medium text-gray-500 mb-1">Nama Keterampilan / Kompetensi</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 bg-white text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="contoh: Pemrograman Python Lanjutan"
            placeholderTextColor="#9CA3AF"
            value={gap.skill}
            onChangeText={(t) => onUpdate('skill', t)}
          />
        </View>

        <View className="flex-row gap-4">
          {renderLevelSelector('Level Saat Ini', 'current_level', gap.current_level)}
          {renderLevelSelector('Level Target', 'required_level', gap.required_level)}
        </View>

        <View>
          <Text className="text-xs font-medium text-gray-500 mb-1">Deskripsi (Opsional)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 bg-white text-gray-900 min-h-[80px] focus:border-primary focus:ring-1 focus:ring-primary"
            multiline
            placeholder="Jelaskan detail kesenjangan secara spesifik..."
            placeholderTextColor="#9CA3AF"
            textAlignVertical="top"
            value={gap.gap_description}
            onChangeText={(t) => onUpdate('gap_description', t)}
          />
        </View>
      </View>
    </Card>
  );
}
