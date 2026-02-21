import { View, Text, Linking, Platform, Image, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

export default function ExportScreen() {
  const { syllabusId } = useLocalSearchParams();
  const router = useRouter();
  const { syllabus, isLoading } = useSyllabus(syllabusId as string);

  const handleDownload = async () => {
    // Ensure BASE_URL is defined or fallback
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    const url = `${baseUrl}/export/${syllabusId}/pdf`;
    
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await Linking.openURL(url);
    }
  };

  if (isLoading || !syllabus) return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <LoadingSpinner size="large" color={colors.primary} />
      <Text className="mt-4 text-gray-500 font-medium">Menyiapkan ekspor...</Text>
    </View>
  );

  return (
    <View className="flex-1 justify-center items-center p-6 bg-gray-50">
      <View className="w-full max-w-md items-center mb-8">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Ekspor Silabus</Text>
        <Text className="text-gray-500 text-center">Unduh jalur pembelajaran Anda dalam format PDF berkualitas tinggi</Text>
      </View>

      <Card className="w-full max-w-md p-8 items-center bg-white shadow-xl rounded-2xl border border-gray-100">
        <View className="w-24 h-24 bg-red-50 rounded-full items-center justify-center mb-6 shadow-sm border border-red-100">
          <Ionicons name="document-text" size={48} color={colors.primary} />
        </View>
        
        <Text className="text-xl font-bold text-gray-900 text-center mb-2 px-4 leading-tight">
          {syllabus.topic}
        </Text>
        
        <View className="flex-row items-center justify-center mb-8 space-x-4">
          <View className="bg-gray-100 px-3 py-1 rounded-md">
            <Text className="text-xs font-medium text-gray-600">Format PDF</Text>
          </View>
          <View className="w-1 h-1 rounded-full bg-gray-300" />
          <Text className="text-xs text-gray-400">
            {new Date().toLocaleDateString()}
          </Text>
        </View>

        <View className="w-full space-y-3">
          <Button 
            title="Unduh PDF" 
            onPress={handleDownload} 
            size="lg"
            className="w-full py-4 rounded-xl shadow-md bg-primary hover:bg-primaryDark transition-colors"
            icon={<Ionicons name="download-outline" size={20} color="white" />}
          />
          
          <Button 
            title="Kembali ke Silabus" 
            variant="ghost" 
            onPress={() => router.back()} 
            className="w-full py-3"
            textClassName="text-gray-500 font-medium"
          />
        </View>
      </Card>

      <View className="mt-8 items-center opacity-60">
        <Text className="text-xs text-gray-400 font-medium tracking-widest uppercase">Powered by</Text>
        <Text className="text-sm font-bold text-gray-500 mt-1">AI Space Telkom Indonesia</Text>
      </View>
    </View>
  );
}
