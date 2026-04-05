import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AlertBanner } from '../../../src/components/ui/AlertBanner';
import { Button } from '../../../src/components/ui/Button';
import { Card } from '../../../src/components/ui/Card';
import { LoadingSpinner } from '../../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../../src/components/ui/PageHeader';
import { TextField } from '../../../src/components/ui/TextField';
import { useSyllabus } from '../../../src/hooks/useSyllabus';
import { getErrorMessage } from '../../../src/services/api';
import { colors } from '../../../src/theme/colors';

type RevisionFormState = {
  summary: string;
  reason: string;
  tlo: string;
  performance_result: string;
  condition_result: string;
  standard_result: string;
  elosText: string;
};

function toEloLines(elos: Array<{ elo: string }>) {
  return elos.map((item) => item.elo).join('\n');
}

export default function SyllabusRevisionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { syllabus, isLoading, error, refetch, applyRevisionAsync, isApplyingRevision } = useSyllabus(id as string);
  const [form, setForm] = useState<RevisionFormState | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!syllabus) {
      return;
    }

    setForm({
      summary: '',
      reason: '',
      tlo: syllabus.tlo,
      performance_result: syllabus.performance_result ?? '',
      condition_result: syllabus.condition_result ?? '',
      standard_result: syllabus.standard_result ?? '',
      elosText: toEloLines(syllabus.elos),
    });
  }, [syllabus]);

  const payload = useMemo(() => {
    if (!syllabus || !form) {
      return null;
    }

    const nextElos = form.elosText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const originalElos = syllabus.elos.map((item) => item.elo.trim()).filter(Boolean);
    const data: Record<string, unknown> = {};

    if (form.tlo.trim() !== syllabus.tlo.trim()) data.tlo = form.tlo.trim();
    if (form.performance_result.trim() !== (syllabus.performance_result ?? '').trim()) data.performance_result = form.performance_result.trim();
    if (form.condition_result.trim() !== (syllabus.condition_result ?? '').trim()) data.condition_result = form.condition_result.trim();
    if (form.standard_result.trim() !== (syllabus.standard_result ?? '').trim()) data.standard_result = form.standard_result.trim();
    if (nextElos.join('|') !== originalElos.join('|')) data.elos = nextElos.map((elo) => ({ elo }));

    return {
      summary: form.summary.trim(),
      reason: form.reason.trim(),
      changes: data,
    };
  }, [form, syllabus]);

  const handleChange = (field: keyof RevisionFormState, value: string) => {
    if (!form) return;
    setForm({ ...form, [field]: value });
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const handleSubmit = async () => {
    if (!payload) {
      return;
    }

    if (Object.keys(payload.changes).length === 0) {
      setSubmitError('Belum ada perubahan yang bisa disimpan.');
      return;
    }

    try {
      await applyRevisionAsync({
        summary: payload.summary,
        reason: payload.reason,
        ...(payload.changes as object),
      });
      setSubmitSuccess('Revisi berhasil disimpan. Detail kurikulum sudah diperbarui.');
    } catch (revisionError) {
      setSubmitError(getErrorMessage(revisionError, 'Revisi belum berhasil disimpan.'));
    }
  };

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

  if (!syllabus || !form) {
    return <LoadingSpinner fullScreen message="Menyiapkan workspace revisi..." />;
  }

  return (
    <ScrollView className="flex-1 bg-neutral-50" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-5xl p-4 lg:p-8 gap-6">
        <PageHeader
          eyebrow="Revisi"
          title="Tinjau dan revisi kurikulum"
          description="Perbarui isi kurikulum final bila ada bagian yang perlu diperjelas sebelum dibagikan atau dipakai untuk personalisasi."
          actions={(
            <>
              <Button title="Kembali" variant="ghost" onPress={() => router.push(`/syllabus/${id}`)} icon={<Ionicons name="arrow-back" size={18} color={colors.textSecondary} />} />
              <Button title="Simpan revisi" onPress={() => void handleSubmit()} isLoading={isApplyingRevision} />
            </>
          )}
        />

        {submitError ? <AlertBanner variant="error" title="Revisi belum berhasil disimpan" description={submitError} /> : null}
        {submitSuccess ? <AlertBanner variant="success" title="Revisi berhasil disimpan" description={submitSuccess} /> : null}

        <View className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-neutral-300 bg-surface shadow-sm">
            <View className="gap-4">
              <TextField label="Ringkasan perubahan" hint="Opsional" value={form.summary} onChangeText={(value) => handleChange('summary', value)} placeholder="Contoh: Menajamkan target performa" />
              <TextField label="Alasan perubahan" hint="Opsional" value={form.reason} onChangeText={(value) => handleChange('reason', value)} placeholder="Contoh: Menyesuaikan kebutuhan peserta terbaru" multiline />
              <TextField label="Tujuan akhir pembelajaran" value={form.tlo} onChangeText={(value) => handleChange('tlo', value)} multiline />
              <TextField label="Target performa" value={form.performance_result} onChangeText={(value) => handleChange('performance_result', value)} multiline />
              <TextField label="Kondisi belajar" value={form.condition_result} onChangeText={(value) => handleChange('condition_result', value)} multiline />
              <TextField label="Standar hasil" value={form.standard_result} onChangeText={(value) => handleChange('standard_result', value)} multiline />
              <TextField label="Modul belajar" hint="Satu baris untuk satu modul belajar." value={form.elosText} onChangeText={(value) => handleChange('elosText', value)} multiline />
            </View>
          </Card>

          <View className="gap-6">
            <Card className="border-neutral-300 bg-surface shadow-sm">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-600">Apa yang bisa direvisi</Text>
              <Text className="mt-2 text-base font-semibold text-neutral-950">Fokus pada bagian inti kurikulum</Text>
              <Text className="mt-2 text-sm leading-6 text-neutral-600">Workspace ini ditujukan untuk memperbarui tujuan akhir, target performa, kondisi, standar, dan modul belajar. Setelah disimpan, detail kurikulum akan langsung memakai versi terbaru.</Text>
            </Card>
            <Card className="border-neutral-300 bg-surface shadow-sm">
              <Text className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-600">Versi aktif</Text>
              <Text className="mt-2 text-base font-semibold text-neutral-950">Versi {syllabus.revision_history.length + 1}</Text>
              <Text className="mt-2 text-sm leading-6 text-neutral-600">Riwayat revisi sebelumnya tetap tersimpan di detail kurikulum. Personalisasi lama akan di-refresh saat Anda membuat rekomendasi baru.</Text>
            </Card>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
