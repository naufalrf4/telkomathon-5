export interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: string;
  created_at: string;
}

export interface ELO {
  elo: string;
  pce: string[];
}

export interface LearningJourney {
  pre_learning: string[];
  classroom: string[];
  after_learning: string[];
}

export interface Syllabus {
  id: string;
  topic: string;
  target_level: number;
  tlo: string;
  elos: ELO[];
  journey: LearningJourney;
  status: string;
  created_at: string;
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
  created_at: string;
}
