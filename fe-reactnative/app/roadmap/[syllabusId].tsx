import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { GapInputCard } from '../../src/components/personalize/GapInputCard';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { useRoadmap } from '../../src/hooks/useRoadmap';
import type { CompetencyGap } from '../../src/types/api';
import { getErrorMessage } from '../../src/services/api';

export default function RoadmapScreen() {
  const params = useLocalSearchParams<{ syllabusId?: string; id?: string }>();
  const syllabusId = (params.syllabusId ?? params.id) as string | undefined;
  const router = useRouter();
  const { syllabus } = useSyllabus(syllabusId as string);
  const { roadmaps, isLoading, error, createRoadmapAsync, isCreatingRoadmap } = useRoadmap(syllabusId as string);

  const [participantName, setParticipantName] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('12');
  const [gaps, setGaps] = useState<CompetencyGap[]>([
    { skill: '', current_level: 1, required_level: 3, gap_description: '' },
  ]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentVersion = useMemo(() => (syllabus?.revision_history.length ?? 0) + 1, [syllabus]);

  const addGap = () => {
    setGaps((prev) => [...prev, { skill: '', current_level: 1, required_level: 3, gap_description: '' }]);
  };

  const removeGap = (index: number) => {
    setGaps((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const updateGap = (index: number, field: keyof CompetencyGap, value: string | number) => {
    setGaps((prev) => prev.map((gap, i) => {
      if (i !== index) return gap;
      return {
        ...gap,
        [field]: field === 'current_level' || field === 'required_level' ? Number(value) : String(value),
      } as CompetencyGap;
    }));
  };

  const handleGenerate = async () => {
    const validGaps = gaps.filter((gap) => gap.skill.trim());
    if (!participantName.trim() || !currentRole.trim() || !targetRole.trim()) {
      setSubmitError('Nama peserta, current role, dan target role wajib diisi.');
      return;
    }
    if (validGaps.length === 0) {
      setSubmitError('Tambahkan minimal satu competency gap yang valid.');
      return;
    }
    setSubmitError(null);
    await createRoadmapAsync({
      participant_name: participantName.trim(),
      current_role: currentRole.trim(),
      target_role: targetRole.trim(),
      time_horizon_weeks: Number.parseInt(timeHorizon, 10) || 12,
      competency_gaps: validGaps,
    });
  };

  if (isLoading && !roadmaps) {
    return <LoadingSpinner fullScreen message="Memuat roadmap karier..." />;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl p-4 lg:p-8 gap-6">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-gray-900">Career Roadmap</Text>
            <Text className="mt-1 text-gray-500">Bangun roadmap karier berbasis syllabus final, gap kompetensi, dan target peran.</Text>
          </View>
          <Button title="Kembali" variant="ghost" onPress={() => router.back()} />
        </View>

        <Card className="border border-gray-100 bg-white shadow-sm">
          <View className="gap-2">
            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Syllabus Context</Text>
            <Text className="text-lg font-semibold text-gray-900">{syllabus?.course_title || syllabus?.topic || 'Syllabus final'}</Text>
            <Text className="text-sm text-gray-500">Version aktif: {currentVersion}</Text>
            <Text className="text-sm text-gray-500">TLO: {syllabus?.tlo || 'Belum tersedia'}</Text>
          </View>
        </Card>

        {error ? (
          <Card className="border border-red-200 bg-red-50">
            <Text className="text-sm text-red-700">{getErrorMessage(error, 'Roadmap belum dapat dimuat.')}</Text>
          </Card>
        ) : null}

        <Card className="border border-gray-100 bg-white shadow-sm">
          <View className="gap-4">
            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Generate Roadmap</Text>
            <Field label="Nama Peserta *" value={participantName} onChangeText={setParticipantName} placeholder="contoh: Aulia Rahman" />
            <View className="flex-col gap-4 lg:flex-row">
              <View className="flex-1">
                <Field label="Current Role *" value={currentRole} onChangeText={setCurrentRole} placeholder="contoh: Junior Analyst" />
              </View>
              <View className="flex-1">
                <Field label="Target Role *" value={targetRole} onChangeText={setTargetRole} placeholder="contoh: ML Analyst" />
              </View>
              <View className="w-full lg:w-48">
                <Field label="Time Horizon (weeks)" value={timeHorizon} onChangeText={setTimeHorizon} placeholder="12" keyboardType="numeric" />
              </View>
            </View>

            <View className="gap-3">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Competency Gaps</Text>
              {gaps.map((gap, index) => (
                <GapInputCard
                  key={index}
                  gap={gap}
                  index={index}
                  onUpdate={(field, value) => updateGap(index, field, value)}
                  onRemove={() => removeGap(index)}
                  canRemove={gaps.length > 1}
                />
              ))}
            </View>

            {submitError ? <Text className="text-sm text-red-600">{submitError}</Text> : null}

            <View className="flex-col gap-3 md:flex-row">
              <Button
                title="Tambah Gap"
                variant="outline"
                onPress={addGap}
                className="flex-1 border-dashed border-gray-300 py-3"
                icon={<Ionicons name="add" size={18} color="#CC0000" />}
              />
              <Button
                title="Generate Roadmap"
                onPress={() => void handleGenerate()}
                isLoading={isCreatingRoadmap}
                className="flex-[2] py-3"
                icon={<Ionicons name="git-network-outline" size={18} color="white" />}
              />
            </View>
          </View>
        </Card>

        <View className="gap-4">
          <Text className="text-xl font-bold text-gray-900">Roadmap Runs</Text>
          {roadmaps && roadmaps.length > 0 ? (
            roadmaps.map((roadmap) => (
              <Card key={roadmap.id} className="border border-gray-100 bg-white shadow-sm">
                <View className="gap-4">
                  <View className="flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <View>
                      <Text className="text-lg font-semibold text-gray-900">{roadmap.participant_name}</Text>
                      <Text className="text-sm text-gray-500">{roadmap.current_role} → {roadmap.target_role} • {roadmap.time_horizon_weeks} minggu • Version {roadmap.revision_index + 1}</Text>
                    </View>
                    <Text className="text-xs uppercase tracking-wide text-gray-400">{new Date(roadmap.created_at).toLocaleString('id-ID')}</Text>
                  </View>
                  <View className="gap-3">
                    {roadmap.milestones.map((milestone, index) => (
                      <View key={`${roadmap.id}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <Text className="font-semibold text-gray-900">{milestone.phase_title}</Text>
                        <Text className="mt-1 text-sm text-gray-500">{milestone.timeframe}</Text>
                        <Text className="mt-3 text-sm text-gray-700">{milestone.objective}</Text>
                        <ListSection label="Focus Modules" items={milestone.focus_modules} />
                        <ListSection label="Activities" items={milestone.activities} />
                        <View className="mt-3 rounded-lg bg-white p-3 border border-gray-100">
                          <Text className="text-xs font-bold uppercase tracking-wide text-gray-400">Success Indicator</Text>
                          <Text className="mt-1 text-sm text-gray-700">{milestone.success_indicator}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              icon="git-network-outline"
              title="Belum ada career roadmap"
              description="Generate roadmap pertama dari syllabus final ini untuk memetakan langkah pengembangan karier peserta."
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'numeric'; }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900"
      />
    </View>
  );
}

function ListSection({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View className="mt-3 gap-2">
      <Text className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</Text>
      {items.map((item, index) => (
        <View key={`${label}-${index}`} className="flex-row items-start">
          <View className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          <Text className="flex-1 text-sm leading-5 text-gray-700">{item}</Text>
        </View>
      ))}
    </View>
  );
}
