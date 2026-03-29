import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View, Pressable, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { useDesignSession } from '../../src/hooks/useDesignSession';
import { getErrorMessage } from '../../src/services/api';
import { colors } from '../../src/theme/colors';
import type { DesignOption, DesignSessionWizardStep, ELOOption } from '../../src/types/designSession';

const WIZARD_STEPS: Array<{ value: DesignSessionWizardStep; label: string }> = [
  { value: 'uploaded', label: 'Dokumen' },
  { value: 'summary_ready', label: 'Ringkasan' },
  { value: 'course_context_set', label: 'Konteks Kursus' },
  { value: 'tlo_options_ready', label: 'Opsi TLO' },
  { value: 'tlo_selected', label: 'TLO Dipilih' },
  { value: 'performance_options_ready', label: 'Opsi Performa' },
  { value: 'performance_selected', label: 'Performa Dipilih' },
  { value: 'elo_options_ready', label: 'Opsi ELO' },
  { value: 'elo_selected', label: 'ELO Dipilih' },
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

  useEffect(() => {
    if (!session?.course_context) {
      return;
    }

    setTopic(session.course_context.topic);
    setTargetLevel(session.course_context.target_level);
    setAdditionalContext(session.course_context.additional_context);
    setCourseCategory(session.course_context.course_category ?? '');
    setClientCompanyName(session.course_context.client_company_name ?? '');
    setCourseTitle(session.course_context.course_title ?? '');
    setCommercialOverview(session.course_context.commercial_overview ?? '');
  }, [session?.course_context]);

  useEffect(() => {
    if (!session) {
      return;
    }

    setSelectedEloIds(session.selected_elos.map((option) => option.id));
  }, [session?.selected_elos]);

  const currentStepIndex = useMemo(() => {
    if (!session) {
      return 0;
    }

    const activeStep = session.finalized_syllabus_id ? 'finalized' : session.wizard_step;
    return Math.max(WIZARD_STEPS.findIndex((step) => step.value === activeStep), 0);
  }, [session]);

  const activeStep = session?.finalized_syllabus_id ? 'finalized' : session?.wizard_step;

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
  const showPerformancePreview = !!session?.selected_performance && (showGenerateElo || showSelectElo || showFinalize || showCompleted);

  const runAction = async (action: () => Promise<unknown>, onSuccess?: () => void) => {
    setErrorMessage(null);

    try {
      await action();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'Terjadi kesalahan saat memproses sesi desain.'));
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

    void runAction(() =>
      updateCourseContext({
        topic: normalizedTopic,
        target_level: targetLevel,
        additional_context: normalizedContext,
        course_category: normalizedCategory,
        client_company_name: normalizedClient,
        course_title: normalizedTitle,
        commercial_overview: normalizedCommercialOverview,
      })
    );
  };

  const handleFinalize = () => {
    void runAction(
      async () => {
        const result = await finalizeSession();
        router.replace(`/syllabus/${result.syllabus.id}`);
      }
    );
  };

  const toggleElo = (option: ELOOption) => {
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
        <View className="max-w-3xl mx-auto w-full p-4 lg:p-8">
          <Card className="border border-red-200 bg-red-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-red-700">Gagal memuat sesi desain</Text>
              <Text className="text-red-700">{getErrorMessage(error, 'Sesi desain belum dapat dimuat saat ini.')}</Text>
              <View className="flex-row flex-wrap gap-3">
                <Button title="Coba Lagi" onPress={() => void refetch()} />
                <Button title="Lihat Draft Aktif" variant="outline" onPress={() => router.push('/design-session')} />
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
        <View className="max-w-3xl mx-auto w-full p-4 lg:p-8">
          <Card className="border border-amber-200 bg-amber-50">
            <View className="gap-4">
              <Text className="text-xl font-bold text-amber-700">Sesi desain tidak ditemukan</Text>
               <Text className="text-amber-700">Buka draft lain atau mulai create flow baru dari daftar draft aktif.</Text>
               <View className="flex-row flex-wrap gap-3">
                 <Button title="Mulai Create Flow" onPress={() => router.push('/syllabus/create')} />
                 <Button title="Lihat Draft Aktif" variant="outline" onPress={() => router.push('/design-session')} />
               </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" showsVerticalScrollIndicator={false}>
      <View className="max-w-6xl mx-auto w-full p-4 lg:p-8 gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-gray-900">
            {session.course_context?.topic ?? 'Sesi Desain Baru'}
          </Text>
          <Text className="text-gray-500 text-base">
            Create flow ini mengikuti progres backend. Setiap langkah akan tersimpan otomatis saat Anda mengirim pilihan berikutnya.
          </Text>
        </View>

        <View className={`gap-6 ${isDesktop ? 'flex-row items-start' : ''}`}>
          <View className={isDesktop ? 'w-[320px] gap-4' : 'gap-4'}>
            <Card title="Progres Sesi" subtitle={`Langkah aktif: ${WIZARD_STEPS[currentStepIndex]?.label ?? session.wizard_step}`}>
              <View className="gap-3">
                {WIZARD_STEPS.map((step, index) => {
                  const isComplete = index < currentStepIndex;
                  const isActive = step.value === session.wizard_step;

                  return (
                    <View key={step.value} className="flex-row items-center gap-3">
                      <View className={`w-8 h-8 rounded-full items-center justify-center ${isComplete || isActive ? 'bg-primary' : 'bg-gray-100'}`}>
                        <Ionicons
                          name={isComplete ? 'checkmark' : 'ellipse-outline'}
                          size={16}
                          color={isComplete || isActive ? '#FFFFFF' : colors.textSecondary}
                        />
                      </View>
                      <Text className={isActive ? 'font-semibold text-gray-900' : 'text-gray-500'}>{step.label}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            <Card title="Ringkasan Sumber" subtitle={`${session.document_ids.length} dokumen dipilih`}>
              {session.source_summary ? (
                <View className="gap-3">
                  <Text className="text-gray-700 leading-6">{session.source_summary.summary}</Text>
                  {session.source_summary.company_profile_focus.length > 0 ? (
                    <View className="gap-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">Company profile focus</Text>
                      {session.source_summary.company_profile_focus.map((point) => (
                        <Text key={point} className="text-sm text-gray-700">• {point}</Text>
                      ))}
                    </View>
                  ) : null}
                  {session.source_summary.key_points.map((point) => (
                    <View key={point} className="flex-row items-start gap-2">
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                      <Text className="flex-1 text-gray-600">{point}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-gray-500">Ringkasan sumber akan muncul setelah Anda menjalankan analisis awal.</Text>
              )}
            </Card>
          </View>

          <View className="flex-1 gap-4">
            {errorMessage ? (
              <Card className="border border-red-200 bg-red-50">
                <Text className="text-red-700 font-medium">{errorMessage}</Text>
              </Card>
            ) : null}

            {showStartAssist ? (
              <Card title="1. Analisis Dokumen" subtitle="Backend akan membuat ringkasan sumber sebagai titik awal desain.">
                <Text className="text-gray-600 mb-4">
                  Jalankan asistensi awal untuk merangkum dokumen dan menyiapkan langkah-langkah berikutnya.
                </Text>
                <Button
                  title="Mulai Analisis"
                  onPress={() => void runAction(() => startAssist())}
                  isLoading={isWorking}
                  icon={<Ionicons name="sparkles-outline" size={18} color="white" />}
                />
              </Card>
            ) : null}

            {showCourseContext ? (
                <Card title="2. Tentukan Konteks Kursus" subtitle="Lengkapi arah kursus dan konteks ekspor agar backend bisa membuat opsi TLO sekaligus menyiapkan snapshot final.">
                  <View className="gap-4">
                  <View className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <Text className="text-sm text-gray-600">Kolom bertanda <Text className="font-semibold text-primary">*</Text> wajib diisi. Kolom lain bersifat opsional.</Text>
                  </View>
                   <View className="gap-2">
                    <Text className="font-semibold text-gray-900">Topik Kursus <Text className="text-primary">*</Text></Text>
                    <TextInput
                      value={topic}
                      onChangeText={setTopic}
                      placeholder="Contoh: Fundamen Data Analytics"
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900"
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="font-semibold text-gray-900">Target Level <Text className="text-primary">*</Text></Text>
                    <View className="flex-row flex-wrap gap-2">
                      {LEVEL_OPTIONS.map((level) => (
                        <Pressable
                          key={level}
                          onPress={() => setTargetLevel(level)}
                          className={`px-4 py-2 rounded-full border ${targetLevel === level ? 'border-primary bg-red-50' : 'border-gray-200 bg-white'}`}
                        >
                          <Text className={targetLevel === level ? 'text-primary font-semibold' : 'text-gray-600'}>Level {level}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View className="gap-2">
                    <Text className="font-semibold text-gray-900">Kategori Kursus <Text className="text-gray-400">(Opsional)</Text></Text>
                    <TextInput
                      value={courseCategory}
                      onChangeText={setCourseCategory}
                      placeholder="Contoh: Technical Upskilling"
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900"
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="font-semibold text-gray-900">Nama Klien / Perusahaan <Text className="text-gray-400">(Opsional)</Text></Text>
                    <TextInput
                      value={clientCompanyName}
                      onChangeText={setClientCompanyName}
                      placeholder="Contoh: Telkom Indonesia"
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900"
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="font-semibold text-gray-900">Judul Kursus untuk Export <Text className="text-gray-400">(Opsional)</Text></Text>
                    <TextInput
                      value={courseTitle}
                      onChangeText={setCourseTitle}
                      placeholder="Contoh: AI for Business Decision Making"
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900"
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="font-semibold text-gray-900">Konteks Tambahan <Text className="text-gray-400">(Opsional)</Text></Text>
                    <TextInput
                      value={additionalContext}
                      onChangeText={setAdditionalContext}
                      multiline
                      numberOfLines={5}
                      textAlignVertical="top"
                      placeholder="Tambahkan sasaran peserta, batasan, atau kebutuhan bisnis khusus."
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900 min-h-[140px]"
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="font-semibold text-gray-900">Ringkasan Komersial / Business Need <Text className="text-gray-400">(Opsional)</Text></Text>
                    <TextInput
                      value={commercialOverview}
                      onChangeText={setCommercialOverview}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      placeholder="Tuliskan konteks komersial, target outcome bisnis, atau prioritas stakeholder."
                      className="border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-900 min-h-[120px]"
                    />
                  </View>

                  <Button title="Simpan Konteks Kursus" onPress={handleSaveCourseContext} isLoading={isWorking} />
                </View>
              </Card>
            ) : null}

            {showGenerateTlo ? (
              <Card title="3. Buat Opsi TLO" subtitle="Gunakan ringkasan dan konteks kursus untuk menurunkan alternatif tujuan akhir.">
                <Text className="text-gray-600 mb-4">
                  Setelah opsi dibuat, Anda bisa memilih TLO terbaik sebelum masuk ke performa dan ELO.
                </Text>
                <Button title="Generate TLO" onPress={() => void runAction(() => generateTloOptions())} isLoading={isWorking} />
              </Card>
            ) : null}

            {showSelectTlo ? (
              <OptionSelectionCard
                title="4. Pilih TLO"
                subtitle="Pilih satu opsi TLO sebagai arah utama silabus. Jika belum pas, generate ulang sampai sesuai."
                options={session.tlo_options}
                actionLabel="Gunakan TLO Ini"
                isWorking={isWorking}
                onSelect={(optionId) => void runAction(() => selectTlo(optionId))}
                secondaryActionLabel="Generate Ulang TLO"
                onSecondaryAction={() => void runAction(() => generateTloOptions())}
              />
            ) : null}

            {showGeneratePerformance ? (
              <Card title="5. Buat Opsi Performa" subtitle="Backend akan menurunkan alternatif performa dari TLO terpilih.">
                <Text className="text-gray-600 mb-4">Langkah ini menyiapkan bentuk performa utama yang harus dicapai peserta.</Text>
                <Button title="Generate Performa" onPress={() => void runAction(() => generatePerformanceOptions())} isLoading={isWorking} />
              </Card>
            ) : null}

            {showPerformancePreview ? (
              <Card title="PCS Preview" subtitle="Preview backend untuk Performance, Condition, dan Standard sebelum syllabus difinalkan.">
                <View className="gap-4">
                  <PreviewField label="Performance" value={session.selected_performance?.text ?? 'Belum dipilih'} />
                  <PreviewField label="Condition" value={session.preview_condition_result ?? 'Akan muncul setelah performa dipilih.'} />
                  <PreviewField label="Standard" value={session.preview_standard_result ?? 'Akan disesuaikan setelah ELO dipilih.'} />
                </View>
              </Card>
            ) : null}

            {showSelectPerformance ? (
              <OptionSelectionCard
                title="6. Pilih Performa"
                subtitle="Pilih satu performa terbaik sebagai dasar penurunan ELO. Jika belum pas, generate ulang sampai sesuai."
                options={session.performance_options}
                actionLabel="Gunakan Performa Ini"
                isWorking={isWorking}
                onSelect={(optionId) => void runAction(() => selectPerformance(optionId))}
                secondaryActionLabel="Generate Ulang Performa"
                onSecondaryAction={() => void runAction(() => generatePerformanceOptions())}
              />
            ) : null}

            {showGenerateElo ? (
              <Card title="7. Buat Opsi ELO" subtitle="Backend akan membuat daftar ELO berdasarkan performa yang dipilih.">
                <Text className="text-gray-600 mb-4">
                  Setelah opsi ELO tersedia, Anda dapat memilih beberapa modul yang paling cocok untuk silabus akhir.
                </Text>
                <Button title="Generate ELO" onPress={() => void runAction(() => generateEloOptions())} isLoading={isWorking} />
              </Card>
            ) : null}

            {showSelectElo ? (
              <Card title="8. Pilih ELO" subtitle="Anda dapat memilih lebih dari satu ELO untuk dibawa ke silabus final. Jika opsi belum cocok, generate ulang untuk hasil yang lebih tepat.">
                <View className="gap-4">
                  <View className="flex-row justify-end">
                    <Button title="Generate Ulang ELO" variant="outline" onPress={() => void runAction(() => generateEloOptions())} isLoading={isWorking} />
                  </View>
                  {session.elo_options.map((option) => {
                    const isSelected = selectedEloIds.includes(option.id);

                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => toggleElo(option)}
                        className={`rounded-xl border p-4 ${isSelected ? 'border-primary bg-red-50' : 'border-gray-200 bg-white'}`}
                      >
                        <View className="flex-row items-start justify-between gap-3">
                          <View className="flex-1 gap-2">
                            <Text className="text-lg font-semibold text-gray-900">{option.elo}</Text>
                            <Text className="text-gray-600">{option.rationale}</Text>
                          </View>
                          <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={24} color={isSelected ? colors.primary : colors.textSecondary} />
                        </View>
                      </Pressable>
                    );
                  })}

                  <Button
                    title="Simpan Pilihan ELO"
                    onPress={() => void runAction(() => selectElos(selectedEloIds))}
                    disabled={selectedEloIds.length === 0}
                    isLoading={isWorking}
                  />
                </View>
              </Card>
            ) : null}

            {showFinalize ? (
              <Card title="9. Finalisasi Silabus" subtitle="Sesi siap diubah menjadi silabus akhir yang dapat dibuka dan diunduh.">
                <View className="gap-4">
                  <Text className="text-gray-600">
                    Backend akan membuat silabus final dari pilihan TLO, performa, dan ELO yang sudah Anda tetapkan.
                  </Text>
                  <Button
                    title="Finalisasi Sekarang"
                    onPress={handleFinalize}
                    isLoading={isWorking}
                    icon={<Ionicons name="checkmark-circle-outline" size={18} color="white" />}
                  />
                </View>
              </Card>
            ) : null}

            {showCompleted ? (
              <Card title="Silabus Siap" subtitle="Sesi desain ini sudah selesai dan dapat dibuka kembali kapan saja.">
                <View className="gap-4">
                   <Text className="text-gray-600">Silabus akhir sudah dibuat. Lanjutkan ke halaman detail untuk revisi, personalisasi, atau unduh DOCX.</Text>
                   <View className="flex-row flex-wrap gap-3">
                     <Button title="Buka Silabus" onPress={() => router.push(`/syllabus/${session.finalized_syllabus_id}`)} />
                     <Button title="Generated List" variant="outline" onPress={() => router.push('/syllabus/generated')} />
                   </View>
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

function OptionSelectionCard({ title, subtitle, options, actionLabel, isWorking, onSelect, secondaryActionLabel, onSecondaryAction }: OptionSelectionCardProps) {
  return (
    <Card title={title} subtitle={subtitle}>
      <View className="gap-4">
        {secondaryActionLabel && onSecondaryAction ? (
          <View className="flex-row justify-end">
            <Button title={secondaryActionLabel} variant="outline" onPress={onSecondaryAction} isLoading={isWorking} />
          </View>
        ) : null}
        {options.map((option) => (
          <Card key={option.id} className="border border-gray-200 bg-gray-50">
            <View className="gap-3">
              <Text className="text-lg font-semibold text-gray-900">{option.text}</Text>
              <Text className="text-gray-600 leading-6">{option.rationale}</Text>
              <View className="flex-row justify-end">
                <Button
                  title={actionLabel}
                  variant="outline"
                  onPress={() => onSelect(option.id)}
                  isLoading={isWorking}
                />
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
    <View className="gap-1 rounded-xl border border-gray-100 bg-gray-50 p-3">
      <Text className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</Text>
      <Text className="text-sm leading-6 text-gray-800">{value}</Text>
    </View>
  );
}
