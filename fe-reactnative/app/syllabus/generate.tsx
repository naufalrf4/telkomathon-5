import { View, Text, Platform, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useSSE } from '../../src/hooks/useSSE';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { GenerationForm } from '../../src/components/syllabus/GenerationForm';
import { GenerationTerminal } from '../../src/components/syllabus/GenerationTerminal';

export default function GenerateSyllabusScreen() {
  const router = useRouter();
  const { documents, isLoading: isLoadingDocs } = useDocuments();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  
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
      if (chunk.startsWith('ID:')) {
        setGeneratedSyllabusId(chunk.substring(3).trim());
      } else {
        setStreamOutput((prev) => prev + chunk);
      }
    },
    () => setIsGenerating(false)
  );

  const handleGenerate = async () => {
    if (!topic) return;
    setIsGenerating(true);
    setStreamOutput('');
    setGeneratedSyllabusId(null);
    
    await startSSE({
      topic,
      target_level: targetLevel,
      doc_ids: selectedDocIds,
      additional_context: additionalContext,
    });
  };

  const toggleDoc = (id: string) => {
    setSelectedDocIds(prev => 
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  if (isLoadingDocs) return <LoadingSpinner fullScreen message="Memuat dokumen..." />;

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      className="flex-1 bg-gray-50"
    >
      <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column', padding: isDesktop ? 24 : 16, gap: 16 }}>
        <View style={{ flex: 1 }}>
          <GenerationForm 
            topic={topic} setTopic={setTopic}
            targetLevel={targetLevel} setTargetLevel={setTargetLevel}
            selectedDocIds={selectedDocIds} toggleDoc={toggleDoc}
            additionalContext={additionalContext} setAdditionalContext={setAdditionalContext}
            isGenerating={isGenerating} onGenerate={handleGenerate}
            documents={documents} isLoadingDocs={isLoadingDocs}
          />
        </View>

        <View style={isDesktop ? { flex: 1 } : { height: 300 }}>
          <GenerationTerminal 
            streamOutput={streamOutput}
            isGenerating={isGenerating}
            generatedSyllabusId={generatedSyllabusId}
            onViewResult={() => generatedSyllabusId && router.replace(`/syllabus/${generatedSyllabusId}`)}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
