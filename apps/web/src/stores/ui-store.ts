import { create } from 'zustand';

interface UIState {
  selectedAgentId: string | null;
  selectAgent: (id: string | null) => void;

  view: 'dashboard' | '3d' | 'split';
  setView: (view: UIState['view']) => void;

  inspectorOpen: boolean;
  toggleInspector: () => void;

  timelineOpen: boolean;
  toggleTimeline: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedAgentId: null,
  selectAgent: (selectedAgentId) => set({ selectedAgentId }),

  view: '3d',
  setView: (view) => set({ view }),

  inspectorOpen: false,
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),

  timelineOpen: true,
  toggleTimeline: () => set((s) => ({ timelineOpen: !s.timelineOpen })),
}));
