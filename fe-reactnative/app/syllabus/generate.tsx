import { View, Text, TextInput, ScrollView, Switch, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useSSE } from '../../src/hooks/useSSE';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

export default function GenerateSyllabusScreen() {
  const router = useRouter();
  const { documents, isLoading: isLoadingDocs } = useDocuments();
  
  const [topic, setTopic] = useState('');
  const [targetLevel, setTargetLevel] = useState(3);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [additionalContext, setAdditionalContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamOutput, setStreamOutput] = useState('');
  const [generatedSyllabusId, setGeneratedSyllabusId] = useState<string | null>(null);

  const { startSSE } = useSSE(
    '/syllabi/generate',
    (chunk) => {
      // Check if chunk contains ID (e.g. "ID:123") or just text
      if (chunk.startsWith('ID:')) {
        setGeneratedSyllabusId(chunk.substring(3).trim());
      } else {
        setStreamOutput((prev) => prev + chunk);
      }
    },
    () => {
      setIsGenerating(false);
      // Navigate if we have an ID
      if (generatedSyllabusId) {
        router.replace(`/syllabus/${generatedSyllabusId}`);
      } else {
        // Fallback: fetch latest syllabus or show error?
        // Ideally the backend sends the ID. 
        // For now, let's assume the backend sends "ID:..." as a special chunk or we just list all and pick top.
        // We'll just stay here and show "Done" button.
      }
    }
  );

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setStreamOutput('');
    setGeneratedSyllabusId(null);
    
    const body = {
      topic,
      target_level: targetLevel,
      doc_ids: selectedDocIds,
      additional_context: additionalContext,
    };
    
    await startSSE(body);
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  if (isLoadingDocs) return <LoadingSpinner fullScreen />;

  return (
    <View className="flex-1 flex-row">
      {/* Left: Form */}
      <ScrollView className="flex-1 pr-4">
        <Text className="text-2xl font-bold text-gray-900 mb-6">Generate Syllabus</Text>
        
        <Card className="mb-4">
          <Text className="font-semibold text-gray-700 mb-2">Topic</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 bg-white mb-4"
            placeholder="e.g. Introduction to Data Science"
            value={topic}
            onChangeText={setTopic}
          />

          <Text className="font-semibold text-gray-700 mb-2">Target Level (1-5)</Text>
          <View className="flex-row justify-between mb-4 bg-gray-50 p-2 rounded-lg">
            {[1, 2, 3, 4, 5].map((level) => (
              <TouchableOpacity
                key={level}
                onPress={() => setTargetLevel(level)}
                className={`w-10 h-10 rounded-full items-center justify-center ${
                  targetLevel === level ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <Text className={targetLevel === level ? 'text-white font-bold' : 'text-gray-600'}>
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="font-semibold text-gray-700 mb-2">Select Documents (Context)</Text>
          <ScrollView className="max-h-40 mb-4 border border-gray-200 rounded-lg">
            {documents?.map(doc => (
              <TouchableOpacity 
                key={doc.id} 
                className="flex-row items-center p-2 border-b border-gray-100"
                onPress={() => toggleDoc(doc.id)}
              >
                <Ionicons 
                  name={selectedDocIds.includes(doc.id) ? "checkbox" : "square-outline"} 
                  size={20} 
                  color={selectedDocIds.includes(doc.id) ? colors.primary : '#ccc'} 
                />
                <Text className="ml-2 text-sm text-gray-700 flex-1" numberOfLines={1}>{doc.filename}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text className="font-semibold text-gray-700 mb-2">Additional Context (Optional)</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 bg-white h-24 mb-4"
            placeholder="Any specific requirements..."
            multiline
            textAlignVertical="top"
            value={additionalContext}
            onChangeText={setAdditionalContext}
          />

          <Button 
            title={isGenerating ? "Generating..." : "Generate Syllabus"} 
            onPress={handleGenerate} 
            isLoading={isGenerating}
            disabled={!topic || isGenerating}
            icon={<Ionicons name="sparkles" size={18} color="white" />}
          />
        </Card>
      </ScrollView>

      {/* Right: Output Stream */}
      <View className="flex-1 bg-gray-900 rounded-lg p-4 h-full border border-gray-800">
        <Text className="text-gray-400 font-mono text-xs mb-2">GENERATION LOG</Text>
        <ScrollView className="flex-1">
          <Text className="text-green-400 font-mono text-sm leading-6">
            {streamOutput || '> Waiting for input...'}
          </Text>
        </ScrollView>
        {generatedSyllabusId && (
           <Button 
             title="View Result" 
             className="mt-4" 
             onPress={() => router.replace(`/syllabus/${generatedSyllabusId}`)} 
           />
        )}
      </View>
    </View>
  );
}
