import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { AlertBanner } from '../../src/components/ui/AlertBanner';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import type { BulkParticipantInput, CompetencyGap, PersonalizationResult } from '../../src/types/api';
import { colors } from '../../src/theme/colors';

type CsvRow = {
  participant_name: string;
  skill: string;
  current_level: string;
  required_level: string;
  gap_description: string;
};

type BulkRunGroup = {
  bulkSessionId: string;
  createdAt: string;
  revisionIndex: number;
  results: PersonalizationResult[];
};

const CSV_HEADERS = ['participant_name', 'skill', 'current_level', 'required_level', 'gap_description'];

export default function BulkRecommendationScreen() {
  const params = useLocalSearchParams();
  const syllabusId = (params.syllabusId ?? params.id) as string | undefined;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvText, setCsvText] = useState('participant_name,skill,current_level,required_level,gap_description');
  const [parseError, setParseError] = useState<string | null>(null);

  const {
    syllabus,
    bulkPersonalizeAsync,
    isBulkPersonalizing,
    bulkPersonalizations,
    isLoading,
    error,
  } = useSyllabus(syllabusId as string, {
    includeBulkPersonalization: true,
  });
  const currentRevisionIndex = syllabus?.revision_history.length ?? 0;

  const parsedParticipants = useMemo(() => parseBulkCsv(csvText), [csvText]);
  const runs = useMemo(() => groupBulkRuns(bulkPersonalizations ?? []), [bulkPersonalizations]);

  const handleUploadCsv = () => {
    if (Platform.OS !== 'web') {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleWebInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setParseError(null);
    event.target.value = '';
  };

  const handleGenerate = async () => {
    try {
      const headerError = validateCsvHeaders(csvText);
      if (headerError) {
        setParseError(headerError);
        return;
      }
      const participants = parseBulkCsv(csvText);
      if (participants.length === 0) {
        setParseError('Tambahkan minimal satu peserta bulk dengan gap kompetensi yang valid.');
        return;
      }
      setParseError(null);
      await bulkPersonalizeAsync(participants);
    } catch (bulkError) {
      setParseError(getErrorMessage(bulkError, 'Bulk recommendation belum berhasil dibuat.'));
    }
  };

  if (isLoading && !syllabus) {
    return <LoadingSpinner fullScreen message="Memuat bulk recommendation..." />;
  }

  if (error && !syllabus) {
    return (
      <ScrollView className="flex-1 bg-neutral-50">
        <View className="mx-auto w-full max-w-4xl p-6">
          <Card className="border border-primary-200 bg-primary-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-primary-700">Gagal memuat bulk recommendation</Text>
              <Text className="text-primary-700">{getErrorMessage(error, 'Data bulk recommendation belum dapat dimuat.')}</Text>
              <Button title="Kembali" onPress={() => router.back()} />
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl p-4 lg:p-8 gap-6">
        <PageHeader
          eyebrow="Langkah 3B"
          title="Buat rekomendasi untuk banyak peserta"
          description="Siapkan CSV peserta, cek preview-nya, lalu buat rekomendasi belajar dalam satu batch."
          actions={(
            <>
              <Button title="Kembali" variant="ghost" onPress={() => router.push(`/personalize?syllabusId=${syllabusId}`)} />
              {Platform.OS === 'web' ? (
                <Button title="Upload CSV" variant="outline" onPress={handleUploadCsv} icon={<Ionicons name="cloud-upload-outline" size={18} color={colors.textSecondary} />} />
              ) : null}
            </>
          )}
        />

        <Card className="border border-indigo-100 bg-indigo-50">
          <View className="gap-3 lg:flex-row lg:items-center lg:justify-between">
            <View className="flex-1">
              <Text className="font-semibold text-indigo-900">Butuh mode single-user?</Text>
              <Text className="mt-1 text-sm text-indigo-700">Kembali ke pemilihan mode atau buka flow satu peserta bila Anda perlu hasil mendalam untuk individu tertentu.</Text>
            </View>
            <Button title="Buka single-user" variant="outline" onPress={() => router.push(`/personalize/${syllabusId}`)} icon={<Ionicons name="person-outline" size={18} color={colors.textSecondary} />} />
          </View>
        </Card>

        {Platform.OS === 'web' ? (
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleWebInputChange}
          />
        ) : null}

        <Card className="border border-neutral-300 bg-surface shadow-sm">
          <View className="gap-3">
            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Syllabus Context</Text>
            <Text className="text-lg font-semibold text-neutral-950">{syllabus?.course_title || syllabus?.topic || 'Syllabus final'}</Text>
            <Text className="text-sm text-neutral-500">Version aktif: {(syllabus?.revision_history.length ?? 0) + 1}</Text>
            <Text className="text-sm text-neutral-500">Gunakan header CSV: {CSV_HEADERS.join(', ')}</Text>
          </View>
        </Card>

        <Card className="border border-neutral-300 bg-surface shadow-sm">
          <View className="gap-3">
            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Input CSV</Text>
            <Text className="text-sm text-neutral-500">
              Satu baris = satu competency gap. Peserta yang sama akan digabung menjadi satu paket rekomendasi.
            </Text>
            <View className="rounded-xl border border-neutral-300 bg-neutral-50 p-3">
              <TextInput
                value={csvText}
                onChangeText={setCsvText}
                multiline
                className="min-h-[220px] text-sm text-neutral-800"
                placeholder={CSV_HEADERS.join(',')}
                placeholderTextColor={colors.textMuted}
                textAlignVertical="top"
              />
            </View>
            {parseError ? <AlertBanner variant="error" title="CSV belum siap diproses" description={parseError} /> : null}
          </View>
        </Card>

        <Card className="border border-neutral-300 bg-surface shadow-sm">
          <View className="gap-3">
            <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Preview Peserta</Text>
            {parsedParticipants.length > 0 ? (
              parsedParticipants.map((participant) => (
                <View key={participant.participant_name} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                  <Text className="font-semibold text-neutral-950">{participant.participant_name}</Text>
                  <Text className="mt-1 text-sm text-neutral-500">{participant.competency_gaps.length} competency gap</Text>
                  <View className="mt-3 gap-2">
                    {participant.competency_gaps.map((gap, index) => (
                      <View key={`${participant.participant_name}-${index}`} className="rounded-lg bg-surface p-3 border border-neutral-100">
                        <Text className="text-sm font-semibold text-neutral-800">{gap.skill}</Text>
                        <Text className="mt-1 text-xs text-neutral-500">Level {gap.current_level} → {gap.required_level}</Text>
                        {gap.gap_description ? (
                          <Text className="mt-1 text-sm text-neutral-600">{gap.gap_description}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : (
              <EmptyState
                icon="people-outline"
                title="Belum ada peserta bulk"
                description="Upload atau paste CSV untuk melihat preview peserta dan gap yang akan diproses."
              />
            )}
          </View>
        </Card>

        <View className="flex-row justify-end">
          <Button
            title="Buat rekomendasi"
            isLoading={isBulkPersonalizing}
            onPress={() => void handleGenerate()}
            icon={<Ionicons name="people-outline" size={18} color="white" />}
          />
        </View>

        <View className="gap-4">
          <Text className="text-xl font-semibold text-neutral-950">Hasil batch terbaru</Text>
          {runs.length > 0 ? (
            runs.map((run) => (
              <Card key={run.bulkSessionId} className="border border-neutral-100 bg-surface shadow-sm">
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-lg font-semibold text-neutral-950">Bulk Session {run.bulkSessionId.slice(0, 8)}</Text>
                      <Text className="text-sm text-neutral-500">Versi {run.revisionIndex + 1} • {new Date(run.createdAt).toLocaleString()}</Text>
                    </View>
                    <View className="rounded-full bg-primary/10 px-3 py-1">
                      <Text className="text-xs font-semibold text-primary">{run.results.length} peserta</Text>
                    </View>
                  </View>
                  {run.revisionIndex !== currentRevisionIndex ? (
                    <AlertBanner
                      variant="warning"
                      title="Hasil ini dibuat dari versi kurikulum sebelumnya"
                      description={`Batch ini dibuat dari versi ${run.revisionIndex + 1}, sementara versi aktif saat ini adalah ${currentRevisionIndex + 1}.`}
                    />
                  ) : null}
                  <View className="gap-3">
                    {run.results.map((result) => (
                      <View key={result.id} className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
                        <Text className="font-semibold text-neutral-950">{result.participant_name}</Text>
                        <Text className="mt-1 text-sm text-neutral-500">{result.recommendations.length} rekomendasi</Text>
                        <View className="mt-3 gap-2">
                          {result.recommendations.map((recommendation, index) => (
                            <View key={`${result.id}-${index}`} className="rounded-lg bg-surface p-3 border border-neutral-100">
                              <Text className="text-sm font-semibold text-neutral-800">{recommendation.title}</Text>
                              <Text className="mt-1 text-sm text-neutral-600">{recommendation.description}</Text>
                              <Text className="mt-1 text-xs text-neutral-400">{recommendation.estimated_duration_minutes} menit • priority {recommendation.priority}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <EmptyState
              icon="albums-outline"
              title="Belum ada hasil batch"
              description="Jalankan rekomendasi multi-user untuk melihat hasilnya di sini."
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function groupBulkRuns(results: PersonalizationResult[]): BulkRunGroup[] {
  const grouped = new Map<string, BulkRunGroup>();
  for (const result of results) {
    if (!result.bulk_session_id) {
      continue;
    }
    const existing = grouped.get(result.bulk_session_id);
    if (existing) {
      existing.results.push(result);
      continue;
    }
    grouped.set(result.bulk_session_id, {
      bulkSessionId: result.bulk_session_id,
      createdAt: result.created_at,
      revisionIndex: result.revision_index,
      results: [result],
    });
  }
  return Array.from(grouped.values()).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function parseBulkCsv(csvText: string): BulkParticipantInput[] {
  const rows = parseCsvRows(csvText);
  if (rows.length <= 1) {
    return [];
  }

  const header = rows[0].map((value) => value.trim());
  const getIndex = (name: string) => header.findIndex((item) => item === name);
  const headerMap = {
    participant_name: getIndex('participant_name'),
    skill: getIndex('skill'),
    current_level: getIndex('current_level'),
    required_level: getIndex('required_level'),
    gap_description: getIndex('gap_description'),
  };

  if (Object.values(headerMap).some((index) => index < 0)) {
    return [];
  }

  const grouped = new Map<string, CompetencyGap[]>();
  for (const row of rows.slice(1)) {
    const csvRow = pickCsvRow(row, headerMap);
    if (!csvRow.participant_name || !csvRow.skill) {
      continue;
    }
    const gaps = grouped.get(csvRow.participant_name) ?? [];
    gaps.push({
      skill: csvRow.skill,
      current_level: toLevel(csvRow.current_level, 1),
      required_level: toLevel(csvRow.required_level, 2),
      gap_description: csvRow.gap_description,
    });
    grouped.set(csvRow.participant_name, gaps);
  }

  return Array.from(grouped.entries()).map(([participant_name, competency_gaps]) => ({ participant_name, competency_gaps }));
}

function validateCsvHeaders(csvText: string): string | null {
  const rows = parseCsvRows(csvText);
  if (rows.length <= 1) {
    return null;
  }

  const header = rows[0].map((value) => value.trim());
  const missingHeaders = CSV_HEADERS.filter((column) => !header.includes(column));

  if (missingHeaders.length > 0) {
    return `Header CSV belum lengkap. Tambahkan kolom: ${missingHeaders.join(', ')}`;
  }

  return null;
}

function pickCsvRow(row: string[], headerMap: Record<keyof CsvRow, number>): CsvRow {
  const read = (index: number) => (index >= 0 ? (row[index] ?? '').trim() : '');
  return {
    participant_name: read(headerMap.participant_name),
    skill: read(headerMap.skill),
    current_level: read(headerMap.current_level),
    required_level: read(headerMap.required_level),
    gap_description: read(headerMap.gap_description),
  };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(current);
      if (row.some((item) => item.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  if (row.some((item) => item.trim() !== '')) {
    rows.push(row);
  }
  return rows;
}

function toLevel(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, 1), 5);
}
