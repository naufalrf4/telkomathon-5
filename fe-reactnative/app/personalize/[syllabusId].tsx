import { View, Text, ScrollView } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
import { AlertBanner } from '../../src/components/ui/AlertBanner';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { GapInputCard } from '../../src/components/personalize/GapInputCard';
import { RecommendationCard } from '../../src/components/personalize/RecommendationCard';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { TextField } from '../../src/components/ui/TextField';
import { Ionicons } from '@expo/vector-icons';
import { CompetencyGap, PersonalizationResult, LearningRecommendation } from '../../src/types/api';
import { colors } from '../../src/theme/colors';
import { getErrorMessage } from '../../src/services/api';

// Helper to filter/group recommendations
const groupRecommendations = (recommendations: LearningRecommendation[]) => {
  const getPriorityLabel = (p: number | string) => {
    if (p === 1 || p === 'High') return 'High';
    if (p === 2 || p === 'Medium') return 'Medium';
    return 'Low';
  };

  const grouped: Record<string, LearningRecommendation[]> = {
    High: [],
    Medium: [],
    Low: []
  };

  recommendations.forEach(r => {
    const label = getPriorityLabel(r.priority);
    if (grouped[label]) {
      grouped[label].push(r);
    }
  });

  return grouped;
};

type GapFormState = CompetencyGap & { id: string };

function createGap(): GapFormState {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    skill: '',
    current_level: 1,
    required_level: 3,
    gap_description: '',
  };
}

