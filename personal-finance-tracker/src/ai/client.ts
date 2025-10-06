import { getRepository } from '@/lib/repository';
import { useUIStore, AI_PROVIDER_DEFAULTS } from '@/lib/state/uiStore';
import { nanoid } from '@/lib/repository/nanoid';
import type { AiClientRequest, AiClientResult, AiCacheValue, AiProviderId, AiUsage, ProviderRecommendedModels, AiFeature, AiError } from './types';
import { openAiProvider } from './providers/openai';
import { anthropicProvider } from './providers/anthropic';
import { xaiProvider } from './providers/xai';

const providerRegistry = {
  openai: openAiProvider,
  anthropic: anthropicProvider,
  xai: xaiProvider
} as const;

function resolveProvider(id: AiProviderId | null | undefined) {
  if (!id) return undefined;
  return (providerRegistry as Record<string, unknown>)[id] as typeof openAiProvider | undefined;
}

function getModelForFeature(feature: AiFeature, override?: string): string | undefined {
  if (override) return override;
  const state = useUIStore.getState();
  return state.modelByFeature[feature];
}

async function hashKey(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return btoa(input).replace(/[^a-z0-9]/gi, '').slice(0, 64);
}

function estimateCostUSD(model: string, usage?: AiUsage): number {
  if (!usage) return 0;
  const prompt = usage.promptTokens ?? 0;
  const completion = usage.completionTokens ?? 0;
  const table: { match: RegExp; prompt: number; completion: number }[] = [
    { match: /^gpt-5-mini/i, prompt: 0.0025, completion: 0.01 },
    { match: /^gpt-5/i, prompt: 0.01, completion: 0.04 }
  ];
  const fallback = { prompt: 0.002, completion: 0.006 };
  const pricing = table.find((entry) => entry.match.test(model)) ?? fallback;
  const cost = (prompt / 1000) * pricing.prompt + (completion / 1000) * pricing.completion;
  return Number(cost.toFixed(6));
}

