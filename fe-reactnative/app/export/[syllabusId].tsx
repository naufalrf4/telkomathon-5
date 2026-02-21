import { View, Text, Linking, Platform } from 'react-native';
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
    const url = `${process.env.EXPO_PUBLIC_API_URL}/export/${syllabusId}/pdf`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      await Linking.openURL(url);
    }
  };

  if (isLoading || !syllabus) return <LoadingSpinner fullScreen />;

  return (
    <View className="flex-1 justify-center items-center p-6 bg-gray-50">
      <Card className="w-full max-w-md p-8 items-center">
        <View className="bg-red-50 p-6 rounded-full mb-6">
          <Ionicons name="document-text" size={64} color={colors.primary} />
        </View>
        
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">{syllabus.topic}</Text>
        <Text className="text-gray-500 text-center mb-8">Ready for export</Text>

        <Button 
          title="Download PDF Syllabus" 
          onPress={handleDownload} 
          size="lg"
          className="w-full mb-4"
          icon={<Ionicons name="download" size={20} color="white" />}
        />
        
        <Button 
          title="Back to Syllabus" 
          variant="outline" 
          onPress={() => router.back()} 
          className="w-full"
        />
      </Card>
    </View>
  );
}