export default function PersonalizeScreen() {
  const { syllabusId } = useLocalSearchParams();
  const router = useRouter();
  const { personalize, isPersonalizing, isLoadingPersonalization, personalization, clearPersonalization, syllabus } = useSyllabus(syllabusId as string, {
    includePersonalization: true,
  });

  const [gaps, setGaps] = useState<GapFormState[]>([createGap()]);
  const [participantName, setParticipantName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const addGap = () => {
    setGaps([...gaps, createGap()]);
  };

  const removeGap = (id: string) => {
    if (gaps.length > 1) {
      setGaps(gaps.filter((gap) => gap.id !== id));
    }
  };

  const updateGap = (id: string, field: keyof CompetencyGap, value: string | number) => {
    const newGaps = [...gaps];
    const index = newGaps.findIndex((gap) => gap.id === id);
    if (index < 0) {
      return;
    }
    const gap = { ...newGaps[index] };
    
    if (field === 'current_level') {
      gap.current_level = Number(value);
    } else if (field === 'required_level') {
      gap.required_level = Number(value);
    } else if (field === 'skill') {
      gap.skill = String(value);
    } else if (field === 'gap_description') {
      gap.gap_description = String(value);
    }
    
    newGaps[index] = gap;
    setGaps(newGaps);
  };

  const handleSubmit = () => {
    setSubmitError(null);
    setFormError(null);
    if (!participantName.trim()) {
      setFormError('Isi nama peserta terlebih dahulu.');
      return;
    }
    const validGaps = gaps.filter(g => g.skill.trim() !== '');
    if (validGaps.length === 0) {
      setFormError('Tambahkan minimal satu kesenjangan kemampuan.');
      return;
    }
    personalize(
      { participantName: participantName.trim(), gaps: validGaps.map(({ id: _id, ...gap }) => gap) },
      {
        onError: (error) => {
          setSubmitError(getErrorMessage(error, 'Personalisasi belum berhasil dibuat.'));
        },
      }
    );
  };

  if (isLoadingPersonalization) {
    return <LoadingSpinner fullScreen message="Memuat hasil personalisasi..." />;
  }

  if (personalization) {
    return (
      <PersonalizationResultView
        result={personalization}
        currentRevisionIndex={syllabus?.revision_history.length ?? 0}
        onBack={() => router.push(`/personalize?syllabusId=${syllabusId}`)}
        onReset={() => {
          clearPersonalization();
          setSubmitError(null);
          setFormError(null);
          setParticipantName('');
          setGaps([createGap()]);
        }}
      />
    );
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50">
      <View className="max-w-4xl mx-auto w-full p-6">
        <PageHeader
          eyebrow="Langkah 3A"
          title="Buat rekomendasi untuk satu peserta"
          description="Masukkan nama peserta dan kesenjangan kemampuan, lalu buat rekomendasi belajar yang sesuai dengan kurikulum final ini."
          actions={<Button title="Kembali" variant="ghost" onPress={() => router.push(`/personalize?syllabusId=${syllabusId}`)} icon={<Ionicons name="arrow-back" size={18} color={colors.textSecondary} />} />}
        />

          <Card className="mb-6 mt-6 border border-indigo-100 bg-indigo-50">
          <View className="flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <View className="flex-1">
              <Text className="font-semibold text-indigo-900">Perlu memproses banyak peserta?</Text>
              <Text className="mt-1 text-sm text-indigo-700">Pindah ke mode multi-user untuk upload atau paste CSV dalam satu batch.</Text>
            </View>
            <Button
              title="Buka multi-user"
              variant="outline"
              onPress={() => router.push(`/personalize/${syllabusId}/bulk`)}
              icon={<Ionicons name="people-outline" size={18} color={colors.textSecondary} />}
            />
          </View>
          </Card>

          {formError ? <AlertBanner variant="warning" title="Lengkapi data terlebih dahulu" description={formError} /> : null}
          {submitError ? <AlertBanner variant="error" title="Personalisasi belum berhasil dibuat" description={submitError} /> : null}

          <View className="space-y-6 mt-6">
          <Card className="border border-neutral-300 bg-surface shadow-sm rounded-xl">
            <TextField
              label="Nama peserta"
              required
              hint="Gunakan nama yang mudah dikenali agar hasil tersimpan dengan jelas."
              placeholder="Contoh: Aulia Rahman"
              value={participantName}
              onChangeText={setParticipantName}
            />
          </Card>

          {gaps.map((gap, index) => (
            <GapInputCard
              key={gap.id}
              gap={gap}
              index={index}
              onUpdate={(field, value) => updateGap(gap.id, field, value)}
              onRemove={() => removeGap(gap.id)}
              canRemove={gaps.length > 1}
            />
          ))}

          <View className="flex-col md:flex-row gap-4 mt-6">
            <Button
              title="Tambah Kesenjangan"
              variant="outline"
              onPress={addGap}
              className="flex-1 border-dashed border-neutral-300 py-3"
              icon={<Ionicons name="add" size={18} color={colors.primary} />}
            />
            <Button
              title="Buat rekomendasi"
              onPress={handleSubmit}
              isLoading={isPersonalizing}
              size="lg"
              className="flex-[2] py-3 shadow-md"
              icon={<Ionicons name="analytics" size={18} color="white" />}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function PersonalizationResultView({ result, currentRevisionIndex, onBack, onReset }: { result: PersonalizationResult, currentRevisionIndex: number, onBack: () => void, onReset: () => void }) {
  const grouped = groupRecommendations(result.recommendations);
  const isOutdated = result.revision_index !== currentRevisionIndex;
  
  const getPriorityText = (priority: string) => {
    if (priority === 'High') return 'Prioritas Tinggi';
    if (priority === 'Medium') return 'Prioritas Sedang';
    return 'Prioritas Rendah';
  };

  return (
    <ScrollView className="flex-1 bg-neutral-50">
        <View className="max-w-5xl mx-auto w-full p-6">
          <PageHeader
            eyebrow="Hasil"
            title="Rekomendasi belajar siap dipakai"
            description={`Peserta: ${result.participant_name || 'Tanpa nama peserta'}`}
            actions={(
              <>
                <Button variant="ghost" title="Kembali" onPress={onBack} icon={<Ionicons name="arrow-back" size={18} color={colors.textSecondary} />} />
                <Button variant="outline" title="Buat lagi" onPress={onReset} />
              </>
            )}
          />

        <View className="mt-6">
          <AlertBanner
            variant={isOutdated ? 'warning' : 'success'}
            title={isOutdated ? 'Hasil ini dibuat dari versi kurikulum sebelumnya' : 'Hasil ini sudah sesuai dengan versi kurikulum terbaru'}
            description={`Dibuat dari versi ${result.revision_index + 1}. Versi aktif saat ini: ${currentRevisionIndex + 1}.`}
          />
        </View>

        {Object.entries(grouped).map(([priority, items]) => (
          items.length > 0 && (
            <View key={priority} className="mb-8">
                <View className={`mb-4 self-start rounded-lg px-3 py-1.5 flex-row items-center
                  ${priority === 'High' ? 'bg-primary-50 border border-primary-100' : 
                    priority === 'Medium' ? 'bg-yellow-50 border border-yellow-100' : 
                    'bg-blue-50 border border-blue-100'}`}>
                <View className={`w-2 h-2 rounded-full mr-2 
                  ${priority === 'High' ? 'bg-primary-600' : priority === 'Medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                <Text className={`font-bold text-sm uppercase tracking-wide
                  ${priority === 'High' ? 'text-primary-700' : priority === 'Medium' ? 'text-yellow-700' : 'text-blue-700'}`}>
                  {getPriorityText(priority)}
                </Text>
              </View>
              
              <View className="flex-row flex-wrap -mx-2">
                {items.map((item, idx) => (
                  <View key={idx} className="w-full md:w-1/2 px-2">
                    <RecommendationCard recommendation={item} />
                  </View>
                ))}
              </View>
            </View>
          )
        ))}
      </View>
    </ScrollView>
  );
}
