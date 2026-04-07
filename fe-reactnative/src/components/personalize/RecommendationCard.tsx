import { View, Text } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { LearningRecommendation } from '../../types/api';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface RecommendationCardProps {
  recommendation: LearningRecommendation;
  /** Pre-resolved priority label from parent group — skips re-computation */
  priorityLabel?: 'High' | 'Medium' | 'Low';
}

const PRIORITY_ACCENT: Record<string, { border: string; bg: string; dot: string }> = {
  High:   { border: '#DC2626', bg: '#FEF2F2', dot: colors.error },
  Medium: { border: '#D97706', bg: '#FFFBEB', dot: colors.warning },
  Low:    { border: '#2563EB', bg: '#EFF6FF', dot: colors.info },
};

export function RecommendationCard({ recommendation, priorityLabel: priorityProp }: RecommendationCardProps) {
  const resolvePriority = (priority: number | string): 'High' | 'Medium' | 'Low' => {
    if (priority === 1 || priority === 'High') return 'High';
    if (priority === 2 || priority === 'Medium') return 'Medium';
    return 'Low';
  };

  const priorityLabel = priorityProp ?? resolvePriority(recommendation.priority);
  const accent = PRIORITY_ACCENT[priorityLabel] ?? PRIORITY_ACCENT.Low;

  return (
    <View
      className="mb-4 rounded-xl bg-surface overflow-hidden"
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {/* Colored top accent strip */}
      <View style={{ height: 3, backgroundColor: accent.border }} />

      <View className="p-4">
        {/* Row: type badge + duration pill */}
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Badge
            label={recommendation.type}
            variant="default"
            className="bg-neutral-100 border-neutral-200"
          />
          <View
            className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
            style={{ backgroundColor: accent.bg, borderWidth: 1, borderColor: accent.border + '40' }}
          >
            <Ionicons name="time-outline" size={11} color={accent.dot} />
            <Text className="text-xs font-semibold" style={{ color: accent.dot }}>
              {recommendation.estimated_duration_minutes} mnt
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text className="mb-2 text-base font-bold leading-snug text-neutral-950">
          {recommendation.title}
        </Text>

        {/* Description */}
        <Text className="text-sm leading-6 text-neutral-600">
          {recommendation.description}
        </Text>
      </View>
    </View>
  );
}
