import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { syllabusTitle } from '../../src/utils/syllabus';

export default function RoadmapLandingScreen() {
  const router = useRouter();
  const { syllabi, isLoading } = useSyllabus();

  const finalized = (syllabi ?? []).filter((item) => item.status === 'finalized');

  if (isLoading && !syllabi) {
    return <LoadingSpinner fullScreen message="Memuat pilihan roadmap..." />;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-5xl p-4 lg:p-8 gap-6">
        <View className="flex-row items-center justify-between gap-4">
          <View>
            <Text className="text-3xl font-bold text-gray-900">Career Roadmap</Text>
            <Text className="mt-1 text-gray-500">Pilih syllabus final untuk membangun roadmap pengembangan karier peserta.</Text>
          </View>
          <Button title="Kembali" variant="ghost" onPress={() => router.back()} />
        </View>

        {finalized.length > 0 ? (
          <View className="gap-4">
            {finalized.map((syllabus) => (
              <Card key={syllabus.id} className="border border-gray-100 bg-white shadow-sm">
                <View className="flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900">{syllabusTitle(syllabus)}</Text>
                    <Text className="mt-1 text-sm text-gray-500">Level {syllabus.target_level} • {syllabus.course_expertise_level}</Text>
                    <Text className="mt-1 text-sm text-gray-500">Version {syllabus.revision_history.length + 1}</Text>
                  </View>
                  <Button title="Open Roadmap" onPress={() => router.push(`/syllabus/${syllabus.id}/roadmap`)} />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="git-network-outline"
            title="Belum ada syllabus final"
            description="Finalize minimal satu syllabus agar roadmap karier bisa dibangun dari outcome pembelajaran yang sudah final."
          />
        )}
      </View>
    </ScrollView>
  );
}
