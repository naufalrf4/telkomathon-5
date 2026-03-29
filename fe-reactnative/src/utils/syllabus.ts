import type { LearningJourney, Syllabus } from '../types/api';

export function isFinalizedSyllabus(status: string | null | undefined): boolean {
  return status === 'finalized';
}

export function getSyllabusStatusVariant(status: string | null | undefined): 'success' | 'warning' {
  return isFinalizedSyllabus(status) ? 'success' : 'warning';
}

export function getSyllabusStatusLabel(status: string | null | undefined): string {
  if (status === 'finalized') {
    return 'Finalized';
  }

  if (status === 'draft') {
    return 'Draft';
  }

  return status ?? 'Unknown';
}

export function emptyLearningJourney(): LearningJourney {
  return {
    pre_learning: { duration: '', description: '', content: [] },
    classroom: { duration: '', description: '', content: [] },
    after_learning: { duration: '', description: '', content: [] },
  };
}

export function syllabusTitle(syllabus: Syllabus): string {
  return syllabus.course_title?.trim() || syllabus.topic;
}
