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
    const normalizedGaps = gaps
      .map(({ id: _id, ...gap }) => ({
        ...gap,
        skill: gap.skill.trim(),
        gap_description: gap.gap_description.trim(),
      }))
      .filter((gap) => gap.skill || gap.gap_description);

    if (normalizedGaps.length === 0) {
      setFormError('Tambahkan minimal satu kesenjangan kemampuan.');
      return;
    }

    const incompleteGap = normalizedGaps.find((gap) => !gap.skill);
    if (incompleteGap) {
      setFormError('Lengkapi nama kemampuan pada setiap kesenjangan yang ingin dianalisis.');
      return;
    }

    const invalidLevelGap = normalizedGaps.find(
      (gap) =>
        gap.current_level < 1 ||
        gap.current_level > 5 ||
        gap.required_level < 1 ||
        gap.required_level > 5 ||
        gap.required_level < gap.current_level,
    );
    if (invalidLevelGap) {
      setFormError('Pastikan level target tidak lebih rendah dari level saat ini.');
      return;
    }

    const validGaps = normalizedGaps.map((gap) => ({
      ...gap,
      gap_description:
        gap.gap_description ||
        `Butuh peningkatan ${gap.skill} dari level ${gap.current_level} ke level ${gap.required_level}.`,
    }));

    personalize(
      { participantName: participantName.trim(), gaps: validGaps },
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

// ── Priority section meta ───────────────────────────────────────────────────
const PRIORITY_META: Record<string, { label: string; borderColor: string; bg: string; textColor: string; dotColor: string }> = {
  High:   { label: 'Prioritas Tinggi',  borderColor: '#DC2626', bg: '#FEF2F2', textColor: '#991B1B', dotColor: '#DC2626' },
  Medium: { label: 'Prioritas Sedang',  borderColor: '#D97706', bg: '#FFFBEB', textColor: '#92400E', dotColor: '#D97706' },
  Low:    { label: 'Prioritas Rendah',  borderColor: '#2563EB', bg: '#EFF6FF', textColor: '#1E3A8A', dotColor: '#2563EB' },
};

function PersonalizationResultView({ result, currentRevisionIndex, onBack, onReset }: { result: PersonalizationResult, currentRevisionIndex: number, onBack: () => void, onReset: () => void }) {
  const grouped = groupRecommendations(result.recommendations);
  const isOutdated = result.revision_index !== currentRevisionIndex;

  const totalRecs = result.recommendations.length;
  const totalMinutes = result.recommendations.reduce((sum, r) => sum + (r.estimated_duration_minutes ?? 0), 0);

  return (
    <ScrollView className="flex-1 bg-neutral-50">
      <View className="max-w-5xl mx-auto w-full px-4 pb-10 pt-6 lg:px-6">

        {/* ── Header bar ──────────────────────────────────────────── */}
        <View className="mb-6 flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-widest text-neutral-500 mb-1">Hasil</Text>
            <Text className="text-2xl font-bold leading-tight text-neutral-950">
              Rekomendasi belajar siap dipakai
            </Text>
            <View className="mt-1.5 flex-row items-center gap-1.5">
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text className="text-sm text-neutral-600">
                {result.participant_name || 'Tanpa nama peserta'}
              </Text>
            </View>
          </View>
          {/* Actions — right-aligned, compact */}
          <View className="flex-row items-center gap-2 pt-1">
            <Button
              variant="ghost"
              title="Kembali"
              onPress={onBack}
              icon={<Ionicons name="arrow-back" size={18} color={colors.textSecondary} />}
            />
            <Button variant="outline" title="Buat lagi" onPress={onReset} />
          </View>
        </View>

        {/* ── Revision status banner ───────────────────────────────── */}
        <AlertBanner
          variant={isOutdated ? 'warning' : 'success'}
          title={isOutdated ? 'Hasil ini dibuat dari versi kurikulum sebelumnya' : 'Hasil ini sudah sesuai dengan versi kurikulum terbaru'}
          description={`Dibuat dari versi ${result.revision_index + 1}. Versi aktif saat ini: ${currentRevisionIndex + 1}.`}
        />

        {/* ── Summary stat chips ───────────────────────────────────── */}
        <View className="mt-5 mb-8 flex-row gap-3">
          <View
            className="flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
            <Text className="text-sm font-semibold text-neutral-700">{totalRecs} rekomendasi</Text>
          </View>
          <View
            className="flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: colors.neutral[100], borderWidth: 1, borderColor: colors.border }}
          >
            <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
            <Text className="text-sm font-semibold text-neutral-700">±{totalMinutes} menit</Text>
          </View>
        </View>

        {/* ── Priority groups ──────────────────────────────────────── */}
        {Object.entries(grouped).map(([priority, items]) => {
          if (items.length === 0) return null;
          const meta = PRIORITY_META[priority] ?? PRIORITY_META.Low;
          const groupMinutes = items.reduce((sum, r) => sum + (r.estimated_duration_minutes ?? 0), 0);

          return (
            <View key={priority} className="mb-10">

              {/* Section heading row */}
              <View
                className="mb-5 flex-row items-center justify-between rounded-xl px-4 py-3"
                style={{
                  backgroundColor: meta.bg,
                  borderLeftWidth: 4,
                  borderLeftColor: meta.borderColor,
                  borderWidth: 1,
                  borderColor: meta.borderColor + '30',
                }}
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: meta.dotColor }}
                  />
                  <Text className="font-bold text-sm uppercase tracking-widest" style={{ color: meta.textColor }}>
                    {meta.label}
                  </Text>
                  {/* Count chip */}
                  <View
                    className="rounded-full px-2 py-0.5"
                    style={{ backgroundColor: meta.borderColor + '20' }}
                  >
                    <Text className="text-xs font-bold" style={{ color: meta.dotColor }}>
                      {items.length}
                    </Text>
                  </View>
                </View>
                {/* Group duration hint */}
                <View className="flex-row items-center gap-1">
                  <Ionicons name="time-outline" size={12} color={meta.dotColor} />
                  <Text className="text-xs font-medium" style={{ color: meta.textColor }}>±{groupMinutes} mnt</Text>
                </View>
              </View>

              {/* Recommendation grid: 3-col on lg, 2-col on md, 1-col on small */}
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -8 }}>
                {items.map((item, idx) => (
                  <View key={idx} className="w-full md:w-1/2 lg:w-1/3" style={{ paddingHorizontal: 8 }}>
                    <RecommendationCard
                      recommendation={item}
                      priorityLabel={priority as 'High' | 'Medium' | 'Low'}
                    />
                  </View>
                ))}
              </View>

            </View>
          );
        })}

      </View>
    </ScrollView>
  );
}