function stringifyErrorDetails(details: unknown): string | undefined {
  if (!details) return undefined;
  if (typeof details === 'string') {
    const trimmed = details.trim();
    return trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
  }
  if (typeof details === 'object') {
    try {
      const json = JSON.stringify(details);
      return json.length > 220 ? `${json.slice(0, 220)}...` : json;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function summarizeErrorMessage(error?: AiError): string | undefined {
  if (!error) return undefined;
  const base = error.message;
  const detail = stringifyErrorDetails(error.details);
  if (detail && !base.includes(detail)) {
    return `${base}: ${detail}`;
  }
  return base;
}

function addLog(entry: Partial<AiUsage> & {
  result: AiClientResult;
  cacheKey?: string;
  durationMs?: number;
  costUSD?: number;
}) {
  const state = useUIStore.getState();
  const { result, cacheKey, durationMs, costUSD } = entry;
  const tokens = result.ok ? result.usage ?? undefined : undefined;
  state.pushAiLog({
    id: crypto.randomUUID?.() ?? nanoid('ai-log-'),
    timestamp: new Date().toISOString(),
    provider: result.providerId ?? 'unavailable',
    feature: result.feature,
    model: result.ok ? result.model : undefined,
    cached: result.fromCache ?? false,
    ok: result.ok,
    message: state.loggingEnabled && result.ok ? result.text.slice(0, 160) : undefined,
    error: !result.ok ? summarizeErrorMessage(result.error) : undefined,
    tokens: tokens
      ? {
          prompt: tokens.promptTokens,
          completion: tokens.completionTokens,
          total: tokens.totalTokens
        }
      : undefined,
    costUSD,
    durationMs,
    cacheKey
  });
}

export async function callAi(request: AiClientRequest): Promise<AiClientResult> {
  const state = useUIStore.getState();
  const providerId = state.aiProvider;
  const provider = resolveProvider(providerId ?? undefined);

  if (!providerId || !provider) {
    const result: AiClientResult = {
      ok: false,
      error: {
        code: providerId ? 'provider_not_supported' : 'provider_missing',
        message: providerId
          ? `Provider ${providerId} is not available in this build.`
          : 'Select an AI provider in Settings first.',
        provider: providerId ?? undefined
      },
      providerId: providerId ?? 'openai',
      feature: request.feature
    };
    addLog({ result });
    return result;
  }

  const model = getModelForFeature(request.feature, request.modelOverride);
  if (!model) {
    const result: AiClientResult = {
      ok: false,
      error: {
        code: 'model_missing',
        message: `No model configured for ${request.feature}. Pick one in Settings.`,
        provider: providerId
      },
      providerId,
      feature: request.feature
    };
    addLog({ result });
    return result;
  }

  const budget = state.budgetUSD;
  if (budget > 0 && state.monthlyUsageUSD >= budget) {
    const result: AiClientResult = {
      ok: false,
      error: {
        code: 'budget_exceeded',
        message: 'Monthly AI budget reached. Adjust the limit in Settings to continue.',
        provider: providerId
      },
      providerId,
      feature: request.feature
    };
    addLog({ result });
    return result;
  }

  const repo = getRepository();
  await repo.aiCachePurgeExpired().catch(() => undefined);

  const cacheKey = await hashKey(
    JSON.stringify({
      provider: providerId,
      model,
      feature: request.feature,
      system: request.system ?? null,
      messages: request.messages
    })
  );

  const cacheTtlSec = request.cacheTtlSec ?? (request.stream ? 0 : 60 * 10);

  if (!request.forceRefresh && cacheTtlSec > 0) {
    const cached = await repo.aiCacheGet(cacheKey);
    if (cached?.value) {
      const snapshot = cached.value as AiCacheValue;
      const cachedResult: AiClientResult = {
        ...(snapshot.response as any),
        providerId: snapshot.provider,
        feature: snapshot.feature,
        fromCache: true,
        cacheKey
      };
      if (cachedResult.ok && typeof cachedResult.text === 'string' && request.onToken) {
        request.onToken(cachedResult.text);
      }
      addLog({ result: cachedResult, cacheKey, costUSD: 0, durationMs: 0 });
      return cachedResult;
    }
  }

  const start = performance.now();
  const providerResult = await provider.respond({
    model,
    system: request.system,
    messages: request.messages,
    stream: request.stream,
    onToken: request.onToken,
    signal: request.abortSignal,
    useProxy: state.useProxy,
    webSearch: state.webSearchEnabled,
    feature: request.feature
  });
  const durationMs = performance.now() - start;

  const clientResult: AiClientResult = {
    ...providerResult,
    providerId,
    feature: request.feature,
    cacheKey
  } as AiClientResult;

  if (providerResult.ok) {
    const usage = providerResult.usage;
    const estimatedCost = estimateCostUSD(model, usage);
    if (estimatedCost > 0) {
      state.incrementAiUsageUSD(estimatedCost);
    }

    if (cacheTtlSec > 0) {
      const cacheValue: AiCacheValue = {
        response: { ...providerResult, cachedAt: new Date().toISOString() },
        feature: request.feature,
        model,
        provider: providerId
      };
      await repo.aiCacheSet({ key: cacheKey, value: cacheValue, ttlSec: cacheTtlSec }).catch(() => undefined);
    }

    clientResult.fromCache = false;
    addLog({ result: clientResult, cacheKey, durationMs, costUSD: estimatedCost });
  } else {
    console.error('[ai] provider call failed', {
      provider: providerId,
      feature: request.feature,
      model,
      cacheKey,
      error: providerResult.error,
      messages: request.messages.length,
      hasSystem: Boolean(request.system)
    });
    addLog({ result: clientResult, cacheKey, durationMs, costUSD: 0 });
  }

  return clientResult;
}

export async function getRecommendedModels(provider: AiProviderId | null): Promise<ProviderRecommendedModels[]> {
  const resolved = resolveProvider(provider ?? undefined);
  if (!provider || !resolved) {
    const defaults = provider ? AI_PROVIDER_DEFAULTS[provider] : AI_PROVIDER_DEFAULTS.openai;
    return Object.entries(defaults).map(([feature, model]) => (
      {
        feature: feature as AiFeature,
        defaults: [model],
        all: [model]
      }
    ));
  }
  return resolved.listRecommendedModels();
}
