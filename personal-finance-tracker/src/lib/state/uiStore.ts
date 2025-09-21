import { create } from 'zustand';

type UIState = {
  theme: 'light' | 'dark';
  currency: string;
  compactTables: boolean;
  toggleTheme: () => void;
  setCurrency: (c: string) => void;
  setCompact: (b: boolean) => void;
  // New: display currency toggle used across UI (USD/EUR only)
  displayCurrency: 'USD' | 'EUR';
  setDisplayCurrency: (c: 'USD' | 'EUR') => void;
};

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'dark',
  currency: 'EUR',
  compactTables: false,
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
  setCurrency: (currency) => set({ currency }),
  setCompact: (compactTables) => set({ compactTables }),
  displayCurrency: 'EUR',
  setDisplayCurrency: (displayCurrency) => set({ displayCurrency })
}));


