import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import ChatPanel, { ChatMessage } from '@/components/ai/ChatPanel';
import { useUIStore } from '@/lib/state/uiStore';
import type { AiProvider } from '@/lib/state/uiStore';
import { callAi } from '@/ai/client';
import type { AiMessage, AiProviderId } from '@/ai/types';
import { nanoid } from '@/lib/repository/nanoid';
import { useHoldings } from '@/hooks/useHoldings';
import { useResearchReports } from '@/hooks/useResearchReports';
import { useCategories } from '@/hooks/useCategories';

const PROVIDER_ENV_KEYS: Record<AiProviderId, string> = {
  openai: 'VITE_OPENAI_API_KEY',
  anthropic: 'VITE_ANTHROPIC_API_KEY',
  xai: 'VITE_XAI_API_KEY'
};

type PageKey = 'dashboard' | 'holdings' | 'heat-map' | 'categories' | 'settings' | 'research' | 'research-detail' | 'unknown';

const QUICK_PROMPTS: Record<PageKey, string[]> = {
  dashboard: ['Daily brief', 'What changed since last week?'],
  holdings: ['Explain this table', 'Largest positions?'],
  'heat-map': ['Top movers today?'],
  categories: ['Are deposits aligned?'],
  settings: [],
  research: ['Summarize the latest reports', 'What risks were highlighted?'],
  'research-detail': ['What are the key findings?', 'List the sources cited.'],
  unknown: []
};

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function summarizeForContext(markdown: string, maxLength = 200): string {
  const stripped = markdown.replace(/[\#*_`>]/g, '').replace(/\s+/g, ' ').trim();
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength - 3) + '...';
}
function useAiAvailability(provider: AiProvider | null) {
  if (!provider) {
    return { available: false, reason: 'Select an AI provider in Settings to enable the assistant.' };
  }
  const keyName = PROVIDER_ENV_KEYS[provider];
  const env = import.meta.env as Record<string, string | undefined>;
  const key = env[keyName];
  if (!key) {
    return { available: false, reason: `Set ${keyName} in .env.local and reload to enable AI.` };
  }
  return { available: true, reason: null } as const;
}

function getPageKey(pathname: string): PageKey {
  if (pathname.startsWith('/research/')) return 'research-detail';
  if (pathname === '/research' || pathname.startsWith('/research?')) return 'research';
  if (pathname === '/' || pathname.startsWith('/?')) return 'dashboard';
  if (pathname.startsWith('/holdings')) return 'holdings';
  if (pathname.startsWith('/heat-map')) return 'heat-map';
  if (pathname.startsWith('/categories')) return 'categories';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'unknown';
}

function getPageName(key: PageKey): string {
  switch (key) {
    case 'dashboard':
      return 'Dashboard insights';
    case 'holdings':
      return 'Holdings review';
    case 'heat-map':
      return 'Heat map overview';
    case 'categories':
      return 'Category allocation';
    case 'settings':
      return 'Settings & configuration';
    default:
      return 'Portfolio assistant';
  }
}

function useAssistantContext() {
  const location = useLocation();
  const pageKey = getPageKey(location.pathname);
  const pageName = getPageName(pageKey);
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  const { data: holdings = [] } = useHoldings();
  const { data: categories = [] } = useCategories();
  const isResearchPage = pageKey === 'research' || pageKey === 'research-detail';
  const currentResearchId = pageKey === 'research-detail' ? location.pathname.split('/')?.[2] ?? null : null;
  const { data: researchReports = [] } = useResearchReports({ enabled: isResearchPage, limit: 6 });

  const activeHoldings = useMemo(() => holdings.filter((h) => !h.isDeleted), [holdings]);
  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    activeHoldings.forEach((h) => {
      map.set(h.type, (map.get(h.type) ?? 0) + 1);
    });
    const parts = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}: ${count}`);
    return parts.slice(0, 4).join(', ');
  }, [activeHoldings]);

  const contextSummary = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Route: ${pageName}`);
    lines.push(`Display currency: ${displayCurrency}`);
    lines.push(`Active holdings: ${activeHoldings.length}`);
    if (typeBreakdown) lines.push(`Types snapshot: ${typeBreakdown}`);

    if (pageKey === 'dashboard') {
      lines.push('Focus on portfolio trends and allocation summaries.');
    } else if (pageKey === 'holdings') {
      lines.push('Holdings table filters are user-defined and not captured in this context.');
    } else if (pageKey === 'heat-map') {
      lines.push('Heat map colors reflect relative performance; selection state is not tracked yet.');
    } else if (pageKey === 'categories') {
      lines.push(`Categories configured: ${categories.length}`);
    } else if (isResearchPage) {
      lines.push(`Research reports stored: ${researchReports.length}`);
      if (currentResearchId) {
        const focus = researchReports.find((report) => report.id === currentResearchId);
        if (focus) {
          lines.push(`Focused report: ${focus.subjectName} (${formatShortDate(focus.createdAt)})`);
        }
      }
    }

    return lines;
  }, [activeHoldings.length, categories.length, displayCurrency, pageKey, pageName, typeBreakdown, isResearchPage, researchReports, currentResearchId]);

  const researchAttachment = useMemo(() => {
    if (!isResearchPage || researchReports.length === 0) return undefined;
    const ordered = [...researchReports];
    if (currentResearchId) {
      ordered.sort((a, b) => (a.id === currentResearchId ? -1 : b.id === currentResearchId ? 1 : 0));
    }
    const selected = ordered.slice(0, 4);
    const lines: string[] = ['Research library context:'];
    selected.forEach((report) => {
      lines.push(`Report ${report.subjectName} (id: ${report.id}, model: ${report.modelId}, created ${formatShortDate(report.createdAt)})`);
      const sections = [...report.sections]
        .sort((a, b) => a.order - b.order)
        .slice(0, 3);
      sections.forEach((section) => {
        lines.push(`- [${report.subjectName} | Section: ${section.title}] ${summarizeForContext(section.bodyMd)}`);
      });
    });
    lines.push('When referencing these reports, cite them using [Subject | Section: Section Title].');
    return lines.join('\n');
  }, [isResearchPage, researchReports, currentResearchId]);

  const quickPrompts = QUICK_PROMPTS[pageKey] ?? [];

  return { pageKey, pageName, contextSummary, quickPrompts, researchAttachment };
}

