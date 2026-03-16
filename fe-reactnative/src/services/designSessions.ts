import { apiGet, apiPatch, apiPost, getBaseURL } from './api';
import type {
  CourseContextPayload,
  DesignSession,
  ELOOption,
  FinalizeDesignSessionResult,
} from '../types/designSession';

export const designSessionsService = {
  list(): Promise<{ sessions: DesignSession[]; total: number }> {
    return apiGet<{ sessions: DesignSession[]; total: number }>('/design-sessions/');
  },

  create(documentIds: string[]): Promise<DesignSession> {
    return apiPost<DesignSession>('/design-sessions/', {
      document_ids: documentIds,
    });
  },

  get(sessionId: string): Promise<DesignSession> {
    return apiGet<DesignSession>(`/design-sessions/${sessionId}`);
  },

  startAssist(sessionId: string): Promise<DesignSession> {
    return apiPost<DesignSession>(`/design-sessions/${sessionId}/start-assist`, {});
  },

  updateCourseContext(sessionId: string, payload: CourseContextPayload): Promise<DesignSession> {
    return apiPatch<DesignSession>(`/design-sessions/${sessionId}/course-context`, payload);
  },

  generateTloOptions(sessionId: string): Promise<DesignSession> {
    return apiPost<DesignSession>(`/design-sessions/${sessionId}/tlo-options`, {});
  },

  selectTlo(sessionId: string, optionId: string): Promise<DesignSession> {
    return apiPatch<DesignSession>(`/design-sessions/${sessionId}/tlo-selection`, {
      option_id: optionId,
    });
  },

  generatePerformanceOptions(sessionId: string): Promise<DesignSession> {
    return apiPost<DesignSession>(`/design-sessions/${sessionId}/performance-options`, {});
  },

  selectPerformance(sessionId: string, optionId: string): Promise<DesignSession> {
    return apiPatch<DesignSession>(`/design-sessions/${sessionId}/performance-selection`, {
      option_id: optionId,
    });
  },

  generateEloOptions(sessionId: string): Promise<DesignSession> {
    return apiPost<DesignSession>(`/design-sessions/${sessionId}/elo-options`, {});
  },

  selectElos(sessionId: string, options: ELOOption[]): Promise<DesignSession> {
    return apiPatch<DesignSession>(`/design-sessions/${sessionId}/elo-selection`, {
      option_ids: options.map((option) => option.id),
    });
  },

  finalize(sessionId: string): Promise<FinalizeDesignSessionResult> {
    return apiPost<FinalizeDesignSessionResult>(`/design-sessions/${sessionId}/finalize`, {});
  },

  getSyllabusDocxDownloadUrl(syllabusId: string): string {
    return `${getBaseURL()}/syllabi/${syllabusId}/download.docx`;
  },
};
