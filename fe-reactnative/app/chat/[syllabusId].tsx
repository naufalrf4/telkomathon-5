import { View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Pressable, Image } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../src/services/api';
import { useSSE } from '../../src/hooks/useSSE';
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

    setMessages(prev => [...prev, {
      id: 'streaming',
      syllabus_id: syllabusId as string,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    }]);

    await startSSE({ content: userMsg.content });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View className={`mb-4 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <View className="w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-2 self-end mb-1">
            <Ionicons name="sparkles" size={16} color={colors.aiAccent || '#7C3AED'} />
          </View>
        )}
        
        <View className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${
          isUser 
            ? 'bg-primary rounded-br-none' 
            : 'bg-white border border-gray-100 rounded-bl-none'
        }`}>
          {item.content === '' && item.id === 'streaming' ? (
            <View className="flex-row gap-1 py-1">
              <View className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
              <View className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75" />
              <View className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150" />
            </View>
          ) : (
            <Text className={`text-base leading-6 ${isUser ? 'text-white' : 'text-gray-800'}`}>
              {item.content}
            </Text>
          )}
          
          <Text className={`text-[10px] mt-1 text-right ${isUser ? 'text-primaryLight opacity-80' : 'text-gray-400'}`}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {isUser && (
          <View className="w-8 h-8 rounded-full bg-gray-200 items-center justify-center ml-2 self-end mb-1">
             <Ionicons name="person" size={16} color={colors.secondary} />
          </View>
        )}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-3 border-b border-gray-200 flex-row items-center shadow-sm z-10">
        <Pressable 
          onPress={() => router.back()} 
          className="mr-3 p-2 rounded-full hover:bg-gray-100"
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View>
          <Text className="font-bold text-lg text-gray-900">Asisten Silabus</Text>
          <View className="flex-row items-center">
            <View className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
            <Text className="text-xs text-green-600 font-medium">Aktif • AI Powered</Text>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        className="bg-white border-t border-gray-200"
      >
        <View className="p-4 flex-row items-end gap-3 pb-8">
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-base max-h-32 text-gray-800 border border-transparent focus:border-gray-300 focus:bg-white"
            placeholder="Tanyakan sesuatu tentang silabus Anda..."
            placeholderTextColor="#9CA3AF"
            value={inputText}
            onChangeText={setInputText}
            multiline
            textAlignVertical="center"
          />
          <Pressable 
            onPress={handleSend} 
            disabled={!inputText.trim() || isStreaming}
            className={`w-12 h-12 rounded-full items-center justify-center shadow-sm ${
              !inputText.trim() || isStreaming ? 'bg-gray-200' : 'bg-primary'
            }`}
          >
            {isStreaming ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="white" style={{ marginLeft: 2 }} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
