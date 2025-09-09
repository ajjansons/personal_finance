import { create } from 'zustand';

type UIState = {
  theme: 'light' | 'dark';
  currency: string;
  compactTables: boolean;
  toggleTheme: () => void;
  setCurrency: (c: string) => void;
  setCompact: (b: boolean) => void;
};

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'light',
  currency: 'EUR',
  compactTables: false,
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
  setCurrency: (currency) => set({ currency }),
  setCompact: (compactTables) => set({ compactTables })
}));

