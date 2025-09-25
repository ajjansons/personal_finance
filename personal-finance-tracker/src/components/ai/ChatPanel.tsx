import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/ui/Button';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  error?: string;
  toolCalls?: string[];
  showAppDataBadge?: boolean;
};

type ChatPanelProps = {
  pageName: string;
  messages: ChatMessage[];
  onSend: (message: string) => void;
  onClose: () => void;
  onClear: () => void;
  disabled: boolean;
  busy: boolean;
  quickPrompts: string[];
  aiUnavailableReason?: string | null;
  contextSummary?: string[];
  adviceDisclaimerEnabled?: boolean;
};

export default function ChatPanel({
  pageName,
  messages,
  onSend,
  onClose,
  onClear,
  disabled,
  busy,
  quickPrompts,
  aiUnavailableReason,
  contextSummary,
  adviceDisclaimerEnabled
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const derivedDisabled = disabled || busy;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (derivedDisabled) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput('');
  };

  const handleQuickPrompt = (prompt: string) => {
    if (derivedDisabled) return;
    onSend(prompt);
  };

  const contextList = useMemo(() => {
    if (!contextSummary || contextSummary.length === 0) return null;
    return (
      <ul className="space-y-0.5 text-xs text-slate-400">
        {contextSummary.map((line, index) => (
          <li key={`${index}-${line.slice(0, 12)}`}>• {line}</li>
        ))}
      </ul>
    );
  }, [contextSummary]);

  return (
    <div className="flex h-[640px] w-[460px] flex-col rounded-[32px] border border-slate-700/60 bg-slate-900/95 p-5 shadow-2xl shadow-blue-950/40 backdrop-blur-md">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-blue-300/80">Portfolio Assistant</p>
          <h3 className="text-lg font-semibold text-slate-100">{pageName}</h3>
          {adviceDisclaimerEnabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300">
              ⚖️ Not investment advice
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onClear} disabled={messages.length === 0}>
            Reset
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </header>

      {contextList && <div className="mb-4 rounded-3xl bg-slate-800/60 p-4">{contextList}</div>}

      {quickPrompts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200 transition hover:border-blue-400/60 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => handleQuickPrompt(prompt)}
              disabled={derivedDisabled}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-3xl border border-slate-800/60 bg-slate-900/40 p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Ask about your portfolio, e.g., “What changed this week?” or “Why is BTC red today?”.
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`mb-3 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] space-y-1.5">
              <div
                className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white shadow-blue-900/40'
                    : 'bg-slate-800/80 text-slate-100 shadow-black/10'
                }`}
              >
                <span>{message.content || (message.streaming ? '…' : '')}</span>
                {message.streaming && <span className="ml-1 inline-block animate-pulse text-base leading-none">▍</span>}
                {message.error && <p className="mt-1 text-xs text-rose-300">{message.error}</p>}
              </div>
              {message.role === 'assistant' && message.showAppDataBadge && (
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-blue-200/70">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-[2px] font-semibold text-blue-200">
                    Source: app data
                  </span>
                  {message.toolCalls?.length ? (
                    <span className="text-[10px] font-medium text-slate-500">{message.toolCalls.join(', ')}</span>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        {aiUnavailableReason && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {aiUnavailableReason}
          </div>
        )}
        <textarea
          className="h-28 w-full resize-none rounded-2xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={derivedDisabled ? 'AI assistant is unavailable' : 'Type a message and press Enter…'}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!derivedDisabled) {
                const trimmed = input.trim();
                if (trimmed) {
                  onSend(trimmed);
                  setInput('');
                }
              }
            }
          }}
          disabled={derivedDisabled}
        />
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{busy ? 'Thinking…' : 'Press Enter to send, Shift+Enter for a new line.'}</span>
          <Button type="submit" size="sm" disabled={derivedDisabled || input.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}


