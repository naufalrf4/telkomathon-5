import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertBanner } from '../../src/components/ui/AlertBanner';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { SectionTabs } from '../../src/components/ui/SectionTabs';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../src/services/api';
import { ELOAccordion } from '../../src/features/ELOAccordion';
import { colors } from '../../src/theme/colors';
import {
  emptyLearningJourney,
  getSyllabusStatusLabel,
  getSyllabusStatusVariant,
  syllabusDocxFilename,
  syllabusTitle,
} from '../../src/utils/syllabus';
import type { LearningJourneyStage } from '../../src/types/api';

const PCS_LABELS = [
  { title: 'Performance (PCS)', key: 'performance' },
  { title: 'Condition (PCS)', key: 'condition' },
  { title: 'Standard (PCS)', key: 'standard' },
] as const;

const LEVEL_LABELS: Record<number, string> = {
  1: 'Pemula',
  2: 'Dasar',
  3: 'Menengah',
  4: 'Lanjutan',
  5: 'Ahli',
};

const DETAIL_TABS: Array<{ value: DetailTab; label: string }> = [
  { value: 'overview', label: 'Ringkasan' },
  { value: 'modules', label: 'Modul' },
  { value: 'journey', label: 'Alur belajar' },
  { value: 'revision', label: 'Revisi' },
];

type DetailTab = 'overview' | 'modules' | 'journey' | 'revision';

function triggerBrowserDownload(blob: Blob, filename: string) {
  const blobUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(blobUrl);
}

