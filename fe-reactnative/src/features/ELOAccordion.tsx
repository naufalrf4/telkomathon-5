import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ELO } from '../types/api';
import { colors } from '../theme/colors';

interface ELOAccordionProps {
  elos: ELO[];
}

export function ELOAccordion({ elos }: ELOAccordionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <View className="space-y-2">
      {elos.map((item, index) => (
        <View key={index} className="overflow-hidden rounded-lg border border-neutral-300 bg-surface">
          <Pressable
            onPress={() => toggle(index)}
            className="flex-row items-center justify-between bg-neutral-50 p-4 active:bg-neutral-50"
          >
            <View className="mr-4 flex-1">
              <Text className="text-sm font-semibold text-neutral-800">ELO {index + 1}</Text>
              <Text className="mt-1 text-base text-neutral-600" numberOfLines={expandedIndex === index ? undefined : 1}>
                {item.elo}
              </Text>
            </View>
            <Ionicons
              name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={expandedIndex === index ? colors.primary : colors.textSecondary}
            />
          </Pressable>

          {expandedIndex === index ? (
            <View className="border-t border-neutral-300 bg-surface p-4">
              <Text className="text-xs font-bold uppercase text-neutral-400">Deskripsi ELO</Text>
              <Text className="mt-2 text-sm leading-6 text-neutral-700">{item.elo}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
