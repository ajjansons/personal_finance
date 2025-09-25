import { create } from 'zustand';
import type { AiProviderId, AiFeature, AiCallLogEntry } from '@/ai/types';

export type AiProvider = AiProviderId;
export type ModelByFeature = Record<AiFeature, string>;

type UIState = {
  theme: 'light' | 'dark';
  currency: string;
  compactTables: boolean;
  toggleTheme: () => void;
  setCurrency: (c: string) => void;
  setCompact: (b: boolean) => void;
  displayCurrency: 'USD' | 'EUR';
  setDisplayCurrency: (c: 'USD' | 'EUR') => void;
  aiProvider: AiProvider | null;
  modelByFeature: ModelByFeature;
  setAiProvider: (provider: AiProvider | null) => void;
  setModelForFeature: (feature: AiFeature, model: string) => void;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  useProxy: boolean;
  setUseProxy: (enabled: boolean) => void;
  budgetUSD: number;
  setBudgetUSD: (budget: number) => void;
  loggingEnabled: boolean;
  setLoggingEnabled: (enabled: boolean) => void;
  adviceDisclaimerEnabled: boolean;
  setAdviceDisclaimerEnabled: (enabled: boolean) => void;
  aiDockOpen: boolean;
  setAiDockOpen: (open: boolean) => void;
  aiCallLog: AiCallLogEntry[];
  pushAiLog: (entry: AiCallLogEntry) => void;
  clearAiLog: () => void;
  monthlyUsageUSD: number;
  incrementAiUsageUSD: (delta: number) => void;
  resetAiUsageUSD: () => void;
};

const AI_DEFAULTS: Record<AiProvider, ModelByFeature> = {
  openai: {
    chat: 'gpt-5-mini',
    insights: 'gpt-5-mini',
    research: 'gpt-5'
  },
  anthropic: {
    chat: 'claude-3.5-sonnet',
    insights: 'claude-3.5-sonnet',
    research: 'claude-3-opus-4.1'
  },
  xai: {
    chat: 'grok-4',
    insights: 'grok-4-fast',
    research: 'grok-4'
  }
};

export const AI_PROVIDER_DEFAULTS = AI_DEFAULTS;

const MAX_LOG_ENTRIES = 20;

export const useUIStore = create<UIState>((set, get) => ({
  theme: 'dark',
  currency: 'EUR',
  compactTables: false,
  toggleTheme: () => set({ theme: get().theme === 'light' ? 'dark' : 'light' }),
  setCurrency: (currency) => set({ currency }),
  setCompact: (compactTables) => set({ compactTables }),
  displayCurrency: 'EUR',
  setDisplayCurrency: (displayCurrency) => set({ displayCurrency }),
  aiProvider: 'openai',
  modelByFeature: { ...AI_DEFAULTS.openai },
  setAiProvider: (provider) => {
    if (!provider) {
      set({ aiProvider: null });
      return;
    }
    set({ aiProvider: provider, modelByFeature: { ...AI_DEFAULTS[provider] } });
  },
  setModelForFeature: (feature, model) =>
    set((state) => ({ modelByFeature: { ...state.modelByFeature, [feature]: model } })),
  webSearchEnabled: false,
  setWebSearchEnabled: (webSearchEnabled) => set({ webSearchEnabled }),
  useProxy: false,
  setUseProxy: (useProxy) => set({ useProxy }),
  budgetUSD: 50,
  setBudgetUSD: (budgetUSD) => set({ budgetUSD }),
  loggingEnabled: false,
  setLoggingEnabled: (loggingEnabled) => set({ loggingEnabled }),
  adviceDisclaimerEnabled: true,
  setAdviceDisclaimerEnabled: (adviceDisclaimerEnabled) => set({ adviceDisclaimerEnabled }),
  aiDockOpen: false,
  setAiDockOpen: (aiDockOpen) => set({ aiDockOpen }),
  aiCallLog: [],
  pushAiLog: (entry) =>
    set((state) => {
      const next = [...state.aiCallLog, entry];
      return { aiCallLog: next.slice(-MAX_LOG_ENTRIES) };
    }),
  clearAiLog: () => set({ aiCallLog: [] }),
  monthlyUsageUSD: 0,
  incrementAiUsageUSD: (delta) =>
    set((state) => ({ monthlyUsageUSD: Math.max(0, state.monthlyUsageUSD + (delta || 0)) })),
  resetAiUsageUSD: () => set({ monthlyUsageUSD: 0 })
}));
