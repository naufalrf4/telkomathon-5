import { View, Text, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ELO } from '../../types/api';
import { colors } from '../../theme/colors';
import clsx from 'clsx';

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
        <View key={index} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <TouchableOpacity 
            onPress={() => toggle(index)}
            className="flex-row justify-between items-center p-4 bg-gray-50 active:bg-gray-100"
          >
            <View className="flex-1 mr-4">
              <Text className="font-semibold text-gray-800 text-sm">ELO {index + 1}</Text>
              <Text className="text-gray-600 text-base mt-1" numberOfLines={expandedIndex === index ? undefined : 1}>
                {item.elo}
              </Text>
            </View>
            <Ionicons 
              name={expandedIndex === index ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>
          
          {expandedIndex === index && (
            <View className="p-4 border-t border-gray-100 bg-white">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-2">PCE (Performance, Condition, Evaluation)</Text>
              <View className="space-y-2">
                {item.pce.map((pce, idx) => (
                  <View key={idx} className="flex-row items-start">
                    <View className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 mr-2" />
                    <Text className="text-gray-700 text-sm flex-1">{pce}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
