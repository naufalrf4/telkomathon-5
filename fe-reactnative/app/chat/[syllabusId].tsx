import { View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/services/api';
import { useSSE } from '../../src/hooks/useSSE';
import { Button } from '../../src/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { ChatMessage } from '../../src/types/api';

export default function ChatScreen() {
  const { syllabusId } = useLocalSearchParams();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  
  const { data: history, isLoading } = useQuery({
    queryKey: ['chat', syllabusId],
    queryFn: () => apiGet<{ messages: ChatMessage[] }>(`/chat/${syllabusId}/history`),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (history?.messages) {
      setMessages(history.messages);
    }
  }, [history]);

  const { startSSE } = useSSE(
    `/chat/${syllabusId}/message`,
    (chunk) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.id === 'streaming') {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk }
          ];
        }
        return prev;
      });
    },
    () => {
      setIsStreaming(false);
      // Replace temp ID with real one or just keep it
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === 'streaming') {
           return [...prev.slice(0, -1), { ...last, id: Date.now().toString() }];
        }
        return prev;
      });
    }
  );

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      syllabus_id: syllabusId as string,
      role: 'user',
      content: inputText,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsStreaming(true);

    // Add placeholder for assistant
    setMessages(prev => [...prev, {
      id: 'streaming',
      syllabus_id: syllabusId as string,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    }]);

    await startSSE({ content: userMsg.content });
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-3 border-b border-gray-200 flex-row items-center shadow-sm">
        <Button variant="outline" size="sm" onPress={() => router.back()} icon={<Ionicons name="arrow-back" size={20} />} className="mr-3 border-0" />
        <View>
          <Text className="font-bold text-lg text-gray-900">Syllabus Assistant</Text>
          <Text className="text-xs text-green-600 flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-green-500 mr-1" /> Online
          </Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className={`mb-4 px-4 ${item.role === 'user' ? 'items-end' : 'items-start'}`}>
            <View className={`max-w-[80%] rounded-2xl p-4 ${
              item.role === 'user' 
                ? 'bg-primary rounded-tr-none' 
                : 'bg-white border border-gray-200 rounded-tl-none'
            }`}>
              <Text className={`text-base ${item.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                {item.content}
              </Text>
            </View>
            <Text className="text-[10px] text-gray-400 mt-1 mx-1">
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingVertical: 16 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <View className="p-4 bg-white border-t border-gray-200 flex-row items-center">
          <TextInput
            className="flex-1 bg-gray-100 rounded-full px-4 py-3 mr-3 border border-gray-200 max-h-24"
            placeholder="Ask about the syllabus..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <Button 
            onPress={handleSend} 
            disabled={!inputText.trim() || isStreaming}
            variant="primary"
            className="rounded-full w-12 h-12 items-center justify-center p-0"
            icon={isStreaming ? <ActivityIndicator color="white" /> : <Ionicons name="send" size={20} color="white" />}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
