import { useMemo, useState } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { getErrorMessage } from '../../src/services/api';
import { useSyllabus } from '../../src/hooks/useSyllabus';

export default function SyllabusHistoryScreen() {
  const { syllabusId } = useLocalSearchParams<{ syllabusId?: string }>();
  const router = useRouter();
  const { syllabi, isLoading, error } = useSyllabus();
  const [exportingId, setExportingId] = useState<string | null>(null);

  const finalized = useMemo(
    () =>
      (syllabi ?? []).filter(
        (item) => item.status === 'finalized' && (!syllabusId || item.id === syllabusId)
      ),
    [syllabi, syllabusId]
  );

  if (isLoading && !syllabi) {
    return <LoadingSpinner fullScreen message="Memuat riwayat syllabus..." />;
  }

  if (error && !syllabi) {
    return (
      <ScrollView className="flex-1 bg-gray-50">
        <View className="mx-auto w-full max-w-4xl p-6">
          <Card className="border border-red-200 bg-red-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-red-700">Gagal memuat history</Text>
              <Text className="text-red-700">{getErrorMessage(error, 'Riwayat syllabus belum dapat dimuat.')}</Text>
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
          <View>
            <Text className="text-3xl font-bold text-gray-900">History & CSV</Text>
            <Text className="mt-1 text-gray-500">Jejak finalized syllabus, revisi, personalisasi, decomposition, dan export.</Text>
          </View>
          <Button title="Kembali" variant="ghost" onPress={() => router.back()} />
        </View>

        {finalized.length > 0 ? (
          <View className="gap-4">
            {finalized.map((syllabus) => (
              <HistoryCard key={syllabus.id} syllabusId={syllabus.id} title={syllabus.course_title || syllabus.topic} onOpen={() => router.push(`/syllabus/${syllabus.id}`)} exportingId={exportingId} setExportingId={setExportingId} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="time-outline"
            title="Belum ada history syllabus"
            description="Finalize minimal satu syllabus agar jejak created, revised, personalized, decomposed, dan exported bisa dilihat di sini."
          />
        )}
      </View>
    </ScrollView>
  );
}

function HistoryCard({
  syllabusId,
  title,
  onOpen,
  exportingId,
  setExportingId,
}: {
  syllabusId: string;
  title: string;
  onOpen: () => void;
  exportingId: string | null;
  setExportingId: (value: string | null) => void;
}) {
  const { history, historyAggregate, revisions, isLoading, exportHistoryCsvAsync } = useSyllabus(syllabusId, {
    includeHistory: true,
    includeRevisions: true,
  });
  const currentRevision = revisions?.find((item) => item.is_current) ?? null;

  const handleExportCsv = async () => {
    try {
      setExportingId(syllabusId);
      const blob = await exportHistoryCsvAsync();

      if (Platform.OS === 'web') {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `history-${syllabusId}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }
    } finally {
      setExportingId(null);
    }
  };

  return (
    <Card className="border border-gray-100 bg-white shadow-sm">
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-4">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{title}</Text>
            <Text className="mt-1 text-sm text-gray-500">Syllabus ID: {syllabusId}</Text>
          </View>
          <View className="flex-row gap-2">
            <Button title="Open" variant="ghost" onPress={onOpen} />
            <Button title="CSV" variant="outline" isLoading={exportingId === syllabusId} onPress={() => void handleExportCsv()} icon={<Ionicons name="download-outline" size={18} color="#374151" />} />
          </View>
        </View>

        {isLoading && !history ? (
          <LoadingSpinner message="Memuat history..." />
        ) : (
          <>
            <View className="grid gap-3 lg:grid-cols-4">
              <Metric label="Total Events" value={String(historyAggregate?.total_events ?? history?.length ?? 0)} />
              <Metric label="Version Aktif" value={String((currentRevision?.revision_index ?? 0) + 1)} />
              <Metric label="Exports" value={String((historyAggregate?.action_counts?.exported ?? 0))} />
              <Metric label="Modules" value={String((historyAggregate?.action_counts?.decomposed ?? 0))} />
            </View>

            {revisions && revisions.length > 0 ? (
              <View className="gap-2">
                <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Revision Notes</Text>
                {revisions.slice().reverse().slice(0, 3).map((note) => (
                  <View key={`${syllabusId}-revision-${note.revision_index}`} className="rounded-lg border border-gray-100 bg-white p-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="font-semibold text-gray-900">Version {note.revision_index + 1}{note.is_current ? ' · Current' : ''}</Text>
                      <Text className="text-xs uppercase tracking-wide text-gray-400">{note.source_kind}</Text>
                    </View>
                    <Text className="mt-1 text-sm text-gray-700">{note.summary || 'Revision note belum diisi.'}</Text>
                    {note.reason ? <Text className="mt-1 text-sm text-gray-500">Reason: {note.reason}</Text> : null}
                    <Text className="mt-2 text-xs text-gray-500">
                      Personalisasi {note.downstream.personalization_count} • Modules {note.downstream.module_generation_count} • Export {note.downstream.export_count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Recent Events</Text>
              {history && history.length > 0 ? (
                history.slice().reverse().slice(0, 6).map((event) => (
                  <View key={event.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="font-semibold text-gray-900">{event.summary}</Text>
                      <Text className="text-xs uppercase tracking-wide text-gray-400">{event.action}</Text>
                    </View>
                    {event.revision_index !== null && event.revision_index !== undefined ? (
                      <Text className="mt-1 text-xs font-medium text-gray-500">Version {event.revision_index + 1}</Text>
                    ) : null}
                    <Text className="mt-1 text-sm text-gray-500">{new Date(event.created_at).toLocaleString('id-ID')}</Text>
                  </View>
                ))
              ) : (
                <Text className="text-sm italic text-gray-400">Belum ada event owner history untuk syllabus ini.</Text>
              )}
            </View>
          </>
        )}
      </View>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="rounded-xl border border-gray-100 bg-gray-50 p-4">
      <Text className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</Text>
      <Text className="mt-2 text-2xl font-bold text-gray-900">{value}</Text>
    </View>
  );
}
