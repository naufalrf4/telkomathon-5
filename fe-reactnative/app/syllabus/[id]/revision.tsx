import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AlertBanner } from '../../../src/components/ui/AlertBanner';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { LoadingSpinner } from '../../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { SectionTabs } from '../../../src/components/ui/SectionTabs';
import { RevisionChat } from '../../../src/components/syllabus/RevisionChat';
import { useSyllabus } from '../../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../../src/services/api';
import { colors } from '../../../src/theme/colors';
import type { LearningJourneyStage } from '../../../src/types/api';

type WorkspaceTab = 'chat' | 'overview';

const HIGHLIGHT_DURATION_MS = 3000;
const ALL_REVISION_SECTIONS = [
  'tlo',
  'performance_result',
  'condition_result',
  'standard_result',
  'elos',
  'journey.pre_learning',
  'journey.classroom',
  'journey.after_learning',
] as const;

function useHighlightedSections() {
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const highlight = useCallback((sections: string[]) => {
    setHighlighted((prev) => {
      const next = new Set(prev);
      sections.forEach((section) => next.add(section));
      return next;
    });

    sections.forEach((section) => {
      const existing = timersRef.current.get(section);
      if (existing) {
        clearTimeout(existing);
      }

      const timer = setTimeout(() => {
        setHighlighted((prev) => {
          const next = new Set(prev);
          next.delete(section);
          return next;
        });
        timersRef.current.delete(section);
      }, HIGHLIGHT_DURATION_MS);

      timersRef.current.set(section, timer);
    });
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return { highlighted, highlight };
}

function JourneyStageCard({
  label,
  stage,
  isHighlighted,
}: {
  label: string;
  stage: LearningJourneyStage;
  isHighlighted: boolean;
}) {
  return (
    <View
      className={`rounded-lg border p-3 transition-colors ${
        isHighlighted ? 'border-brand-400 bg-brand-50' : 'border-neutral-200 bg-surface'
      }`}
    >
      <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">{label}</Text>
      <View className="gap-1.5">
        <Text className="text-sm text-neutral-700">
          <Text className="font-semibold">Durasi: </Text>
          {stage.duration || '—'}
        </Text>
        <Text className="text-sm text-neutral-700">
          <Text className="font-semibold">Metode: </Text>
          {stage.method.length > 0 ? stage.method.join(', ') : '—'}
        </Text>
        <Text className="text-sm leading-6 text-neutral-700">
          <Text className="font-semibold">Deskripsi: </Text>
          {stage.description || '—'}
        </Text>
        {stage.content.length > 0 ? (
          <View className="mt-1 gap-0.5">
            <Text className="text-xs font-semibold text-neutral-500">Konten:</Text>
            {stage.content.map((content, index) => (
              <Text key={`${label}-${index}`} className="text-sm leading-5 text-neutral-700">
                {`• ${content}`}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SyllabusPreview({
  syllabus,
  highlighted,
}: {
  syllabus: ReturnType<typeof useSyllabus>['syllabus'];
  highlighted: Set<string>;
}) {
  if (!syllabus) {
    return null;
  }

  const sectionClassName = (key: string) =>
    highlighted.has(key) ? 'border-brand-400 bg-brand-50' : 'border-neutral-200 bg-neutral-50';

  return (
    <ScrollView className="flex-1 min-h-0" showsVerticalScrollIndicator={false}>
      <View className="gap-5 p-1 pb-6">
        <Card className={`border-neutral-200 shadow-sm transition-colors ${sectionClassName('tlo')}`}>
          <Text className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">
            Tujuan Akhir Pembelajaran
          </Text>
          <Text className="text-sm leading-7 text-neutral-950">{syllabus.tlo}</Text>
        </Card>

        {(syllabus.performance_result || syllabus.condition_result || syllabus.standard_result) && (
          <Card className="gap-4 border-neutral-200 bg-surface shadow-sm">
            <Text className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">
              Kriteria Hasil Belajar
            </Text>
            {syllabus.performance_result ? (
              <View className={`rounded-xl border px-4 py-3.5 transition-colors ${sectionClassName('performance_result')}`}>
                <Text className="mb-1 text-xs font-semibold text-neutral-500">Target Performa</Text>
                <Text className="text-sm leading-6 text-neutral-950">{syllabus.performance_result}</Text>
              </View>
            ) : null}
            {syllabus.condition_result ? (
              <View className={`rounded-xl border px-4 py-3.5 transition-colors ${sectionClassName('condition_result')}`}>
                <Text className="mb-1 text-xs font-semibold text-neutral-500">Kondisi Belajar</Text>
                <Text className="text-sm leading-6 text-neutral-950">{syllabus.condition_result}</Text>
              </View>
            ) : null}
            {syllabus.standard_result ? (
              <View className={`rounded-xl border px-4 py-3.5 transition-colors ${sectionClassName('standard_result')}`}>
                <Text className="mb-1 text-xs font-semibold text-neutral-500">Standar Hasil</Text>
                <Text className="text-sm leading-6 text-neutral-950">{syllabus.standard_result}</Text>
              </View>
            ) : null}
          </Card>
        )}

        <Card className={`border-neutral-200 shadow-sm transition-colors ${sectionClassName('elos')}`}>
          <Text className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">
            Modul Belajar (ELO)
          </Text>
          <View className="gap-2">
            {syllabus.elos.map((elo, index) => (
              <View key={`${elo.elo}-${index}`} className="flex-row gap-3 rounded-xl border border-neutral-200 bg-surface px-3.5 py-3">
                <View className="mt-0.5 h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100">
                  <Text className="text-xs font-bold text-brand-700">{index + 1}</Text>
                </View>
                <Text className="flex-1 text-sm leading-6 text-neutral-950">{elo.elo}</Text>
              </View>
            ))}
          </View>
        </Card>

        {syllabus.journey ? (
          <Card className="gap-4 border-neutral-200 bg-surface shadow-sm">
            <Text className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">
              Perjalanan Belajar
            </Text>
            <JourneyStageCard
              label="Pra-Pembelajaran"
              stage={syllabus.journey.pre_learning}
              isHighlighted={highlighted.has('journey.pre_learning')}
            />
            <JourneyStageCard
              label="Kelas"
              stage={syllabus.journey.classroom}
              isHighlighted={highlighted.has('journey.classroom')}
            />
            <JourneyStageCard
              label="Pasca-Pembelajaran"
              stage={syllabus.journey.after_learning}
              isHighlighted={highlighted.has('journey.after_learning')}
            />
          </Card>
        ) : null}

        <View className="flex-row items-center gap-2 pb-2">
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text className="text-xs text-neutral-500">
            Versi {syllabus.revision_history.length + 1} — kurikulum aktif
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

export default function SyllabusRevisionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const syllabusId = id as string;

  const { syllabus, isLoading, error, refetch } = useSyllabus(syllabusId);
  const { highlighted, highlight } = useHighlightedSections();
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('chat');

  const handleRevisionAccepted = useCallback(
    (sections: string[]) => {
      const nextSections = sections.length > 0 ? sections : [...ALL_REVISION_SECTIONS];
      highlight(nextSections);
      setWorkspaceTab('overview');
    },
    [highlight],
  );

  if (isLoading && !syllabus) {
    return <LoadingSpinner fullScreen message="Memuat workspace revisi..." />;
  }

  if (error && !syllabus) {
    return (
      <ScrollView className="flex-1 bg-neutral-50">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <AlertBanner
            variant="error"
            title="Workspace revisi belum dapat dimuat"
            description={getErrorMessage(error, 'Coba buka ulang kurikulum yang ingin direvisi.')}
            action={{ label: 'Muat ulang', onPress: () => void refetch() }}
          />
        </View>
      </ScrollView>
    );
  }

  if (!syllabus) {
    return <LoadingSpinner fullScreen message="Menyiapkan workspace revisi..." />;
  }

  return (
    <View className="flex-1 bg-neutral-50">
      <View className="px-4 pt-4 lg:px-8 lg:pt-6">
        <PageHeader
          eyebrow="Revisi"
          title="Revisi kurikulum dengan chat"
          actions={
            <Button
              title="Kembali"
              variant="ghost"
              onPress={() => router.push(`/syllabus/${syllabusId}`)}
              icon={<Ionicons name="arrow-back" size={18} color={colors.textSecondary} />}
            />
          }
        />
      </View>

      <View className="flex-1 min-h-0 px-4 pb-4 lg:px-8 lg:pb-6">
        <Card className="flex-1 min-h-0 overflow-hidden border-neutral-300 bg-surface p-0 shadow-sm">
          <View className="shrink-0 border-b border-neutral-200 px-4 py-4 lg:px-6">
            <View className="flex-row items-center justify-between gap-3">
              <SectionTabs
                value={workspaceTab}
                onChange={setWorkspaceTab}
                items={[
                  { value: 'chat', label: 'Chat revisi' },
                  { value: 'overview', label: 'Pratinjau kurikulum' },
                ]}
              />
            </View>
          </View>

          <View className="flex-1 min-h-0 bg-surface p-4 lg:p-6">
            {workspaceTab === 'overview' ? (
              <SyllabusPreview syllabus={syllabus} highlighted={highlighted} />
            ) : (
              <RevisionChat
                syllabusId={syllabusId}
                syllabus={syllabus}
                onRevisionAccepted={handleRevisionAccepted}
              />
            )}
          </View>
        </Card>
      </View>
    </View>
  );
}
