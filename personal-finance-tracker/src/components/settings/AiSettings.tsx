import { useMemo } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Label from "@/components/ui/Label";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useUIStore, AI_PROVIDER_DEFAULTS, AiProvider } from "@/lib/state/uiStore";
import type { AiFeature, AiCallLogEntry } from "@/ai/types";

const PROVIDER_OPTIONS: { value: AiProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "xai", label: "xAI" }
];

const FEATURE_COPY: Record<AiFeature, string> = {
  chat: "Chat & Portfolio Q&A",
  insights: "News & Insights Summaries",
  research: "Deep Research"
};

const RECOMMENDED_MODELS: Record<AiProvider, string[]> = {
  openai: ["gpt-5-mini", "gpt-5"],
  anthropic: ["claude-3.5-sonnet", "claude-3-opus-4.1", "claude-3.5-haiku"],
  xai: ["grok-4", "grok-4-fast", "grok-3", "grok-3-mini"]
};

const ENV_KEY_BY_PROVIDER: Record<AiProvider, string> = {
  openai: "VITE_OPENAI_API_KEY",
  anthropic: "VITE_ANTHROPIC_API_KEY",
  xai: "VITE_XAI_API_KEY"
};

function formatTimestamp(ts: string) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatTokens(entry?: AiCallLogEntry["tokens"]) {
  if (!entry) return "-";
  const total = entry.total ?? entry.prompt ?? entry.completion;
  if (!total) return "-";
  return `${total}${entry.prompt || entry.completion ? ` (p:${entry.prompt ?? 0} / c:${entry.completion ?? 0})` : ""}`;
}

function formatCost(cost?: number) {
  if (cost == null || Number.isNaN(cost)) return "-";
  return `$${cost.toFixed(4)}`;
}

