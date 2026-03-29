import type { Syllabus } from './api';

export type DesignSessionWizardStep =
  | 'uploaded'
  | 'summary_ready'
  | 'course_context_set'
  | 'tlo_options_ready'
  | 'tlo_selected'
  | 'performance_options_ready'
  | 'performance_selected'
  | 'elo_options_ready'
  | 'elo_selected'
  | 'finalized';

export interface SourceSummary {
  summary: string;
  key_points: string[];
  company_profile_focus: string[];
}

export interface CourseContextPayload {
  topic: string;
  target_level: number;
  additional_context: string;
  course_category?: string;
  client_company_name?: string;
  course_title?: string;
  commercial_overview?: string;
}

export interface DesignOption {
  id: string;
  text: string;
  rationale: string;
}

export interface ELOOption {
  id: string;
  elo: string;
  rationale: string;
}

export interface DesignSession {
  id: string;
  document_ids: string[];
  wizard_step: DesignSessionWizardStep;
  source_summary: SourceSummary | null;
  course_context: CourseContextPayload | null;
  tlo_options: DesignOption[];
  selected_tlo: DesignOption | null;
  performance_options: DesignOption[];
  selected_performance: DesignOption | null;
  preview_condition_result?: string | null;
  preview_standard_result?: string | null;
  elo_options: ELOOption[];
  selected_elos: ELOOption[];
  finalized_syllabus_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinalizeDesignSessionResult {
  session: DesignSession;
  syllabus: Syllabus;
}