export default function SyllabusDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { syllabus, isLoading, error, refetch, downloadSyllabusDocxAsync, isDownloadingSyllabusDocx } = useSyllabus(id as string);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const journey = syllabus?.journey ?? emptyLearningJourney();
  const currentVersion = (syllabus?.revision_history.length ?? 0) + 1;
  const latestRevision = syllabus?.revision_history[syllabus.revision_history.length - 1] ?? null;

  const headlinePoints = useMemo(
    () => [
      { label: 'Versi aktif', value: `${currentVersion}` },
      { label: 'Jumlah revisi', value: `${syllabus?.revision_history.length ?? 0}` },
      { label: 'Modul belajar', value: `${syllabus?.elos.length ?? 0}` },
    ],
    [currentVersion, syllabus?.elos.length, syllabus?.revision_history.length]
  );

  if (isLoading && !syllabus) {
    return <LoadingSpinner fullScreen message="Memuat detail kursus..." />;
  }

  if (error && !syllabus) {
    return (
      <ScrollView className="flex-1 bg-neutral-50">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <Card className="border border-primary-200 bg-primary-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-primary-700">Gagal memuat detail silabus</Text>
              <Text className="text-primary-700">{getErrorMessage(error, 'Detail silabus belum dapat dimuat.')}</Text>
              <View className="flex-row flex-wrap gap-3">
                <Button title="Coba lagi" onPress={() => void refetch()} />
                <Button title="Kembali" variant="outline" onPress={() => router.push('/syllabus/generated')} />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  if (!syllabus) {
    return (
      <ScrollView className="flex-1 bg-neutral-50">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <Card className="border border-amber-200 bg-amber-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-amber-700">Silabus tidak ditemukan</Text>
              <Text className="text-amber-700">Buka daftar silabus untuk memilih silabus lain.</Text>
              <Button title="Kembali ke daftar" onPress={() => router.push('/syllabus/generated')} />
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  const handleExportDocx = async () => {
    setExportError(null);
    setExportSuccess(null);

    try {
      const blob = await downloadSyllabusDocxAsync();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        triggerBrowserDownload(blob, syllabusDocxFilename(syllabus));
      }
      setExportSuccess('File DOCX berhasil disiapkan untuk diunduh.');
    } catch (downloadError) {
      setExportError(getErrorMessage(downloadError, 'Export DOCX belum berhasil dibuat.'));
    }
  };

  return (
    <ScrollView className="flex-1 bg-neutral-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-7xl gap-6 p-4 lg:p-8">
        <PageHeader
          eyebrow="Hasil kurikulum"
          title={syllabusTitle(syllabus)}
          actions={
            <>
              <Button
                title="Personalisasi"
                variant="primary"
                icon={<Ionicons name="sparkles-outline" size={18} color="white" />}
                onPress={() => router.push(`/personalize?syllabusId=${id}`)}
              />
              <Button
                title="Revisi"
                variant="outline"
                icon={<Ionicons name="create-outline" size={18} color={colors.textSecondary} />}
                onPress={() => router.push(`/syllabus/${id}/revision`)}
              />
              <Button
                title="Export DOCX"
                variant="outline"
                icon={<Ionicons name="download-outline" size={18} color={colors.textSecondary} />}
                onPress={() => void handleExportDocx()}
                isLoading={isDownloadingSyllabusDocx}
              />
            </>
          }
          aside={
            <View className="flex-row flex-wrap gap-2">
              <Badge label={LEVEL_LABELS[syllabus.target_level] || `Level ${syllabus.target_level}`} variant="info" />
              <Badge label={syllabus.course_expertise_level} variant="default" />
              <Badge label={getSyllabusStatusLabel(syllabus.status)} variant={getSyllabusStatusVariant(syllabus.status)} />
            </View>
          }
        />

        {exportError ? <AlertBanner variant="error" title="Export DOCX belum berhasil" description={exportError} /> : null}
        {exportSuccess ? <AlertBanner variant="success" title="Export DOCX siap" description={exportSuccess} /> : null}

        <View className="grid gap-4 lg:grid-cols-3">
          {headlinePoints.map((point) => (
            <Card key={point.label}>
              <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{point.label}</Text>
              <Text className="mt-2 text-2xl font-semibold text-neutral-950">{point.value}</Text>
            </Card>
          ))}
        </View>

        <Card className="border-primary-100 bg-primary-50">
          <View className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <View className="flex-1 gap-2">
              <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Ringkasan perusahaan</Text>
              <Text className="text-lg font-semibold text-neutral-950">{syllabus.client_company_name || 'Perusahaan belum diisi'}</Text>
              <Text className="text-sm leading-6 text-neutral-700">
                {syllabus.company_profile_summary || syllabus.commercial_overview || 'Ringkasan perusahaan belum tersedia.'}
              </Text>
            </View>
            <View className="rounded-2xl bg-white px-4 py-3">
              <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Perubahan terakhir</Text>
              <Text className="mt-1 text-sm text-neutral-800">{latestRevision?.summary || 'Belum ada revisi'}</Text>
            </View>
          </View>
        </Card>

        <SectionTabs value={activeTab} onChange={setActiveTab} items={DETAIL_TABS} />

        {activeTab === 'overview' ? (
          <View className="gap-4">
            <Card className="border-l-4 border-l-primary bg-surface shadow-sm">
              <View className="flex-row items-start gap-4">
                <View className="rounded-full bg-primary/10 p-3">
                  <Ionicons name="trophy-outline" size={24} color={colors.primary} />
                </View>
                <View className="flex-1">
                  <Text className="mb-1 text-sm font-bold uppercase tracking-wider text-primary">Tujuan Akhir Pembelajaran (TLO)</Text>
                  <Text className="text-lg font-medium leading-relaxed text-neutral-950">{syllabus.tlo}</Text>
                </View>
              </View>
            </Card>
            <View className="grid gap-4 lg:grid-cols-3">
              <Card className="border-neutral-300 bg-surface shadow-sm">
                <Text className="text-sm font-semibold text-neutral-950">{PCS_LABELS[0].title}</Text>
                <Text className="mt-2 text-sm leading-6 text-neutral-700">{syllabus.performance_result || 'Belum tersedia'}</Text>
              </Card>
              <Card className="border-neutral-300 bg-surface shadow-sm">
                <Text className="text-sm font-semibold text-neutral-950">{PCS_LABELS[1].title}</Text>
                <Text className="mt-2 text-sm leading-6 text-neutral-700">{syllabus.condition_result || 'Belum tersedia'}</Text>
              </Card>
              <Card className="border-neutral-300 bg-surface shadow-sm">
                <Text className="text-sm font-semibold text-neutral-950">{PCS_LABELS[2].title}</Text>
                <Text className="mt-2 text-sm leading-6 text-neutral-700">{syllabus.standard_result || 'Belum tersedia'}</Text>
              </Card>
            </View>
          </View>
        ) : null}

        {activeTab === 'modules' ? (
          <Card className="border-neutral-300 bg-surface shadow-sm">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-xl font-bold text-neutral-950">Modul Belajar (ELO)</Text>
              <Badge label={`${syllabus.elos.length} ELO`} variant="default" />
            </View>
            <ELOAccordion elos={syllabus.elos} />
          </Card>
        ) : null}

        {activeTab === 'journey' ? (
          <View className="grid gap-4 xl:grid-cols-3">
            <JourneyCard title="Pra-Pembelajaran" icon="book-outline" stage={journey.pre_learning} accentColor="border-indigo-500" bgColor="bg-indigo-50" iconColor="text-indigo-600" />
            <JourneyCard title="Di Kelas" icon="people-outline" stage={journey.classroom} accentColor="border-emerald-500" bgColor="bg-emerald-50" iconColor="text-emerald-600" />
            <JourneyCard title="Pasca-Pembelajaran" icon="rocket-outline" stage={journey.after_learning} accentColor="border-amber-500" bgColor="bg-amber-50" iconColor="text-amber-600" />
          </View>
        ) : null}

        {activeTab === 'revision' ? (
          <View className="gap-4">
            <Card className="border-neutral-300 bg-surface shadow-sm">
              <Text className="text-sm font-semibold text-neutral-950">Riwayat revisi</Text>
              <View className="mt-4 gap-3">
                {syllabus.revision_history.length > 0 ? (
                  syllabus.revision_history
                    .slice()
                    .reverse()
                    .map((entry, index) => (
                      <View key={`${entry.revised_at}-${index}`} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                        <Text className="text-sm font-semibold text-neutral-950">{entry.summary || 'Perubahan tanpa ringkasan'}</Text>
                        {entry.reason ? <Text className="mt-1 text-sm text-neutral-600">{entry.reason}</Text> : null}
                        {entry.applied_fields.length > 0 ? (
                          <Text className="mt-2 text-xs uppercase tracking-[0.16em] text-neutral-500">
                            Field: {entry.applied_fields.join(', ')}
                          </Text>
                        ) : null}
                      </View>
                    ))
                ) : (
                  <Text className="text-sm text-neutral-600">Belum ada riwayat revisi untuk kurikulum ini.</Text>
                )}
              </View>
            </Card>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

interface JourneyCardProps {
  title: string;
  stage: LearningJourneyStage;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accentColor: string;
  bgColor: string;
  iconColor: string;
}

function JourneyCard({ title, stage, icon, accentColor, bgColor, iconColor }: JourneyCardProps) {
  return (
    <View className={`overflow-hidden rounded-xl border-t-4 bg-surface shadow-sm ${accentColor}`}>
      <View className={`${bgColor} flex-row items-center border-b border-neutral-300 p-4`}>
        <Ionicons name={icon} size={20} className={iconColor} />
        <Text className={`ml-2 text-xs font-bold uppercase tracking-wide ${iconColor}`}>{title}</Text>
      </View>
      <View className="gap-4 p-4">
        <StageField label="Durasi" value={stage.duration} fallback="Belum diisi" />
        <StageListField label="Metode" values={stage.method} fallback="Belum diisi" />
        <StageField label="Fokus" value={stage.description} fallback="Belum diisi" />
        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-wide text-neutral-600">Materi</Text>
          {stage.content.length > 0 ? (
            stage.content.map((item, idx) => (
              <View key={`${title}-${idx}`} className="flex-row items-start">
                <View className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <Text className="flex-1 text-sm leading-5 text-neutral-700">{item}</Text>
              </View>
            ))
          ) : (
            <Text className="text-sm italic text-neutral-600">Belum ada konten terjadwal</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function StageListField({ label, values, fallback }: { label: string; values: string[]; fallback: string }) {
  return (
    <View className="gap-2">
      <Text className="text-xs font-bold uppercase tracking-wide text-neutral-600">{label}</Text>
      {values.length > 0 ? (
        values.map((value, index) => (
          <View key={`${label}-${index}`} className="flex-row items-start">
            <View className="mr-2 mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            <Text className="flex-1 text-sm leading-5 text-neutral-700">{value}</Text>
          </View>
        ))
      ) : (
        <Text className="text-sm leading-6 text-neutral-700">{fallback}</Text>
      )}
    </View>
  );
}

function StageField({ label, value, fallback }: { label: string; value: string; fallback: string }) {
  return (
    <View className="gap-1">
      <Text className="text-xs font-bold uppercase tracking-wide text-neutral-600">{label}</Text>
      <Text className="text-sm leading-6 text-neutral-700">{value?.trim() ? value : fallback}</Text>
    </View>
  );
}
