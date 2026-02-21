import { View, Text, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiDelete } from '../../src/services/api';
import { Document } from '../../src/types/api';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => apiGet<Document>(`/documents/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      router.back();
    },
  });

  if (isLoading || !document) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView className="flex-1">
      <View className="mb-6 flex-row items-center">
        <Button 
          title="Back" 
          variant="outline" 
          size="sm" 
          onPress={() => router.back()} 
          icon={<Ionicons name="arrow-back" size={16} color="black" />}
          className="mr-4"
        />
        <Text className="text-2xl font-bold text-gray-900 flex-1">{document.filename}</Text>
      </View>

      <Card className="mb-6">
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text className="text-sm text-gray-500 uppercase tracking-wide mb-1">Status</Text>
            <Badge 
              label={document.status} 
              variant={document.status === 'processed' ? 'success' : 'warning'} 
            />
          </View>
          <View>
            <Text className="text-sm text-gray-500 uppercase tracking-wide mb-1">Type</Text>
            <Text className="font-medium text-gray-900">{document.file_type}</Text>
          </View>
          <View>
            <Text className="text-sm text-gray-500 uppercase tracking-wide mb-1">Uploaded</Text>
            <Text className="font-medium text-gray-900">{new Date(document.created_at).toLocaleDateString()}</Text>
          </View>
        </View>

        <View className="border-t border-gray-100 pt-4 mt-2">
          <Button 
            title="Delete Document" 
            variant="danger" 
            onPress={() => Alert.alert('Delete', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() }
            ])}
            isLoading={deleteMutation.isPending}
            icon={<Ionicons name="trash-outline" size={18} color="white" />}
          />
        </View>
      </Card>

      <View className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <View className="flex-row items-center mb-2">
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <Text className="font-bold text-blue-800 ml-2">Processing Info</Text>
        </View>
        <Text className="text-blue-700 text-sm">
          This document has been processed and is ready to be used for syllabus generation.
          The content has been chunked and embedded for AI retrieval.
        </Text>
      </View>
    </ScrollView>
  );
}
