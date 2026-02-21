import { create } from 'zustand';

interface AppState {
  selectedSyllabusId: string | null;
  setSelectedSyllabusId: (id: string | null) => void;
  selectedDocumentIds: string[];
  toggleDocumentId: (id: string) => void;
  clearDocumentSelection: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedSyllabusId: null,
  setSelectedSyllabusId: (id) => set({ selectedSyllabusId: id }),
  selectedDocumentIds: [],
  toggleDocumentId: (id) => set((state) => {
    const exists = state.selectedDocumentIds.includes(id);
    return {
      selectedDocumentIds: exists
        ? state.selectedDocumentIds.filter((d) => d !== id)
        : [...state.selectedDocumentIds, id],
    };
  }),
  clearDocumentSelection: () => set({ selectedDocumentIds: [] }),
}));
