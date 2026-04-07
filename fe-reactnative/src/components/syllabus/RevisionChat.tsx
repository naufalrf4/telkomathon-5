import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';
import { AlertBanner } from '../ui/AlertBanner';
import { SectionDiff } from './SectionDiff';
import { useRevisionChat } from '../../hooks/useRevisionChat';
import { getErrorMessage } from '../../services/api';
import { colors } from '../../theme/colors';
import type { Syllabus } from '../../types/api';
import type { ChatMessage } from '../../types/chat';

interface RevisionChatProps {
  syllabusId: string;
  syllabus: Syllabus;
  onRevisionAccepted?: (sections: string[]) => void;
}

function renderInlineFormattedText(line: string, textClassName: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    const isBold = part.startsWith('**') && part.endsWith('**');
    const content = isBold ? part.slice(2, -2) : part;
    return (
      <Text
        key={`${part}-${index}`}
        className={`${textClassName} ${isBold ? 'font-semibold text-neutral-950' : ''}`.trim()}
      >
        {content}
      </Text>
    );
  });
}

function AssistantMessageContent({ content }: { content: string }) {
  const lines = content.split('\n').filter((line, index, all) => line.trim() || (index > 0 && all[index - 1].trim()));

  return (
    <View className="gap-2">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={`spacer-${index}`} className="h-1" />;
        }

        if (trimmed.startsWith('- ')) {
          const bulletContent = trimmed.slice(2);
          return (
            <View key={`bullet-${index}`} className="flex-row gap-2">
              <Text className="mt-[2px] text-sm leading-6 text-brand-700">•</Text>
              <Text className="flex-1 text-sm leading-6 text-neutral-800">
                {renderInlineFormattedText(bulletContent, 'text-sm leading-6 text-neutral-800')}
              </Text>
            </View>
          );
        }

        return (
          <Text key={`line-${index}`} className="text-sm leading-6 text-neutral-900">
            {renderInlineFormattedText(trimmed, 'text-sm leading-6 text-neutral-900')}
          </Text>
        );
      })}
    </View>
  );
}

function TypingIndicator() {
  return (
    <View className="flex-row items-end gap-3 px-4 py-2">
      <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
        <Ionicons name="sparkles" size={14} color={colors.aiAccent} />
      </View>
      <View className="rounded-2xl rounded-bl-sm bg-neutral-100 px-4 py-3">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-2 rounded-full bg-neutral-400" />
          <View className="h-2 w-2 rounded-full bg-neutral-400" />
          <View className="h-2 w-2 rounded-full bg-neutral-400" />
        </View>
      </View>
    </View>
  );
}

function StatusBadge({ status }: { status: ChatMessage['status'] }) {
  if (status === 'accepted') {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1">
        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
        <Text className="text-xs font-semibold text-emerald-700">Diterima</Text>
      </View>
    );
  }
  if (status === 'rejected') {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-red-50 px-2.5 py-1">
        <Ionicons name="close-circle" size={14} color={colors.error} />
        <Text className="text-xs font-semibold text-red-700">Ditolak</Text>
      </View>
    );
  }
  if (status === 'partial') {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1">
        <Ionicons name="remove-circle" size={14} color={colors.warning} />
        <Text className="text-xs font-semibold text-amber-700">Sebagian diproses</Text>
      </View>
    );
  }
  return null;
}

