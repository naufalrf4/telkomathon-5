import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AlertBanner } from '../../src/components/ui/AlertBanner';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { ProgressStepper } from '../../src/components/ui/ProgressStepper';
import { TextField } from '../../src/components/ui/TextField';
import { useDesignSession } from '../../src/hooks/useDesignSession';
import { getErrorMessage } from '../../src/services/api';
import { colors } from '../../src/theme/colors';
import type { DesignOption, DesignSessionWizardStep, ELOOption } from '../../src/types/designSession';

const WIZARD_STEPS: Array<{ value: DesignSessionWizardStep; label: string }> = [
  { value: 'uploaded', label: 'Dokumen' },
  { value: 'summary_ready', label: 'Ringkasan & konteks' },
  { value: 'course_context_set', label: 'Tujuan akhir' },
  { value: 'tlo_options_ready', label: 'Pilih tujuan' },
  { value: 'tlo_selected', label: 'Target performa' },
  { value: 'performance_options_ready', label: 'Pilih performa' },
  { value: 'performance_selected', label: 'Modul belajar' },
  { value: 'elo_options_ready', label: 'Pilih modul' },
  { value: 'elo_selected', label: 'Finalisasi' },
  { value: 'finalized', label: 'Selesai' },
];

const LEVEL_OPTIONS = [1, 2, 3, 4, 5];