export default function AiSettings() {
  const aiProvider = useUIStore((s) => s.aiProvider);
  const modelByFeature = useUIStore((s) => s.modelByFeature);
  const setAiProvider = useUIStore((s) => s.setAiProvider);
  const setModelForFeature = useUIStore((s) => s.setModelForFeature);
  const webSearchEnabled = useUIStore((s) => s.webSearchEnabled);
  const setWebSearchEnabled = useUIStore((s) => s.setWebSearchEnabled);
  const useProxy = useUIStore((s) => s.useProxy);
  const setUseProxy = useUIStore((s) => s.setUseProxy);
  const budgetUSD = useUIStore((s) => s.budgetUSD);
  const setBudgetUSD = useUIStore((s) => s.setBudgetUSD);
  const loggingEnabled = useUIStore((s) => s.loggingEnabled);
  const setLoggingEnabled = useUIStore((s) => s.setLoggingEnabled);
  const adviceDisclaimerEnabled = useUIStore((s) => s.adviceDisclaimerEnabled);
  const setAdviceDisclaimerEnabled = useUIStore((s) => s.setAdviceDisclaimerEnabled);
  const aiCallLog = useUIStore((s) => s.aiCallLog);
  const clearAiLog = useUIStore((s) => s.clearAiLog);
  const monthlyUsageUSD = useUIStore((s) => s.monthlyUsageUSD);
  const insightsAlphaVantageEnabled = useUIStore((s) => s.insightsAlphaVantageEnabled);
  const setInsightsAlphaVantageEnabled = useUIStore((s) => s.setInsightsAlphaVantageEnabled);
  const insightsFinnhubEnabled = useUIStore((s) => s.insightsFinnhubEnabled);
  const setInsightsFinnhubEnabled = useUIStore((s) => s.setInsightsFinnhubEnabled);
  const insightsLookbackHours = useUIStore((s) => s.insightsLookbackHours);
  const setInsightsLookbackHours = useUIStore((s) => s.setInsightsLookbackHours);

  const providerKeyName = aiProvider ? ENV_KEY_BY_PROVIDER[aiProvider] : null;
  const providerKeyValue = providerKeyName ? (import.meta.env as Record<string, string | undefined>)[providerKeyName] : undefined;
  const aiUnavailable = !aiProvider || !providerKeyValue;
  const budgetExceeded = budgetUSD > 0 && monthlyUsageUSD >= budgetUSD;

  const availableModels = useMemo(() => {
    if (!aiProvider) return [];
    return RECOMMENDED_MODELS[aiProvider];
  }, [aiProvider]);

  const handleBudgetChange = (value: string) => {
    const parsed = Number(value);
    setBudgetUSD(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
  };
  const handleLookbackChange = (value: string) => {
    const parsed = Number(value);
    const sanitized = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : insightsLookbackHours;
    setInsightsLookbackHours(Math.max(6, sanitized));
  };

  return (
    <Card className="md:col-span-2 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">AI</h2>
        <p className="mt-1 text-sm text-slate-400">
          Configure provider, models, and privacy controls. Add API keys in <code className="font-mono">.env.local</code>
          : <span className="font-mono">VITE_OPENAI_API_KEY</span>, <span className="font-mono">VITE_ANTHROPIC_API_KEY</span>,
          <span className="font-mono">VITE_XAI_API_KEY</span>.
        </p>
      </div>

      {aiUnavailable && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          AI unavailable. Select a provider and add the matching API key to <code>.env.local</code> to enable these features.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-provider">Provider</Label>
          <Select
            id="ai-provider"
            value={aiProvider ?? ""}
            onChange={(event) => {
              const value = event.target.value as AiProvider | "";
              setAiProvider(value ? value : null);
            }}
          >
            <option value="">Choose a provider</option>
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-budget">Monthly budget (USD)</Label>
          <Input
            id="ai-budget"
            type="number"
            min="0"
            step="0.01"
            value={budgetUSD}
            onChange={(event) => handleBudgetChange(event.target.value)}
          />
          <p className={`text-xs ${budgetExceeded ? 'text-red-400' : 'text-slate-500'}`}>
            Spent this month: ${monthlyUsageUSD.toFixed(2)}
            {budgetUSD > 0 && ` / $${budgetUSD.toFixed(2)}`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(FEATURE_COPY) as AiFeature[]).map((feature) => {
          const current = aiProvider ? modelByFeature[feature] ?? "" : "";
          const options = aiProvider ? availableModels : [];
          const list = aiProvider && current && !options.includes(current) ? [...options, current] : options;

          return (
            <div key={feature} className="space-y-2">
              <Label htmlFor={`ai-model-${feature}`}>{FEATURE_COPY[feature]}</Label>
              <Select
                id={`ai-model-${feature}`}
                value={current}
                onChange={(event) => setModelForFeature(feature, event.target.value)}
                disabled={!aiProvider}
              >
                {!aiProvider && <option value="">Select a provider first</option>}
                {aiProvider &&
                  list.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
              </Select>
              {aiProvider && (
                <p className="text-xs text-slate-500">Default: {AI_PROVIDER_DEFAULTS[aiProvider][feature]}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ToggleRow
          id="ai-web-search"
          label="Enable web search / browsing"
          checked={webSearchEnabled}
          onChange={setWebSearchEnabled}
          description="Allow supported models to enrich answers with live information."
        />
        <ToggleRow
          id="ai-proxy"
          label="Use local proxy"
          checked={useProxy}
          onChange={setUseProxy}
          description="Route calls through /ai-proxy. Enable if provider blocks direct browser requests."
        />
        <ToggleRow
          id="ai-advice-badge"
          label={'Show "Not investment advice" badge'}
          checked={adviceDisclaimerEnabled}
          onChange={setAdviceDisclaimerEnabled}
          description="Prefix AI outputs with a disclaimer badge."
        />
        <ToggleRow
          id="ai-logging"
          label="Prompt & response logging"
          checked={loggingEnabled}
          onChange={setLoggingEnabled}
          description="Store recent AI prompts locally for troubleshooting."
        />
      </div>


      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">News providers</h3>
          <p className="text-xs text-slate-500">Choose which data sources feed the Insights pipeline.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ToggleRow
            id="insights-alpha"
            label="Alpha Vantage"
            checked={insightsAlphaVantageEnabled}
            onChange={setInsightsAlphaVantageEnabled}
            description="Requires VITE_ALPHAVANTAGE_KEY. Provides equity and macro headlines."
          />
          <ToggleRow
            id="insights-finnhub"
            label="Finnhub"
            checked={insightsFinnhubEnabled}
            onChange={setInsightsFinnhubEnabled}
            description="Requires VITE_FINNHUB_KEY. Provides company-specific news."
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="insights-lookback">Lookback window (hours)</Label>
            <Input
              id="insights-lookback"
              type="number"
              min="6"
              step="6"
              value={insightsLookbackHours}
              onChange={(event) => handleLookbackChange(event.target.value)}
            />
            <p className="text-xs text-slate-500">Default 48 hours. Increase for quieter portfolios.</p>
          </div>
          <div className="space-y-1 text-xs text-slate-500 md:mt-6">
            <p>API keys:</p>
            <p><span className="font-mono">VITE_ALPHAVANTAGE_KEY</span>, <span className="font-mono">VITE_FINNHUB_KEY</span></p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">AI Call Log</h3>
            <p className="text-xs text-slate-500">Most recent {Math.min(aiCallLog.length, 20)} calls (metadata only when logging is off).</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearAiLog} disabled={aiCallLog.length === 0}>
            Clear log
          </Button>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-700/40 bg-slate-900/40">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-800/40 text-left uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Feature</th>
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Cache</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40 text-slate-300">
              {aiCallLog.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-500" colSpan={8}>
                    No calls yet. Chat with the assistant once AI is enabled.
                  </td>
                </tr>
              )}
              {aiCallLog
                .slice()
                .reverse()
                .map((entry) => (
                  <tr key={entry.id} className={entry.ok ? '' : 'text-red-300'}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatTimestamp(entry.timestamp)}</td>
                    <td className="px-3 py-2">{entry.provider}</td>
                    <td className="px-3 py-2">{entry.model ?? '-'}</td>
                    <td className="px-3 py-2 capitalize">{entry.feature}</td>
                    <td className="px-3 py-2">{formatTokens(entry.tokens)}</td>
                    <td className="px-3 py-2">{formatCost(entry.costUSD)}</td>
                    <td className="px-3 py-2">{entry.cached ? 'hit' : 'miss'}</td>
                    <td className="px-3 py-2">{entry.ok ? 'ok' : entry.error ?? 'error'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-4 py-3 text-xs text-slate-400">
        <p className="font-semibold text-slate-200">API keys</p>
        <p className="mt-1">
          Add keys to <code>.env.local</code> and restart the dev server if needed. None of your data leaves the browser
          unless you explicitly enable a provider.
        </p>
      </div>
    </Card>
  );
}

type ToggleRowProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: string;
};

function ToggleRow({ id, label, checked, onChange, description }: ToggleRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-700/40 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label htmlFor={id} className="font-medium text-slate-100">
            {label}
          </label>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
        <button
          type="button"
          aria-pressed={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-12 overflow-hidden rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${checked ? "border-blue-400/60 bg-blue-500/80" : "border-slate-600/60 bg-slate-700/70"}`}
        >
          <span className="sr-only">{label}</span>
          <span
            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-200"
            style={{ left: checked ? "calc(100% - 24px)" : "2px" }}
          />
        </button>
      </div>
    </div>
  );
}
