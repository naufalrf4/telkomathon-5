import { View, Text } from 'react-native';
import { Card } from '../ui/Card';
import type { Syllabus, ELO, LearningJourneyStage } from '../../types/api';

const SECTION_LABELS: Record<string, string> = {
  tlo: 'Tujuan Akhir Pembelajaran (TLO)',
  performance_result: 'Performance (PCS)',
  condition_result: 'Condition (PCS)',
  standard_result: 'Standard (PCS)',
  elos: 'Modul Belajar (ELO)',
  'journey.pre_learning': 'Tahap Pra-Pembelajaran',
  'journey.classroom': 'Tahap Kelas',
  'journey.after_learning': 'Tahap Pasca-Pembelajaran',
};

interface SectionDiffProps {
  currentSyllabus: Syllabus;
  proposedChanges: Record<string, unknown>;
}

function isEloArray(value: unknown): value is ELO[] {
  return (
    Array.isArray(value) &&
    (value.length === 0 || (typeof (value[0] as Record<string, unknown>)?.elo === 'string'))
  );
}

function isJourneyStage(value: unknown): value is LearningJourneyStage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return 'duration' in v || 'method' in v || 'description' in v || 'content' in v;
}

function StringDiff({ current, proposed }: { current: string; proposed: string }) {
  return (
    <View className="gap-2">
      <View className="rounded-lg bg-red-50 px-3 py-2.5">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Saat ini</Text>
        <Text className="text-sm leading-6 text-neutral-600">{current || '—'}</Text>
      </View>
      <View className="rounded-lg bg-emerald-50 px-3 py-2.5">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Diusulkan</Text>
        <Text className="text-sm leading-6 text-neutral-950">{proposed as string}</Text>
      </View>
    </View>
  );
}

function EloDiff({ current, proposed }: { current: ELO[]; proposed: ELO[] }) {
  return (
    <View className="gap-2">
      <View className="rounded-lg bg-red-50 px-3 py-2.5">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Saat ini</Text>
        {current.length === 0 ? (
          <Text className="text-sm text-neutral-600">—</Text>
        ) : (
          current.map((elo, i) => (
            <Text key={i} className="text-sm leading-6 text-neutral-600">
              {`${i + 1}. ${elo.elo}`}
            </Text>
          ))
        )}
      </View>
      <View className="rounded-lg bg-emerald-50 px-3 py-2.5">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Diusulkan</Text>
        {proposed.length === 0 ? (
          <Text className="text-sm text-neutral-950">—</Text>
        ) : (
          proposed.map((elo, i) => (
            <Text key={i} className="text-sm leading-6 text-neutral-950">
              {`${i + 1}. ${elo.elo}`}
            </Text>
          ))
        )}
      </View>
    </View>
  );
}

function JourneyStageDiff({
  current,
  proposed,
}: {
  current: LearningJourneyStage | null;
  proposed: LearningJourneyStage;
}) {
  return (
    <View className="gap-2">
      <View className="rounded-lg bg-red-50 px-3 py-2.5">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">Saat ini</Text>
        {current ? (
          <View className="gap-1">
            <Text className="text-sm leading-6 text-neutral-600">
              <Text className="font-semibold">Durasi: </Text>
              {current.duration}
            </Text>
            <Text className="text-sm leading-6 text-neutral-600">
              <Text className="font-semibold">Metode: </Text>
              {current.method.join(', ')}
            </Text>
            <Text className="text-sm leading-6 text-neutral-600">
              <Text className="font-semibold">Deskripsi: </Text>
              {current.description}
            </Text>
            <Text className="text-sm leading-6 text-neutral-600">
              <Text className="font-semibold">Konten: </Text>
              {current.content.join('; ')}
            </Text>
          </View>
        ) : (
          <Text className="text-sm text-neutral-600">—</Text>
        )}
      </View>
      <View className="rounded-lg bg-emerald-50 px-3 py-2.5">
        <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Diusulkan</Text>
        <View className="gap-1">
          <Text className="text-sm leading-6 text-neutral-950">
            <Text className="font-semibold">Durasi: </Text>
            {proposed.duration}
          </Text>
          <Text className="text-sm leading-6 text-neutral-950">
            <Text className="font-semibold">Metode: </Text>
            {Array.isArray(proposed.method) ? proposed.method.join(', ') : String(proposed.method)}
          </Text>
          <Text className="text-sm leading-6 text-neutral-950">
            <Text className="font-semibold">Deskripsi: </Text>
            {proposed.description}
          </Text>
          <Text className="text-sm leading-6 text-neutral-950">
            <Text className="font-semibold">Konten: </Text>
            {Array.isArray(proposed.content) ? proposed.content.join('; ') : String(proposed.content)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SectionDiff({ currentSyllabus, proposedChanges }: SectionDiffProps) {
  const entries = Object.entries(proposedChanges);

  if (entries.length === 0) {
    return null;
  }

  return (
    <View className="gap-3">
      {entries.map(([key, proposedValue]) => {
        const label = SECTION_LABELS[key] ?? key;

        // Handle ELOs
        if (key === 'elos' && isEloArray(proposedValue)) {
          return (
            <Card key={key} className="border-neutral-200 bg-neutral-50 p-4">
              <Text className="mb-2 text-sm font-bold text-neutral-800">{label}</Text>
              <EloDiff current={currentSyllabus.elos} proposed={proposedValue} />
            </Card>
          );
        }

        // Handle journey stages
        if (key.startsWith('journey.')) {
          const stageKey = key.replace('journey.', '') as keyof typeof currentSyllabus.journey;
          const currentStage = currentSyllabus.journey?.[stageKey] ?? null;

          if (isJourneyStage(proposedValue)) {
            return (
              <Card key={key} className="border-neutral-200 bg-neutral-50 p-4">
                <Text className="mb-2 text-sm font-bold text-neutral-800">{label}</Text>
                <JourneyStageDiff current={currentStage} proposed={proposedValue} />
              </Card>
            );
          }
        }

        // Handle plain string fields
        if (typeof proposedValue === 'string') {
          const currentValue = String(currentSyllabus[key as keyof Syllabus] ?? '');
          return (
            <Card key={key} className="border-neutral-200 bg-neutral-50 p-4">
              <Text className="mb-2 text-sm font-bold text-neutral-800">{label}</Text>
              <StringDiff current={currentValue} proposed={proposedValue} />
            </Card>
          );
        }

        return null;
      })}
    </View>
  );
}
