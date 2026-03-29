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
        <View key={index} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <Pressable
            onPress={() => toggle(index)}
            className="flex-row items-center justify-between bg-gray-50 p-4 active:bg-gray-100"
          >
            <View className="mr-4 flex-1">
              <Text className="text-sm font-semibold text-gray-800">ELO {index + 1}</Text>
              <Text className="mt-1 text-base text-gray-600" numberOfLines={expandedIndex === index ? undefined : 1}>
                {item.elo}
              </Text>
            </View>
            <Ionicons
              name={expandedIndex === index ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          {expandedIndex === index ? (
            <View className="border-t border-gray-100 bg-white p-4">
              <Text className="text-xs font-bold uppercase text-gray-400">Capability statement</Text>
              <Text className="mt-2 text-sm leading-6 text-gray-700">{item.elo}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}
