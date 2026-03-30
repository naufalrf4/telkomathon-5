import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import { colors } from '../../src/theme/colors';

export default function ModuleDecompositionScreen() {
  const { syllabusId } = useLocalSearchParams();
  const router = useRouter();
  const { modules, syllabus, revisions, isLoading, error, decomposeAsync, isDecomposing } = useSyllabus(syllabusId as string, {
    includeModules: true,
    includeRevisions: true,
  });
  const currentRevisionNumber = (syllabus?.revision_history.length ?? 0) + 1;
  const currentRevision = revisions?.find((item) => item.is_current) ?? null;

  const handleGenerate = async () => {
    await decomposeAsync(undefined);
  };

  if (isLoading && !modules && !syllabus) {
    return <LoadingSpinner fullScreen message="Memuat module decomposition..." />;
  }

  if (error && !syllabus) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="mx-auto w-full max-w-4xl p-6">
          <Card className="border border-red-200 bg-red-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-red-700">Gagal memuat module decomposition</Text>
              <Text className="text-red-700">{getErrorMessage(error, 'Data modul belum dapat dimuat.')}</Text>
              <Button title="Kembali" onPress={() => router.back()} />
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl p-4 lg:p-8 gap-6">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-gray-900">Module Decomposition</Text>
            <Text className="mt-1 text-gray-500">Turunan modul final dari syllabus yang sudah finalized.</Text>
          </View>
          <View className="flex-row gap-3">
            <Button title="Kembali" variant="ghost" onPress={() => router.back()} />
            <Button title={modules?.length ? 'Generate Ulang' : 'Generate Modules'} isLoading={isDecomposing} onPress={() => void handleGenerate()} icon={<Ionicons name="layers-outline" size={18} color="white" />} />
          </View>
        </View>

        <Card className="border border-gray-100 bg-white shadow-sm">
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Syllabus Context</Text>
            <Text className="text-lg font-semibold text-gray-900">{syllabus?.course_title || syllabus?.topic || 'Syllabus terpilih'}</Text>
            <Text className="text-sm text-gray-500">TLO: {syllabus?.tlo || 'Belum tersedia'}</Text>
            <Text className="text-sm text-gray-500">Current revision: Version {currentRevisionNumber}</Text>
          </View>
        </Card>

        {currentRevision && currentRevision.downstream.module_generation_count === 0 ? (
          <Card className="border border-amber-200 bg-amber-50">
            <Text className="font-semibold text-amber-700">Modules belum sinkron dengan revision terbaru</Text>
            <Text className="mt-1 text-sm text-amber-700">Revision aktif belum punya event decomposition. Generate modules agar breakdown mengikuti syllabus final terbaru.</Text>
          </Card>
        ) : null}

        {modules && modules.length > 0 ? (
          <View className="gap-4">
            {modules.map((module) => (
              <Card key={module.id} className="border border-gray-100 bg-white shadow-sm">
                <View className="gap-4">
                  <View className="flex-row items-center justify-between gap-4">
                    <View className="flex-1">
                      <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Modul {module.module_index + 1}</Text>
                      <Text className="text-xl font-bold text-gray-900">{module.title}</Text>
                    </View>
                    <View className="rounded-full bg-indigo-50 px-3 py-1">
                      <Text className="text-xs font-semibold text-indigo-700">~{module.duration_minutes} menit</Text>
                    </View>
                  </View>

                  <Text className="text-sm leading-6 text-gray-700">{module.description}</Text>

                  <View className="grid gap-4 lg:grid-cols-3">
                    <ModuleList title="Learning Objectives" items={module.learning_objectives} />
                    <ModuleList title="Topics" items={module.topics} />
                    <ModuleList title="Assessment Criteria" items={module.assessment.criteria} />
                  </View>

                  <View className="gap-2">
                    <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Activities</Text>
                    {module.activities.map((activity, idx) => (
                      <View key={`${module.id}-${idx}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <Text className="text-sm font-semibold text-gray-800">{activity.description}</Text>
                        <Text className="mt-1 text-xs uppercase tracking-wide text-gray-400">{activity.type} • {activity.duration_minutes} menit</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState
            icon="layers-outline"
            title="Belum ada module decomposition"
            description="Generate module decomposition dari syllabus final untuk melihat breakdown modul yang diturunkan dari learning journey dan ELO."
            action={{ label: 'Generate Modules', onPress: () => void handleGenerate() }}
          />
        )}
      </View>
    </ScrollView>
  );
}

function ModuleList({ title, items }: { title: string; items: string[] }) {
  return (
    <View className="gap-2 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{title}</Text>
      {items.length > 0 ? (
        items.map((item, idx) => (
          <View key={`${title}-${idx}`} className="flex-row items-start">
            <View className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            <Text className="flex-1 text-sm leading-5 text-gray-700">{item}</Text>
          </View>
        ))
      ) : (
        <Text className="text-sm italic text-gray-400">Belum ada data</Text>
      )}
    </View>
  );
}
