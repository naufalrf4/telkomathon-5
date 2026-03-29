export interface Document {
  id: string;
  filename: string;
  doc_type?: string;
  file_type: string;
  status: string;
  created_at: string;
  chunk_count?: number;
}

export interface ELO {
  elo: string;
}

export interface LearningJourneyStage {
  duration: string;
  description: string;
  content: string[];
}

export interface LearningJourney {
  pre_learning: LearningJourneyStage;
  classroom: LearningJourneyStage;
  after_learning: LearningJourneyStage;
}

export interface RevisionHistoryEntry {
  tlo: string;
  performance_result?: string | null;
  condition_result?: string | null;
  standard_result?: string | null;
  elos: ELO[];
  journey: LearningJourney;
  revised_at: string;
  summary: string;
  reason: string;
  source_message_id?: string | null;
  applied_fields: string[];
}

export interface Syllabus {
  id: string;
  topic: string;
  target_level: number;
  course_expertise_level: string;
  tlo: string;
  elos: ELO[];
  journey?: LearningJourney | null;
  course_category?: string | null;
  client_company_name?: string | null;
  course_title?: string | null;
  company_profile_summary?: string | null;
  commercial_overview?: string | null;
  performance_result?: string | null;
  condition_result?: string | null;
  standard_result?: string | null;
  revision_history: RevisionHistoryEntry[];
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface ApplySyllabusRevisionPayload {
  summary?: string;
  tlo?: string;
  performance_result?: string;
  condition_result?: string;
  standard_result?: string;
  elos?: ELO[];
  journey?: LearningJourney;
  reason?: string;
  source_message_id?: string;
}

export interface CompetencyGap {
  skill: string;
  current_level: number;
  required_level: number;
  gap_description: string;
}

export interface LearningRecommendation {
  type: string;
  title: string;
  description: string;
  estimated_duration_minutes: number;
  priority: number;
}

export interface PersonalizationResult {
  id: string;
  syllabus_id: string;
  competency_gaps: CompetencyGap[];
  recommendations: LearningRecommendation[];
  created_at: string;
}

export interface ChatMessage {
  id: string;
  syllabus_id: string;
  role: 'user' | 'assistant';
  content: string;
  revision_applied?: Record<string, unknown> | null;
  created_at: string;
}
