import { View, Text, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';

export default function SyllabusListScreen() {
  const { syllabi, isLoading } = useSyllabus();
  const router = useRouter();

  if (isLoading) return <LoadingSpinner fullScreen message="Loading syllabi..." />;

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-bold text-gray-900">My Syllabi</Text>
        <Button 
          title="Create New" 
          onPress={() => router.push('/syllabus/generate')} 
          icon={<Ionicons name="add" size={18} color="white" />}
        />
      </View>

      {!syllabi || syllabi.length === 0 ? (
        <EmptyState 
          title="No syllabi yet" 
          description="Generate a new syllabus from your documents using AI."
          icon="school-outline"
          action={{ label: "Create Syllabus", onPress: () => router.push('/syllabus/generate') }}
        />
      ) : (
        <FlatList
          data={syllabi}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Card 
              className="mb-4" 
              title={item.topic}
              subtitle={`Level ${item.target_level}`}
              action={
                <Badge 
                  label={item.status} 
                  variant={item.status === 'completed' ? 'success' : 'warning'} 
                />
              }
            >
              <View className="mt-2 flex-row justify-between items-end">
                <Text className="text-gray-500 text-sm" numberOfLines={2}>{item.tlo || 'Processing...'}</Text>
                <Button 
                  title="View" 
                  size="sm" 
                  variant="outline" 
                  onPress={() => router.push(`/syllabus/${item.id}`)}
                />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}
