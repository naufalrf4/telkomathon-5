import React from 'react';
import { View, Text, TextInput, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { Document } from '../../types/api';

interface GenerationFormProps {
  topic: string;
  setTopic: (t: string) => void;
  targetLevel: number;
  setTargetLevel: (l: number) => void;
  selectedDocIds: string[];
  toggleDoc: (id: string) => void;
  additionalContext: string;
  setAdditionalContext: (c: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  documents: Document[] | undefined;
  isLoadingDocs: boolean;
}

const LEVELS = [1, 2, 3, 4, 5];
const LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula', 2: 'Dasar', 3: 'Menengah', 4: 'Lanjutan', 5: 'Ahli'
};

export function GenerationForm({
  topic, setTopic, targetLevel, setTargetLevel, selectedDocIds, toggleDoc,
  additionalContext, setAdditionalContext, isGenerating, onGenerate, documents, isLoadingDocs
}: GenerationFormProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  return (
    <Card className={`h-full border-t-4 border-t-primary ${isDesktop ? 'p-6' : 'p-4'}`}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold text-gray-900 mb-6">Parameter Kursus</Text>
        
        <View className="mb-6">
          <Text className="font-semibold text-gray-700 mb-2">Topik / Judul</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 bg-white text-base focus:border-primary"
            placeholder="contoh: Pengantar Data Science"
            value={topic}
            onChangeText={setTopic}
            editable={!isGenerating}
          />
        </View>

        <View className="mb-6">
          <Text className="font-semibold text-gray-700 mb-2">
            Target Level: <Text className="text-primary">{LEVEL_LABELS[targetLevel]}</Text>
          </Text>
          <View className="flex-row justify-between bg-gray-50 p-2 rounded-lg border border-gray-200">
            {LEVELS.map((level) => (
              <Pressable
                key={level}
                onPress={() => !isGenerating && setTargetLevel(level)}
                className={`rounded-full items-center justify-center ${isDesktop ? 'w-10 h-10' : 'w-12 h-12'} ${
                  targetLevel === level ? 'bg-primary shadow-md' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold ${targetLevel === level ? 'text-white' : 'text-gray-500'}`}>
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="mb-6">
          <Text className="font-semibold text-gray-700 mb-2">Dokumen Sumber</Text>
          <View className={`${isDesktop ? 'max-h-64' : 'max-h-48'} border border-gray-200 rounded-lg bg-gray-50 overflow-hidden`}>
            <ScrollView nestedScrollEnabled>
              {isLoadingDocs ? (
                <Text className="p-4 text-gray-500 text-center">Memuat dokumen...</Text>
              ) : documents?.length === 0 ? (
                <Text className="p-4 text-gray-500 text-center">Tidak ada dokumen ditemukan.</Text>
              ) : (
                documents?.map(doc => {
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <Pressable 
                      key={doc.id} 
                      className={`flex-row items-center p-3 border-b border-gray-100 ${isSelected ? 'bg-blue-50' : ''}`}
                      onPress={() => !isGenerating && toggleDoc(doc.id)}
                    >
                      <Ionicons 
                        name={isSelected ? "checkbox" : "square-outline"} 
                        size={20} 
                        color={isSelected ? colors.primary : '#ccc'} 
                      />
                      <Text className={`ml-2 text-sm flex-1 ${isSelected ? 'text-primary font-medium' : 'text-gray-600'}`} numberOfLines={1}>
                        {doc.filename}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>

        <View className="mb-8">
          <Text className="font-semibold text-gray-700 mb-2">Konteks Tambahan</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 bg-white h-24 text-base focus:border-primary"
            placeholder="Persyaratan khusus, area fokus, atau batasan..."
            multiline
            textAlignVertical="top"
            value={additionalContext}
            onChangeText={setAdditionalContext}
            editable={!isGenerating}
          />
        </View>

        <Button 
          title={isGenerating ? "Sedang Membuat..." : "Buat Silabus"} 
          onPress={onGenerate} 
          isLoading={isGenerating}
          disabled={!topic || isGenerating}
          fullWidth
          size="lg"
          icon={<Ionicons name="sparkles" size={20} color="white" />}
        />
      </ScrollView>
    </Card>
  );
}