export default function DesignSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
  const {
    session,
    isLoading,
    error,
    isWorking,
    refetch,
    startAssist,
    updateCourseContext,
    generateTloOptions,
    selectTlo,
    generatePerformanceOptions,
    selectPerformance,
    generateEloOptions,
    selectElos,
    finalizeSession,
  } = useDesignSession(sessionId);

  const [topic, setTopic] = useState('');
  const [targetLevel, setTargetLevel] = useState(3);
  const [additionalContext, setAdditionalContext] = useState('');
  const [courseCategory, setCourseCategory] = useState('');
  const [clientCompanyName, setClientCompanyName] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [commercialOverview, setCommercialOverview] = useState('');
  const [selectedEloIds, setSelectedEloIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [courseContextDirty, setCourseContextDirty] = useState(false);
  const [eloDirty, setEloDirty] = useState(false);

  useEffect(() => {
    if (!session?.course_context || courseContextDirty) {
      return;
    }

    setTopic(session.course_context.topic ?? '');
    setTargetLevel(session.course_context.target_level ?? 3);
    setAdditionalContext(session.course_context.additional_context ?? '');
    setCourseCategory(session.course_context.course_category ?? '');
    setClientCompanyName(session.course_context.client_company_name ?? session.source_summary?.company_name ?? '');
    setCourseTitle(session.course_context.course_title ?? '');
    setCommercialOverview(
      session.course_context.commercial_overview ?? session.source_summary?.company_profile_summary ?? ''
    );
  }, [courseContextDirty, session?.course_context, session?.source_summary]);

  useEffect(() => {
    if (!session || eloDirty) {
      return;
    }

    setSelectedEloIds(session.selected_elos.map((option) => option.id));
  }, [eloDirty, session]);

  const currentStepIndex = useMemo(() => {
    if (!session) {
      return 0;
    }

    const activeStep = session.finalized_syllabus_id ? 'finalized' : session.wizard_step;
    return Math.max(WIZARD_STEPS.findIndex((step) => step.value === activeStep), 0);
  }, [session]);

  const activeStep = session?.finalized_syllabus_id ? 'finalized' : session?.wizard_step;
  const activeStepLabel = WIZARD_STEPS[currentStepIndex]?.label ?? 'Mulai';

  const showStartAssist = activeStep === 'uploaded';
  const showCourseContext = activeStep === 'summary_ready';
  const showGenerateTlo = activeStep === 'course_context_set';
  const showSelectTlo = activeStep === 'tlo_options_ready';
  const showGeneratePerformance = activeStep === 'tlo_selected';
  const showSelectPerformance = activeStep === 'performance_options_ready';
  const showGenerateElo = activeStep === 'performance_selected';
  const showSelectElo = activeStep === 'elo_options_ready';
  const showFinalize = activeStep === 'elo_selected';
  const showCompleted = activeStep === 'finalized';
  const showPerformancePreview =
    !!session?.selected_performance && (showGenerateElo || showSelectElo || showFinalize || showCompleted);

  const runAction = async (
    action: () => Promise<unknown>,
    successCopy?: string,
    onSuccess?: () => void
  ) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await action();
      setCourseContextDirty(false);
      setEloDirty(false);
      if (successCopy) {
        setSuccessMessage(successCopy);
      }
      onSuccess?.();
    } catch (err) {
      setErrorMessage(getErrorMessage(err, 'Terjadi kesalahan saat memproses sesi desain.'));
    }
  };

  const handleSaveCourseContext = () => {
    const normalizedTopic = topic.trim();
    const normalizedContext = additionalContext.trim();
    const normalizedCategory = courseCategory.trim();
    const normalizedClient = clientCompanyName.trim();
    const normalizedTitle = courseTitle.trim();
    const normalizedCommercialOverview = commercialOverview.trim();

    if (!normalizedTopic) {
      setErrorMessage('Topik kursus wajib diisi sebelum melanjutkan.');
      return;
    }

    void runAction(
      () =>
        updateCourseContext({
          topic: normalizedTopic,
          target_level: targetLevel,
          additional_context: normalizedContext,
          course_category: normalizedCategory,
          client_company_name: normalizedClient,
          course_title: normalizedTitle,
          commercial_overview: normalizedCommercialOverview,
        }),
      'Arah kursus berhasil disimpan.'
    );
  };

  const handleFinalize = () => {
    void runAction(
      async () => {
        const result = await finalizeSession();
        router.replace(`/syllabus/${result.syllabus.id}`);
      },
      'Kurikulum berhasil difinalkan.'
    );
  };

  const toggleElo = (option: ELOOption) => {
    setEloDirty(true);
    setSelectedEloIds((current) =>
      current.includes(option.id)
        ? current.filter((id) => id !== option.id)
        : [...current, option.id]
    );
  };

  if (isLoading && !session) {
    return <LoadingSpinner fullScreen message="Memuat sesi desain..." />;
  }

  if (error && !session) {
    return (
      <ScrollView className="flex-1 bg-background">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <Card className="border border-red-200 bg-red-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-red-700">Gagal memuat sesi desain</Text>
              <Text className="text-red-700">
                {getErrorMessage(error, 'Sesi desain belum dapat dimuat saat ini.')}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <Button title="Coba lagi" onPress={() => void refetch()} />
                <Button title="Lihat silabus" variant="outline" onPress={() => router.push('/syllabus/generated')} />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  if (!session) {
    return (
      <ScrollView className="flex-1 bg-background">
        <View className="mx-auto w-full max-w-3xl p-4 lg:p-8">
          <Card className="border border-amber-200 bg-amber-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-amber-700">Sesi desain tidak ditemukan</Text>
              <Text className="text-amber-700">
                Buka draft lain atau mulai create flow baru dari daftar draft aktif.
              </Text>
              <View className="flex-row flex-wrap gap-3">
                <Button title="Mulai create flow" onPress={() => router.push('/syllabus/create')} />
                <Button title="Lihat silabus" variant="outline" onPress={() => router.push('/syllabus/generated')} />
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="mx-auto w-full max-w-6xl gap-6 p-4 lg:p-8">
        <PageHeader
          eyebrow={`Tahap aktif · ${activeStepLabel}`}
          title={session.course_context?.topic?.trim() || 'Susun kurikulum baru'}
          actions={
            <Button
              title="Kembali ke daftar"
              variant="ghost"
              onPress={() => router.push('/syllabus/generated')}
              icon={<Ionicons name="arrow-back" size={18} color={colors.textSecondary} />}
            />
          }
          aside={
            <View className="gap-1">
              <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Langkah sekarang</Text>
              <Text className="text-sm font-semibold text-neutral-900">{activeStepLabel}</Text>
            </View>
          }
        />

        <ProgressStepper steps={WIZARD_STEPS} activeIndex={currentStepIndex} />

        {errorMessage ? <AlertBanner variant="error" title="Langkah ini belum berhasil" description={errorMessage} /> : null}
        {successMessage ? <AlertBanner variant="success" title="Perubahan tersimpan" description={successMessage} /> : null}

        <View className={`gap-6 ${isDesktop ? 'flex-row items-start' : ''}`}>
          <View className={isDesktop ? 'flex-1 gap-6' : 'gap-6'}>
            {showStartAssist ? (
              <Card title="Mulai ringkasan sumber" subtitle="Sistem akan merangkum dokumen yang dipilih dan menyiapkan konteks perusahaan.">
                <View className="gap-4">
                  <Text className="text-neutral-600">
                    Jalankan langkah ini bila sesi lama Anda belum memiliki ringkasan awal.
                  </Text>
                  <Button
                    title="Mulai ringkasan"
                    onPress={() => void runAction(() => startAssist(), 'Ringkasan sumber berhasil diperbarui.')}
                    isLoading={isWorking}
                    icon={<Ionicons name="sparkles-outline" size={18} color="white" />}
                  />
                </View>
              </Card>
            ) : null}

            {showCourseContext ? (
              <Card title="Tetapkan arah kurikulum">
                <View className="gap-4">
                  <TextField
                    label="Topik kursus"
                    required
                    value={topic}
                    onChangeText={(value) => {
                      setCourseContextDirty(true);
                      setTopic(value);
                    }}
                    placeholder="Contoh: Fundamen Data Analytics"
                  />
                  <View className="gap-2">
                    <Text className="font-semibold text-neutral-900">
                      Target level <Text className="text-primary">*</Text>
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {LEVEL_OPTIONS.map((level) => (
                        <Pressable
                          key={level}
                          onPress={() => {
                            setCourseContextDirty(true);
                            setTargetLevel(level);
                          }}
                          className={`rounded-full border px-4 py-2 ${
                            targetLevel === level ? 'border-primary bg-primary-50' : 'border-neutral-200 bg-surface'
                          }`}
                        >
                          <Text className={targetLevel === level ? 'font-semibold text-primary' : 'text-neutral-600'}>
                            Level {level}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <TextField
                    label="Kategori kursus"
                    value={courseCategory}
                    onChangeText={(value) => {
                      setCourseContextDirty(true);
                      setCourseCategory(value);
                    }}
                    placeholder="Contoh: Technical Upskilling"
                  />
                  <TextField
                    label="Nama klien atau perusahaan"
                    value={clientCompanyName}
                    onChangeText={(value) => {
                      setCourseContextDirty(true);
                      setClientCompanyName(value);
                    }}
                    placeholder="Contoh: PT Telkom Indonesia"
                  />
                  <TextField
                    label="Judul tampilan kursus"
                    value={courseTitle}
                    onChangeText={(value) => {
                      setCourseContextDirty(true);
                      setCourseTitle(value);
                    }}
                    placeholder="Contoh: AI for Business Decision Making"
                  />
                  <TextField
                    label="Konteks tambahan"
                    value={additionalContext}
                    onChangeText={(value) => {
                      setCourseContextDirty(true);
                      setAdditionalContext(value);
                    }}
                    multiline
                    placeholder="Tambahkan sasaran peserta, batasan, atau kebutuhan bisnis khusus."
                  />
                  <TextField
                    label="Ringkasan perusahaan / kebutuhan bisnis"
                    value={commercialOverview}
                    onChangeText={(value) => {
                      setCourseContextDirty(true);
                      setCommercialOverview(value);
                    }}
                    multiline
                    placeholder="Contoh: PT X bergerak di layanan digital dan konektivitas..."
                  />
                  <Button title="Simpan arah kurikulum" onPress={handleSaveCourseContext} isLoading={isWorking} />
                </View>
              </Card>
            ) : null}

            {showGenerateTlo ? (
              <Card title="Buat tujuan akhir" subtitle="Sistem akan menurunkan beberapa opsi tujuan akhir dari konteks kursus yang sudah Anda tetapkan.">
                <Button
                  title="Buat tujuan akhir"
                  onPress={() => void runAction(() => generateTloOptions(), 'Opsi tujuan akhir berhasil dibuat.')}
                  isLoading={isWorking}
                />
              </Card>
            ) : null}

            {showSelectTlo ? (
              <OptionSelectionCard
                title="Pilih tujuan akhir"
                subtitle="Pilih satu tujuan yang paling mewakili hasil belajar akhir. Jika belum pas, coba opsi lain."
                options={session.tlo_options}
                actionLabel="Gunakan tujuan ini"
                isWorking={isWorking}
                onSelect={(optionId) =>
                  void runAction(() => selectTlo(optionId), 'Tujuan akhir berhasil dipilih.')
                }
                secondaryActionLabel="Coba opsi lain"
                onSecondaryAction={() =>
                  void runAction(() => generateTloOptions(), 'Opsi tujuan akhir baru berhasil dibuat.')
                }
              />
            ) : null}

            {showGeneratePerformance ? (
              <Card title="Buat target performa" subtitle="Sistem akan menurunkan target performa yang mendukung tujuan akhir yang Anda pilih.">
                <View className="gap-4">
                  {session.selected_tlo ? (
                    <View className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                      <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Tujuan akhir terpilih</Text>
                      <Text className="mt-2 text-sm leading-6 text-neutral-800">{session.selected_tlo.text}</Text>
                    </View>
                  ) : null}
                  <View className="flex-row flex-wrap gap-3">
                    <Button
                      title="Coba opsi tujuan akhir lain"
                      variant="outline"
                      onPress={() =>
                        void runAction(() => generateTloOptions(), 'Opsi tujuan akhir baru berhasil dibuat.')
                      }
                      isLoading={isWorking}
                    />
                    <Button
                      title="Buat target performa"
                      onPress={() =>
                        void runAction(
                          () => generatePerformanceOptions(),
                          'Opsi target performa berhasil dibuat.'
                        )
                      }
                      isLoading={isWorking}
                    />
                  </View>
                </View>
              </Card>
            ) : null}

            {showSelectPerformance ? (
              <OptionSelectionCard
                title="Pilih target performa"
                subtitle="Pilih satu target performa sebagai dasar modul belajar. Jika belum pas, coba opsi lain."
                options={session.performance_options}
                actionLabel="Gunakan target ini"
                isWorking={isWorking}
                onSelect={(optionId) =>
                  void runAction(() => selectPerformance(optionId), 'Target performa berhasil dipilih.')
                }
                secondaryActionLabel="Coba opsi lain"
                onSecondaryAction={() =>
                  void runAction(
                    () => generatePerformanceOptions(),
                    'Opsi target performa baru berhasil dibuat.'
                  )
                }
              />
            ) : null}

            {showGenerateElo ? (
              <Card title="Buat modul belajar" subtitle="Sistem akan membuat beberapa modul belajar dari target performa yang sudah dipilih.">
                <View className="gap-4">
                  {session.selected_performance ? (
                    <View className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                      <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Target performa terpilih</Text>
                      <Text className="mt-2 text-sm leading-6 text-neutral-800">{session.selected_performance.text}</Text>
                    </View>
                  ) : null}
                  <View className="flex-row flex-wrap gap-3">
                    <Button
                      title="Coba opsi performa lain"
                      variant="outline"
                      onPress={() =>
                        void runAction(
                          () => generatePerformanceOptions(),
                          'Opsi target performa baru berhasil dibuat.'
                        )
                      }
                      isLoading={isWorking}
                    />
                    <Button
                      title="Buat modul belajar"
                      onPress={() => void runAction(() => generateEloOptions(), 'Opsi modul belajar berhasil dibuat.')}
                      isLoading={isWorking}
                    />
                  </View>
                </View>
              </Card>
            ) : null}

            {showSelectElo ? (
              <Card title="Pilih modul belajar" subtitle="Anda dapat memilih lebih dari satu modul. Jika belum pas, buat ulang opsi agar hasilnya lebih cocok.">
                <View className="gap-4">
                  <View className="flex-row justify-end">
                    <Button
                      title="Buat ulang opsi"
                      variant="outline"
                      onPress={() =>
                        void runAction(() => generateEloOptions(), 'Opsi modul belajar berhasil diperbarui.')
                      }
                      isLoading={isWorking}
                    />
                  </View>
                  {session.elo_options.map((option) => {
                    const isSelected = selectedEloIds.includes(option.id);
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => toggleElo(option)}
                        className={`rounded-2xl border p-4 ${
                          isSelected ? 'border-primary bg-primary-50' : 'border-neutral-200 bg-surface'
                        }`}
                      >
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1 gap-2">
                            <Text className="text-lg font-semibold text-neutral-900">{option.elo}</Text>
                            <Text className="text-neutral-600">{option.rationale}</Text>
                          </View>
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={24}
                            color={isSelected ? colors.primary : colors.textSecondary}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                  <Button
                    title="Simpan modul terpilih"
                    onPress={() =>
                      void runAction(
                        () => selectElos(selectedEloIds),
                        'Modul belajar terpilih berhasil disimpan.'
                      )
                    }
                    disabled={selectedEloIds.length === 0}
                    isLoading={isWorking}
                  />
                </View>
              </Card>
            ) : null}

            {showFinalize ? (
              <Card title="Finalkan kurikulum" subtitle="Semua komponen utama sudah siap untuk disusun menjadi hasil akhir.">
                <View className="gap-4">
                  <View className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                    <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Modul belajar terpilih</Text>
                    <Text className="mt-2 text-sm leading-6 text-neutral-800">{session.selected_elos.length} modul siap difinalkan.</Text>
                  </View>
                  <Text className="text-neutral-600">
                    Sistem akan menyusun kurikulum final dari tujuan, target performa, dan modul belajar yang sudah Anda tetapkan.
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    <Button
                      title="Buat ulang opsi modul"
                      variant="outline"
                      onPress={() =>
                        void runAction(() => generateEloOptions(), 'Opsi modul belajar berhasil diperbarui.')
                      }
                      isLoading={isWorking}
                    />
                    <Button
                      title="Finalkan kurikulum"
                      onPress={handleFinalize}
                      isLoading={isWorking}
                      icon={<Ionicons name="checkmark-circle-outline" size={18} color="white" />}
                    />
                  </View>
                </View>
              </Card>
            ) : null}

            {showCompleted ? (
              <Card title="Kurikulum siap dipakai" subtitle="Penyusunan selesai. Langkah berikutnya adalah meninjau hasilnya dan masuk ke personalisasi dari halaman detail silabus.">
                <View className="flex-row flex-wrap gap-3">
                  <Button title="Buka kurikulum" onPress={() => router.push(`/syllabus/${session.finalized_syllabus_id}`)} />
                  <Button title="Lihat daftar" variant="outline" onPress={() => router.push('/syllabus/generated')} />
                </View>
              </Card>
            ) : null}
          </View>

          <View className={isDesktop ? 'w-[320px] gap-6' : 'gap-6'}>
            <Card title="Ringkasan sumber" subtitle={session.source_summary?.company_name || 'Konteks materi dan perusahaan'}>
              <View className="gap-3">
                <Text className="text-sm leading-6 text-neutral-700">
                  {session.source_summary?.company_profile_summary || session.source_summary?.summary || 'Ringkasan sumber akan muncul setelah analisis awal.'}
                </Text>
                {session.source_summary?.company_profile_focus?.length ? (
                  <View className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
                    <Text className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Fokus perusahaan</Text>
                    <View className="mt-2 gap-2">
                      {session.source_summary.company_profile_focus.map((point) => (
                        <Text key={point} className="text-sm leading-6 text-neutral-700">• {point}</Text>
                      ))}
                    </View>
                  </View>
                ) : null}
                {session.source_summary?.company_profile_confidence ? (
                  <Text className="text-xs text-neutral-500">
                    Confidence deteksi: {session.source_summary.company_profile_confidence}
                  </Text>
                ) : null}
              </View>
            </Card>

            {showPerformancePreview ? (
              <Card title="Pratinjau target hasil" subtitle="Pastikan performa, kondisi, dan standar sudah sejalan sebelum finalisasi.">
                <View className="gap-3">
                  <PreviewField label="Performance" value={session.selected_performance?.text ?? 'Belum dipilih'} />
                  <PreviewField label="Condition" value={session.preview_condition_result ?? 'Akan muncul setelah performa dipilih.'} />
                  <PreviewField label="Standard" value={session.preview_standard_result ?? 'Akan disesuaikan setelah ELO dipilih.'} />
                </View>
              </Card>
            ) : null}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

interface OptionSelectionCardProps {
  title: string;
  subtitle: string;
  options: DesignOption[];
  actionLabel: string;
  isWorking: boolean;
  onSelect: (optionId: string) => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

function OptionSelectionCard({
  title,
  subtitle,
  options,
  actionLabel,
  isWorking,
  onSelect,
  secondaryActionLabel,
  onSecondaryAction,
}: OptionSelectionCardProps) {
  return (
    <Card title={title} subtitle={subtitle}>
      <View className="gap-4">
        {secondaryActionLabel && onSecondaryAction ? (
          <View className="flex-row justify-end">
            <Button title={secondaryActionLabel} variant="outline" onPress={onSecondaryAction} isLoading={isWorking} />
          </View>
        ) : null}
        {options.map((option) => (
          <Card key={option.id} className="border border-neutral-200 bg-neutral-50">
            <View className="gap-3">
              <View className="flex-row items-start justify-between gap-3">
                <Text className="flex-1 text-lg font-semibold text-neutral-900">{option.text}</Text>
                <View className="rounded-full bg-primary-50 px-3 py-1">
                  <Text className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Pilihan</Text>
                </View>
              </View>
              <Text className="leading-6 text-neutral-600">{option.rationale}</Text>
              <View className="flex-row justify-end">
                <Button title={actionLabel} variant="outline" onPress={() => onSelect(option.id)} isLoading={isWorking} />
              </View>
            </View>
          </Card>
        ))}
      </View>
    </Card>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-1 rounded-2xl border border-neutral-100 bg-neutral-50 p-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</Text>
      <Text className="text-sm leading-6 text-neutral-800">{value}</Text>
    </View>
  );
}