function buildSystemPrompt(pageName: string, contextSummary: string[], adviceDisclaimer: boolean, researchAttachment?: string): string {
  const base = [
    'You are the Portfolio Copilot for a local-first personal finance tracker.',
    'Use only the information supplied in the conversation. If you are uncertain, ask follow-up questions.',
    'Do not provide investment advice; focus on educational explanations and portfolio literacy.',
    adviceDisclaimer ? 'Include a brief reminder that outputs are not investment advice when relevant.' : '',
    `Current view: ${pageName}.`
  ].filter(Boolean);

  const contextBlock = contextSummary.length
    ? ['Context:', ...contextSummary.map((line) => `- ${line}`)].join('\n')
    : 'Context: (no additional data captured)';

  return `${base.join('\n')}\n\n${contextBlock}${researchAttachment ? `\n\n${researchAttachment}` : ''}`;
}

export default function AssistantDock() {
  const aiDockOpen = useUIStore((s) => s.aiDockOpen);
  const setAiDockOpen = useUIStore((s) => s.setAiDockOpen);
  const aiProvider = useUIStore((s) => s.aiProvider);
  const adviceDisclaimerEnabled = useUIStore((s) => s.adviceDisclaimerEnabled);
  const { pageName, contextSummary, quickPrompts, researchAttachment } = useAssistantContext();
  const { available, reason } = useAiAvailability(aiProvider);
  const systemPrompt = useMemo(
    () => buildSystemPrompt(pageName, contextSummary, adviceDisclaimerEnabled, researchAttachment),
    [pageName, contextSummary, adviceDisclaimerEnabled, researchAttachment]
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!aiDockOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAiDockOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [aiDockOpen, setAiDockOpen]);

  const setMessagesSync = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      messagesRef.current = next;
      return next;
    });
  }, []);

  const handleSend = useCallback(
    async (rawInput: string) => {
      const input = rawInput.trim();
      if (!input) return;
      if (!available) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: ChatMessage = {
        id: nanoid('ai-user-'),
        role: 'user',
        content: input
      };

      const requestHistory: AiMessage[] = messagesRef.current.map((message) => ({
        role: message.role,
        content: message.content
      }));

      requestHistory.push({ role: 'user', content: input });

      const assistantId = nanoid('ai-assistant-');
      const placeholder: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        toolCalls: [],
        showAppDataBadge: false
      };

      setMessagesSync((prev) => [...prev, userMessage, placeholder]);
      setIsSending(true);

      let streamed = '';
      const result = await callAi({
        feature: 'chat',
        system: systemPrompt,
        messages: requestHistory,
        stream: true,
        onToken: (token) => {
          streamed += token;
          setMessagesSync((prev) =>
            prev.map((msg) => (msg.id === assistantId ? { ...msg, content: streamed, streaming: true } : msg))
          );
        },
        abortSignal: controller.signal
      }).catch((error) => ({
        ok: false as const,
        error: {
          code: 'client_error',
          message: error?.message ?? 'Failed to call AI provider.',
          provider: aiProvider ?? undefined
        }
      }));

      abortRef.current = null;

      if (result.ok) {
        const rawText = streamed || result.text || '';
        const finalText = rawText.trim().length === 0 ? 'The assistant did not return any content.' : rawText;
        const toolCalls = result.toolCalls?.filter(Boolean) ?? [];
        const showAppDataBadge = toolCalls.length > 0 && /\d/.test(finalText);

        setMessagesSync((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: finalText,
                  streaming: false,
                  toolCalls,
                  showAppDataBadge
                }
              : msg
          )
        );
      } else {
        const errorMessage = result.error?.message ?? 'Assistant failed to respond.';
        setMessagesSync((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: errorMessage,
                  streaming: false,
                  error: errorMessage,
                  toolCalls: [],
                  showAppDataBadge: false
                }
              : msg
          )
        );
      }

      setIsSending(false);
    },
    [available, systemPrompt, setMessagesSync, aiProvider]
  );

  const handleClear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessagesSync(() => []);
    setIsSending(false);
  }, [setMessagesSync]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {aiDockOpen && (
        <ChatPanel
          pageName={pageName}
          messages={messages}
          onSend={handleSend}
          onClose={() => setAiDockOpen(false)}
          onClear={handleClear}
          disabled={!available}
          busy={isSending}
          quickPrompts={quickPrompts}
          aiUnavailableReason={reason}
          contextSummary={contextSummary}
          adviceDisclaimerEnabled={adviceDisclaimerEnabled}
        />
      )}
      <button
        type="button"
        onClick={() => setAiDockOpen(!aiDockOpen)}
        className={`relative flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/40 bg-gradient-to-br from-blue-500/80 to-indigo-600/80 text-white shadow-lg shadow-blue-900/40 transition-transform duration-200 hover:scale-105 hover:shadow-xl ${
          aiDockOpen ? 'ring-2 ring-blue-400/80' : ''
        }`}
        aria-expanded={aiDockOpen}
        aria-label="Toggle AI assistant"
      >
        <span className="text-lg font-semibold">AI</span>
        {!available && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-slate-900">
            !
          </span>
        )}
      </button>
    </div>
  );
}