function SectionStatusBadge({ status }: { status: 'pending' | 'accepted' | 'rejected' }) {
  if (status === 'accepted') {
    return (
      <View className="rounded-full bg-emerald-50 px-2.5 py-1">
        <Text className="text-xs font-semibold text-emerald-700">Diterima</Text>
      </View>
    );
  }

  if (status === 'rejected') {
    return (
      <View className="rounded-full bg-red-50 px-2.5 py-1">
        <Text className="text-xs font-semibold text-red-700">Ditolak</Text>
      </View>
    );
  }

  return (
    <View className="rounded-full bg-neutral-100 px-2.5 py-1">
      <Text className="text-xs font-semibold text-neutral-600">Menunggu</Text>
    </View>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  syllabus: Syllabus;
  isAccepting: boolean;
  isRejecting: boolean;
  activeDecisionKey: string | null;
  onAccept: (id: string, sectionKey: string) => void;
  onReject: (id: string, sectionKey: string) => void;
}

function MessageBubble({
  message,
  syllabus,
  isAccepting,
  isRejecting,
  activeDecisionKey,
  onAccept,
  onReject,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const sectionEntries = Object.entries(message.proposed_changes ?? {});

  const getSectionStatus = (sectionKey: string): 'pending' | 'accepted' | 'rejected' => {
    const explicitStatus = message.section_statuses?.[sectionKey];
    if (explicitStatus) {
      return explicitStatus;
    }
    if (message.status === 'accepted' || message.status === 'rejected') {
      return message.status;
    }
    return 'pending';
  };

  if (isUser) {
    return (
      <View className="flex-row justify-end px-4 py-1">
        <View className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-600 px-4 py-3">
          <Text className="text-sm leading-6 text-white">{message.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-start gap-3 px-4 py-1">
      <View className="mt-1 h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50">
        <Ionicons name="sparkles" size={14} color={colors.aiAccent} />
      </View>
      <View className="flex-1 gap-3">
        <View className="rounded-2xl rounded-tl-sm bg-neutral-100 px-4 py-3">
          <AssistantMessageContent content={message.content} />
        </View>

        {sectionEntries.length > 0 ? (
          <View className="gap-3">
            {sectionEntries.map(([sectionKey, proposedValue]) => {
              const sectionStatus = getSectionStatus(sectionKey);
              const decisionKey = `${message.id}:${sectionKey}`;
              const isResolvingAccept = isAccepting && activeDecisionKey === decisionKey;
              const isResolvingReject = isRejecting && activeDecisionKey === decisionKey;

              return (
                <View key={sectionKey} className="gap-2">
                  <SectionDiff
                    currentSyllabus={syllabus}
                    proposedChanges={{ [sectionKey]: proposedValue }}
                  />

                  <View className="flex-row items-center justify-between gap-3 px-1">
                    <SectionStatusBadge status={sectionStatus} />

                    {sectionStatus === 'pending' ? (
                      <View className="flex-row gap-2">
                        <Button
                          title="Tolak"
                          variant="outline"
                          size="sm"
                          onPress={() => onReject(message.id, sectionKey)}
                          isLoading={isResolvingReject}
                          icon={<Ionicons name="close" size={14} color={colors.textSecondary} />}
                        />
                        <Button
                          title="Terima"
                          variant="primary"
                          size="sm"
                          onPress={() => onAccept(message.id, sectionKey)}
                          isLoading={isResolvingAccept}
                          icon={<Ionicons name="checkmark" size={14} color="#fff" />}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <StatusBadge status={message.status} />
        )}

        {sectionEntries.length > 1 ? <StatusBadge status={message.status} /> : null}
      </View>
    </View>
  );
}

export function RevisionChat({ syllabusId, syllabus, onRevisionAccepted }: RevisionChatProps) {
  const {
    messages,
    isLoadingHistory,
    historyError,
    refetchHistory,
    sendMessage,
    isSending,
    sendError,
    acceptRevision,
    isAccepting,
    rejectRevision,
    isRejecting,
  } = useRevisionChat(syllabusId);

  const [inputText, setInputText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeDecisionKey, setActiveDecisionKey] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages.length, isSending]);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    setInputText('');
    setActionError(null);
    try {
      await sendMessage(trimmed);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Pesan belum berhasil dikirim.'));
    }
  }, [inputText, isSending, sendMessage]);

  const handleAccept = useCallback(
    async (messageId: string, sectionKey: string) => {
      setActionError(null);
      setActiveDecisionKey(`${messageId}:${sectionKey}`);
      try {
        await acceptRevision({ messageId, sectionKey });
        onRevisionAccepted?.([sectionKey]);
      } catch (err) {
        setActionError(getErrorMessage(err, 'Revisi belum berhasil diterima.'));
      } finally {
        setActiveDecisionKey(null);
      }
    },
    [acceptRevision, onRevisionAccepted]
  );

  const handleReject = useCallback(
    async (messageId: string, sectionKey: string) => {
      setActionError(null);
      setActiveDecisionKey(`${messageId}:${sectionKey}`);
      try {
        await rejectRevision({ messageId, sectionKey });
      } catch (err) {
        setActionError(getErrorMessage(err, 'Revisi belum berhasil ditolak.'));
      } finally {
        setActiveDecisionKey(null);
      }
    },
    [rejectRevision]
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 min-h-0"
    >
      <View className="flex-1 min-h-0 overflow-hidden rounded-xl border border-neutral-300 bg-surface shadow-sm">
        {/* Header */}
        <View className="flex-row items-center gap-2.5 border-b border-neutral-200 px-4 py-3.5">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
            <Ionicons name="sparkles" size={16} color={colors.aiAccent} />
          </View>
          <Text className="flex-1 text-sm font-semibold text-neutral-950">Asisten Revisi PRIMA</Text>
        </View>

        {/* Error banners */}
        {(historyError || sendError || actionError) ? (
          <View className="px-4 pt-3">
            <AlertBanner
              variant="error"
              title="Terjadi kesalahan"
              description={
                actionError ??
                getErrorMessage(
                  sendError ?? historyError,
                  'Tidak dapat memuat riwayat percakapan.'
                )
              }
              action={
                historyError
                  ? { label: 'Muat ulang', onPress: () => void refetchHistory() }
                  : undefined
              }
            />
          </View>
        ) : null}

        {/* Message list */}
        {isLoadingHistory ? (
          <View className="flex-1 items-center justify-center gap-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-xs text-neutral-500">Memuat percakapan...</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            className="flex-1 min-h-0"
            contentContainerStyle={{ paddingVertical: 12, flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && !isSending ? (
              <View className="items-center justify-center px-6 py-12 gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-brand-50">
                  <Ionicons name="chatbubbles-outline" size={24} color={colors.aiAccent} />
                </View>
                <Text className="text-center text-sm font-semibold text-neutral-700">
                  Mulai revisi dengan percakapan
                </Text>
                <Text className="text-center text-sm leading-6 text-neutral-500">
                  Contoh: "Perbarui tujuan pembelajaran agar lebih spesifik untuk peserta entry-level"
                </Text>
              </View>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    syllabus={syllabus}
                    isAccepting={isAccepting}
                    isRejecting={isRejecting}
                    activeDecisionKey={activeDecisionKey}
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
                {isSending && <TypingIndicator />}
              </>
            )}
          </ScrollView>
        )}

        {/* Input bar */}
        <View className="shrink-0 border-t border-neutral-200 px-3 py-2.5">
          <View className="flex-row items-end gap-2">
            <View className="flex-1 min-h-[44px] rounded-xl border border-neutral-300 bg-neutral-50 px-3.5 py-2.5">
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Minta revisi dalam bahasa alami..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={2000}
                className="text-sm leading-6 text-neutral-950"
                style={{ maxHeight: 120 }}
                onSubmitEditing={() => {
                  if (Platform.OS !== 'web') void handleSend();
                }}
              />
            </View>
            <Pressable
              onPress={() => void handleSend()}
              disabled={!inputText.trim() || isSending}
              className="h-11 w-11 items-center justify-center rounded-xl bg-brand-600 disabled:opacity-40"
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
