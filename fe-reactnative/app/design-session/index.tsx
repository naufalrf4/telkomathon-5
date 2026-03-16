import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDesignSessionList } from '../../src/hooks/useDesignSession';
import { getErrorMessage } from '../../src/services/api';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { EmptyState } from '../../src/components/ui/EmptyState';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { colors } from '../../src/theme/colors';
import type { DesignSession } from '../../src/types/designSession';

const STEP_LABELS: Record<string, string> = {
  uploaded: 'Dokumen dipilih',
  summary_ready: 'Ringkasan siap',
  course_context_set: 'Konteks kursus disimpan',
  tlo_options_ready: 'Opsi TLO siap',
  tlo_selected: 'TLO dipilih',
  performance_options_ready: 'Opsi performa siap',
  performance_selected: 'Performa dipilih',
  elo_options_ready: 'Opsi ELO siap',
  elo_selected: 'ELO dipilih',
  finalized: 'Silabus final tersedia',
};

function getSessionTitle(session: DesignSession): string {
  if (session.course_context?.topic) {
    return session.course_context.topic;
  }

  if (session.source_summary?.key_points[0]) {
    return session.source_summary.key_points[0];
  }

  return 'Sesi desain tanpa judul';
}

function getSessionStatus(session: DesignSession): string {
  if (session.finalized_syllabus_id) {
    return STEP_LABELS.finalized;
  }

  return STEP_LABELS[session.wizard_step] ?? session.wizard_step;
}

export default function DesignSessionListScreen() {
  const router = useRouter();
  const { data: sessions, isLoading, error, refetch } = useDesignSessionList();

  if (isLoading && !sessions) {
    return <LoadingSpinner fullScreen message="Memuat sesi desain..." />;
  }

  if (error && !sessions) {
    return (
      <EmptyState
        title="Gagal memuat sesi desain"
        description={getErrorMessage(error, 'Daftar sesi desain belum dapat dimuat. Coba lagi.')}
        icon="alert-circle-outline"
        action={{ label: 'Coba Lagi', onPress: () => void refetch() }}
      />
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
          title="Belum ada draft create flow"
          description="Buat draft create flow pertama dari dokumen yang sudah siap diproses."
          icon="sparkles-outline"
          action={{ label: 'Mulai Create Flow', onPress: () => router.push('/syllabus/create') }}
        />
    );
  }

  const activeSessions = sessions.filter((session) => !session.finalized_syllabus_id);
  const completedSessions = sessions.filter((session) => !!session.finalized_syllabus_id);

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="max-w-5xl mx-auto w-full p-4 lg:p-8 gap-6">
        <View className="flex-row flex-wrap items-start justify-between gap-4">
          <View className="gap-2 flex-1 min-w-[240px]">
            <Text className="text-3xl font-bold text-gray-900">Draft Create Flow</Text>
            <Text className="text-gray-500 text-base">
              Lanjutkan draft create flow yang masih berjalan atau buka hasil final yang sudah selesai.
            </Text>
          </View>
          <Button title="Mulai Create Flow" onPress={() => router.push('/syllabus/create')} />
        </View>

        <SessionSection
          title="Sedang Berjalan"
          emptyText="Belum ada sesi aktif. Semua sesi yang ada sudah difinalisasi."
          sessions={activeSessions}
          actionLabel="Lanjutkan"
          onPress={(session) => router.push(`/syllabus/create/${session.id}`)}
        />

        <SessionSection
          title="Selesai"
          emptyText="Belum ada sesi yang difinalisasi."
          sessions={completedSessions}
          actionLabel="Buka Silabus"
          onPress={(session) => {
            if (session.finalized_syllabus_id) {
              router.push(`/syllabus/${session.finalized_syllabus_id}`);
            }
          }}
        />
      </View>
    </ScrollView>
  );
}

interface SessionSectionProps {
  title: string;
  emptyText: string;
  sessions: DesignSession[];
  actionLabel: string;
  onPress: (session: DesignSession) => void;
}

function SessionSection({ title, emptyText, sessions, actionLabel, onPress }: SessionSectionProps) {
  return (
    <View className="gap-4">
      <Text className="text-xl font-bold text-gray-900">{title}</Text>
      {sessions.length === 0 ? (
        <Card>
          <Text className="text-gray-500">{emptyText}</Text>
        </Card>
      ) : (
        sessions.map((session) => (
          <Card
            key={session.id}
            title={getSessionTitle(session)}
            subtitle={`Diperbarui ${new Date(session.updated_at).toLocaleDateString('id-ID')}`}
            action={<Button title={actionLabel} size="sm" onPress={() => onPress(session)} />}
          >
            <View className="gap-3">
              <View className="flex-row flex-wrap items-center gap-2">
                <View className="flex-row items-center rounded-full bg-red-50 px-3 py-1.5">
                  <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                  <Text className="ml-2 text-xs font-semibold text-primary">{getSessionStatus(session)}</Text>
                </View>
                <Text className="text-sm text-gray-500">{session.document_ids.length} dokumen sumber</Text>
              </View>
              {session.source_summary?.summary ? (
                <Text className="text-gray-600" numberOfLines={2}>
                  {session.source_summary.summary}
                </Text>
              ) : (
                <Text className="text-gray-500">Ringkasan sumber akan tampil setelah asistensi awal dijalankan.</Text>
              )}
            </View>
          </Card>
        ))
      )}
    </View>
  );
}
