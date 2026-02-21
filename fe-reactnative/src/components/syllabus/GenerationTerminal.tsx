import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface GenerationTerminalProps {
  streamOutput: string;
  isGenerating: boolean;
  generatedSyllabusId: string | null;
  onViewResult: () => void;
}

export function GenerationTerminal({ 
  streamOutput, isGenerating, generatedSyllabusId, onViewResult 
}: GenerationTerminalProps) {
  const scrollRef = useRef<ScrollView>(null);
  
  useEffect(() => {
    if (streamOutput) scrollRef.current?.scrollToEnd({ animated: true });
  }, [streamOutput]);

  return (
    <View className="h-full bg-gray-900 rounded-xl p-4 border border-gray-800 flex-1 shadow-inner relative overflow-hidden">
      <View className="flex-row justify-between items-center mb-2 pb-2 border-b border-gray-800">
        <View className="flex-row items-center space-x-2">
          <View className="w-3 h-3 rounded-full bg-red-500" />
          <View className="w-3 h-3 rounded-full bg-yellow-500" />
          <View className="w-3 h-3 rounded-full bg-green-500" />
          <Text className="text-gray-400 font-mono text-xs ml-2">AI_GENERATION_LOG</Text>
        </View>
        {isGenerating && (
          <View className="flex-row items-center animate-pulse">
            <View className="w-2 h-2 rounded-full bg-green-500 mr-2" />
            <Text className="text-green-500 text-xs font-mono uppercase">Memproses</Text>
          </View>
        )}
      </View>

      <ScrollView 
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={true}
      >
        {!streamOutput && !generatedSyllabusId ? (
          <View className="flex-1 justify-center items-center opacity-30 mt-20">
            <Ionicons name="terminal-outline" size={64} color="white" />
            <Text className="text-gray-400 font-mono mt-4 text-center">
              Siap membuat silabus...{'\n'}Menunggu parameter input...
            </Text>
          </View>
        ) : (
          <Text className="text-green-400 font-mono text-sm leading-6 font-medium">
            {streamOutput}
            {isGenerating && <Text className="animate-pulse">_</Text>}
          </Text>
        )}
      </ScrollView>
      
      {generatedSyllabusId && (
         <View className="absolute bottom-6 left-6 right-6">
           <Pressable 
             onPress={onViewResult}
             className="bg-green-600 p-4 rounded-lg flex-row items-center justify-center shadow-lg active:scale-95 transition-transform"
           >
             <Ionicons name="checkmark-circle" size={24} color="white" />
             <Text className="text-white font-bold text-lg ml-2">Silabus Dibuat! Lihat Sekarang</Text>
             <Ionicons name="arrow-forward" size={20} color="white" className="ml-auto" />
           </Pressable>
         </View>
      )}
    </View>
  );
}
