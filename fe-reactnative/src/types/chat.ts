export interface ChatMessage {
  id: string;
  syllabus_id: string;
  role: 'user' | 'assistant';
  content: string;
  target_sections: string[] | null;
  proposed_changes: Record<string, unknown> | null;
  section_statuses: Record<string, 'pending' | 'accepted' | 'rejected'> | null;
  status: 'pending' | 'partial' | 'accepted' | 'rejected';
  created_at: string;
}

export interface ChatHistory {
  messages: ChatMessage[];
  syllabus_id: string;
}
