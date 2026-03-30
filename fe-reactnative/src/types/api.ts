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
  method: string[];
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
  bulk_session_id?: string | null;
  participant_name: string;
  revision_index: number;
  competency_gaps: CompetencyGap[];
  recommendations: LearningRecommendation[];
  created_at: string;
}

export interface BulkParticipantInput {
  participant_name: string;
  competency_gaps: CompetencyGap[];
}

export interface BulkPersonalizationResponse {
  syllabus_id: string;
  bulk_session_id: string;
  total_participants: number;
  results: PersonalizationResult[];
}

export interface CareerRoadmapMilestone {
  phase_title: string;
  timeframe: string;
  objective: string;
  focus_modules: string[];
  activities: string[];
  success_indicator: string;
}

export interface CareerRoadmapResult {
  id: string;
  syllabus_id: string;
  participant_name: string;
  current_role: string;
  target_role: string;
  time_horizon_weeks: number;
  revision_index: number;
  competency_gaps: CompetencyGap[];
  milestones: CareerRoadmapMilestone[];
  created_at: string;
}

export interface CareerRoadmapRequestPayload {
  participant_name: string;
  current_role: string;
  target_role: string;
  time_horizon_weeks: number;
  competency_gaps: CompetencyGap[];
}

export interface RevisionSnapshot {
  revision_index: number;
  tlo: string;
  performance_result: string;
  condition_result: string;
  standard_result: string;
  elos: string[];
  journey_summary: Record<string, string[]>;
}

export interface RevisionDownstreamSummary {
  personalization_count: number;
  participant_names: string[];
  export_count: number;
  module_generation_count: number;
  latest_personalized_at?: string | null;
  latest_exported_at?: string | null;
  latest_decomposed_at?: string | null;
}

export interface RevisionNote {
  revision_index: number;
  is_current: boolean;
  source_kind: string;
  summary: string;
  reason: string;
  source_message_id?: string | null;
  source_message_excerpt?: string | null;
  applied_fields: string[];
  created_at: string;
  previous_snapshot?: RevisionSnapshot | null;
  current_snapshot: RevisionSnapshot;
  downstream: RevisionDownstreamSummary;
}

export interface ModuleActivity {
  type: string;
  description: string;
  duration_minutes: number;
}

export interface ModuleAssessment {
  method: string;
  criteria: string[];
}

export interface ModuleDecomposition {
  id: string;
  syllabus_id: string;
  module_index: number;
  title: string;
  description: string;
  learning_objectives: string[];
  topics: string[];
  duration_minutes: number;
  activities: ModuleActivity[];
  assessment: ModuleAssessment;
  created_at: string;
}

export interface OwnerHistoryEvent {
  id: string;
  syllabus_id: string;
  owner_id: string;
  action: string;
  summary: string;
  detail: Record<string, unknown>;
  revision_index?: number | null;
  created_at: string;
}

export interface OwnerHistoryAggregation {
  owner_id: string;
  syllabus_id?: string | null;
  action_counts: Record<string, number>;
  first_event?: string | null;
  last_event?: string | null;
  total_events: number;
}

export interface ChatMessage {
  id: string;
  syllabus_id: string;
  role: 'user' | 'assistant';
  content: string;
  revision_applied?: Record<string, unknown> | null;
  created_at: string;
}
