import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, getErrorMessage } from '../../src/services/api';
import { useSSE } from '../../src/hooks/useSSE';
import { useSyllabus } from '../../src/hooks/useSyllabus';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { LoadingSpinner } from '../../src/components/ui/LoadingSpinner';
import { colors } from '../../src/theme/colors';
import type { ChatMessage, ELO } from '../../src/types/api';
import { emptyLearningJourney, syllabusTitle } from '../../src/utils/syllabus';

function eloLinesFromDraft(elos: ELO[]): string {
  return elos.map((item) => `${item.elo} :: ${item.pce.join(' | ')}`).join('\n');
}

function parseEloDraft(value: string): ELO[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [elo, pceRaw = ''] = line.split('::').map((segment) => segment.trim());
      return {
        elo,
        pce: pceRaw
          .split('|')
          .map((item) => item.trim())
          .filter(Boolean),
      };
    });
}

function listToText(items: string[]): string {
  return items.join('\n');
}

function textToList(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ChatScreen() {
  const { syllabusId: syllabusIdParam, id } = useLocalSearchParams<{ syllabusId?: string; id?: string }>();
  const syllabusId = syllabusIdParam ?? id ?? '';
  const router = useRouter();
  const { syllabus, isLoading: isLoadingSyllabus, applyRevisionAsync, isApplyingRevision } = useSyllabus(syllabusId);

  const {
    data: history,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['chat', syllabusId],
    queryFn: () => apiGet<{ messages: ChatMessage[] }>(`/chat/${syllabusId}/history`),
    enabled: !!syllabusId,
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedSourceMessageId, setSelectedSourceMessageId] = useState<string | null>(null);
  const [revisionSummary, setRevisionSummary] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [tloDraft, setTloDraft] = useState('');
  const [eloDraft, setEloDraft] = useState('');
  const [preLearningDraft, setPreLearningDraft] = useState('');
  const [classroomDraft, setClassroomDraft] = useState('');
  const [afterLearningDraft, setAfterLearningDraft] = useState('');
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  useEffect(() => {
    if (history?.messages) {
      setMessages(history.messages);
    }
  }, [history]);

  useEffect(() => {
    if (!syllabus) {
      return;
    }

    const journey = syllabus.journey ?? emptyLearningJourney();
    setTloDraft(syllabus.tlo);
    setEloDraft(eloLinesFromDraft(syllabus.elos));
    setPreLearningDraft(listToText(journey.pre_learning));
    setClassroomDraft(listToText(journey.classroom));
    setAfterLearningDraft(listToText(journey.after_learning));
  }, [syllabus]);

  const { startSSE } = useSSE(
    `/chat/${syllabusId}/message`,
    (chunk) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.id === 'streaming') {
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        }
        return prev;
      });
    },
    () => {
      setIsStreaming(false);
      void refetchHistory();
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === 'streaming') {
          return [...prev.slice(0, -1), { ...last, id: Date.now().toString() }];
        }
        return prev;
      });
    }
  );

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming || !syllabusId) {
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      syllabus_id: syllabusId,
      role: 'user',
      content: inputText.trim(),
      created_at: new Date().toISOString(),
      revision_applied: null,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsStreaming(true);
    setApplySuccess(null);

    setMessages((prev) => [
      ...prev,
      {
        id: 'streaming',
        syllabus_id: syllabusId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        revision_applied: null,
      },
    ]);

    await startSSE({ content: userMsg.content });
  };

  const canApplyRevision = useMemo(() => !!syllabus && !isApplyingRevision, [isApplyingRevision, syllabus]);

  const handleApplyRevision = async () => {
    if (!syllabus) {
      return;
    }

    const nextElos = parseEloDraft(eloDraft);
    const nextJourney = {
      pre_learning: textToList(preLearningDraft),
      classroom: textToList(classroomDraft),
      after_learning: textToList(afterLearningDraft),
    };

    const payload: {
      summary?: string;
      reason?: string;
      source_message_id?: string;
      tlo?: string;
      elos?: ELO[];
      journey?: typeof nextJourney;
    } = {};

    if (revisionSummary.trim()) {
      payload.summary = revisionSummary.trim();
    }

    if (revisionReason.trim()) {
      payload.reason = revisionReason.trim();
    }

    if (selectedSourceMessageId) {
      payload.source_message_id = selectedSourceMessageId;
    }

    if (tloDraft.trim() !== syllabus.tlo) {
      payload.tlo = tloDraft.trim();
    }

    if (JSON.stringify(nextElos) !== JSON.stringify(syllabus.elos)) {
      payload.elos = nextElos;
    }

    if (JSON.stringify(nextJourney) !== JSON.stringify(syllabus.journey ?? emptyLearningJourney())) {
      payload.journey = nextJourney;
    }

    if (!payload.tlo && !payload.elos && !payload.journey) {
      setApplyError('Ubah minimal satu field syllabus sebelum menerapkan revisi.');
      return;
    }

    setApplyError(null);
    setApplySuccess(null);

    try {
      await applyRevisionAsync(payload);
      setApplySuccess('Revisi berhasil diterapkan ke syllabus final.');
      void refetchHistory();
    } catch (error) {
      setApplyError(getErrorMessage(error, 'Revisi belum dapat diterapkan.'));
    }
  };

  if ((isLoadingHistory || isLoadingSyllabus) && !syllabus) {
    return <LoadingSpinner fullScreen message="Memuat workspace revisi..." />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      className="flex-1 bg-gray-50"
    >
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
        <View className="mx-auto w-full max-w-6xl gap-6">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="rounded-full bg-white p-2">
              <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900">Revision Workspace</Text>
              <Text className="text-gray-500">
                {syllabus ? syllabusTitle(syllabus) : 'Syllabus'} - chat with AI, review the suggestion, then apply the exact structured update.
              </Text>
            </View>
          </View>

          {historyError ? (
            <Card className="border border-amber-200 bg-amber-50">
              <Text className="font-semibold text-amber-700">Riwayat chat belum lengkap dimuat</Text>
              <Text className="mt-1 text-amber-700">{getErrorMessage(historyError, 'Silakan muat ulang workspace revisi.')}</Text>
              <View className="mt-3 flex-row gap-3">
                <Button title="Muat Ulang" onPress={() => void refetchHistory()} />
              </View>
            </Card>
          ) : null}

          <View className="gap-6 lg:flex-row lg:items-start">
            <View className="flex-1 gap-4">
              <Card title="AI Revision Chat" subtitle="Gunakan chat untuk meminta usulan revisi, lalu tandai pesan AI yang dipakai sebagai provenance.">
                <View className="gap-4">
                  {messages.length === 0 ? (
                    <Text className="text-gray-500">Belum ada percakapan. Minta AI mengusulkan revisi syllabus ini terlebih dahulu.</Text>
                  ) : (
                    messages.map((item) => {
                      const isUser = item.role === 'user';
                      const isSelected = item.id === selectedSourceMessageId;

                      return (
                        <View key={item.id} className={`gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
                          <View className={`max-w-[92%] rounded-2xl px-4 py-3 ${isUser ? 'bg-primary' : 'border border-gray-200 bg-white'}`}>
                            {item.content === '' && item.id === 'streaming' ? (
                              <ActivityIndicator color={colors.primary} />
                            ) : (
                              <Text className={isUser ? 'text-white' : 'text-gray-800'}>{item.content}</Text>
                            )}
                            <Text className={`mt-2 text-[10px] ${isUser ? 'text-red-100' : 'text-gray-400'}`}>
                              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>

                          {!isUser && item.id !== 'streaming' ? (
                            <View className="flex-row flex-wrap items-center gap-2">
                              <Button
                                title={isSelected ? 'Sumber Revisi Dipilih' : 'Gunakan sebagai Sumber Revisi'}
                                variant={isSelected ? 'secondary' : 'outline'}
                                size="sm"
                                onPress={() => setSelectedSourceMessageId(isSelected ? null : item.id)}
                              />
                              {item.revision_applied ? (
                                <Text className="text-xs font-medium text-green-600">Sudah pernah diterapkan</Text>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })
                  )}

                  <View className="gap-3 border-t border-gray-100 pt-4">
                    <TextInput
                      className="min-h-[110px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-800"
                      placeholder="Contoh: revisi TLO agar lebih spesifik untuk peserta level menengah dan tambahkan after-learning yang lebih aplikatif."
                      placeholderTextColor="#9CA3AF"
                      value={inputText}
                      onChangeText={setInputText}
                      multiline
                      textAlignVertical="top"
                    />
                    <Button
                      title="Kirim ke AI"
                      onPress={() => void handleSend()}
                      disabled={!inputText.trim() || isStreaming}
                      isLoading={isStreaming}
                      icon={<Ionicons name="send" size={18} color="white" />}
                    />
                  </View>
                </View>
              </Card>
            </View>

            <View className="flex-1 gap-4">
              <Card title="Structured Apply" subtitle="Review hasil final yang akan ditulis ke syllabus. Apply bersifat eksplisit dan masuk ke audit trail.">
                <View className="gap-4">
                  <View className="rounded-2xl border border-red-100 bg-red-50 p-4">
                    <Text className="font-semibold text-primary">Sumber pesan AI</Text>
                    <Text className="mt-1 text-sm text-gray-700">
                      {selectedSourceMessageId ? `Pesan ${selectedSourceMessageId} akan dicatat sebagai provenance revisi.` : 'Belum ada pesan AI yang dipilih sebagai provenance.'}
                    </Text>
                  </View>

                  {applyError ? (
                    <View className="rounded-2xl border border-red-200 bg-red-50 p-4">
                      <Text className="font-medium text-red-700">{applyError}</Text>
                    </View>
                  ) : null}

                  {applySuccess ? (
                    <View className="rounded-2xl border border-green-200 bg-green-50 p-4">
                      <Text className="font-medium text-green-700">{applySuccess}</Text>
                    </View>
                  ) : null}

                  <Field label="Summary Revisi">
                    <TextInput
                      value={revisionSummary}
                      onChangeText={setRevisionSummary}
                      placeholder="Ringkas perubahan yang sedang Anda terapkan."
                      className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    />
                  </Field>

                  <Field label="Reason / Business Note">
                    <TextInput
                      value={revisionReason}
                      onChangeText={setRevisionReason}
                      placeholder="Alasan bisnis, feedback stakeholder, atau catatan target audience."
                      multiline
                      textAlignVertical="top"
                      className="min-h-[96px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    />
                  </Field>

                  <Field label="TLO Final">
                    <TextInput
                      value={tloDraft}
                      onChangeText={setTloDraft}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[96px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    />
                  </Field>

                  <Field label="ELOs Final">
                    <Text className="mb-2 text-xs text-gray-500">Satu baris per ELO dengan format `ELO :: PCE1 | PCE2 | PCE3`.</Text>
                    <TextInput
                      value={eloDraft}
                      onChangeText={setEloDraft}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[160px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    />
                  </Field>

                  <Field label="Pre-Learning">
                    <TextInput
                      value={preLearningDraft}
                      onChangeText={setPreLearningDraft}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[96px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    />
                  </Field>

                  <Field label="Classroom">
                    <TextInput
                      value={classroomDraft}
                      onChangeText={setClassroomDraft}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[96px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    />
                  </Field>

                  <Field label="After-Learning">
                    <TextInput
                      value={afterLearningDraft}
                      onChangeText={setAfterLearningDraft}
                      multiline
                      textAlignVertical="top"
                      className="min-h-[96px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900"
                    />
                  </Field>

                  <View className="flex-row flex-wrap gap-3">
                    <Button title="Apply Revision" onPress={() => void handleApplyRevision()} disabled={!canApplyRevision} isLoading={isApplyingRevision} />
                    <Button title="Buka Detail" variant="outline" onPress={() => router.push(`/syllabus/${syllabusId}`)} />
                  </View>
                </View>
              </Card>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <View className="gap-2">
      <Text className="font-semibold text-gray-900">{label}</Text>
      {children}
    </View>
  );
}
