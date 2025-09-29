import { z } from 'zod';
import { callAi } from '@/ai/client';
import { computeHoldingValuation } from '@/lib/calculations';
import { nanoid } from '@/lib/repository/nanoid';
import { getRepository } from '@/lib/repository';
import type { Holding, InsightAction, InsightItem, InsightRecord } from '@/lib/repository/types';
import { useUIStore } from '@/lib/state/uiStore';
import { fetchAlphaVantageNews } from './providers/alphaVantage';
import { fetchFinnhubNews } from './providers/finnhub';
import { HoldingNewsContext, NormalizedProviderInsight } from './types';

const allowedActions: InsightAction['action'][] = ['rebalance', 'set_alert', 'add_note', 'open_research'];

const aiItemSchema = z.object({
  index: z.number().int(),
  holdingId: z.string().optional(),
  title: z.string().min(3),
  summary: z.string().min(8),
  impact: z.enum(['positive', 'negative', 'neutral', 'unclear']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  actions: z
    .array(
      z.object({
        label: z.string().min(2),
        action: z.enum(['rebalance', 'set_alert', 'add_note', 'open_research']),
        payload: z.unknown().optional()
      })
    )
    .optional()
});

const aiResponseSchema = z.object({ items: z.array(aiItemSchema) });

type RankedInsight = NormalizedProviderInsight & { score: number };

type PreparedInsight = {
  index: number;
  ranked: RankedInsight;
  baseItem: InsightItem;
};

function clampConfidence(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, Number(value)));
}

function impactFromSentiment(score?: number): InsightItem['impact'] {
  if (!Number.isFinite(score as number)) return 'unclear';
  const value = Number(score);
  if (value > 0.2) return 'positive';
  if (value < -0.2) return 'negative';
  if (Math.abs(value) <= 0.08) return 'neutral';
  return value > 0 ? 'positive' : 'negative';
}

function confidenceFromSentiment(score?: number): number {
  if (!Number.isFinite(score as number)) return 0.5;
  const magnitude = Math.abs(Number(score));
  return Math.min(0.9, Math.max(0.2, magnitude));
}

function defaultActions(item: InsightItem): InsightAction[] {
  if (!item.holdingId) return [];
  const base: InsightAction[] = [
    { label: 'Add note', action: 'add_note', payload: { holdingId: item.holdingId } }
  ];
  if (item.impact === 'negative' || item.impact === 'unclear') {
    base.push({ label: 'Set price alert', action: 'set_alert', payload: { holdingId: item.holdingId } });
  }
  if (item.impact === 'positive') {
    base.push({ label: 'Review allocation', action: 'rebalance', payload: { holdingId: item.holdingId } });
  }
  return base;
}

function buildHoldingContexts(
  holdings: Holding[],
  displayCurrency: 'USD' | 'EUR',
  usdToEurRate: number
): { contexts: HoldingNewsContext[]; totalValue: number } {
  const valuations = holdings.map((holding) => ({
    holding,
    valuation: computeHoldingValuation(holding, {
      targetCurrency: displayCurrency,
      usdToEurRate,
      quote: undefined
    })
  }));

  const totalValue = valuations.reduce((sum, entry) => sum + entry.valuation.currentValueTarget, 0);
  const contexts: HoldingNewsContext[] = [];

  valuations.forEach(({ holding, valuation }) => {
    if (!holding.symbol) return;
    const symbol = holding.symbol.toUpperCase();
    const weight = totalValue > 0 ? valuation.currentValueTarget / totalValue : 0;
    contexts.push({
      holdingId: holding.id,
      name: holding.name,
      symbol,
      weight,
      type: holding.type
    });
  });

  return { contexts, totalValue };
}

function dedupeInsights(items: NormalizedProviderInsight[]): NormalizedProviderInsight[] {
  const seen = new Map<string, NormalizedProviderInsight>();
  items.forEach((item) => {
    const key = item.id || item.url;
    if (!seen.has(key)) seen.set(key, item);
  });
  return Array.from(seen.values());
}

function scoreInsight(insight: NormalizedProviderInsight, now: Date): number {
  const publishedAt = new Date(insight.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return 0;
  const hoursAgo = Math.max(0, (now.getTime() - publishedAt.getTime()) / (60 * 60 * 1000));
  const recencyFactor = 1 / (1 + hoursAgo);
  const weightSum = insight.relatedHoldings.reduce((sum, ctx) => sum + (ctx.weight || 0), 0);
  const weightFactor = 0.2 + weightSum;
  const sentiment = Number.isFinite(insight.sentimentScore as number) ? 1 + (insight.sentimentScore as number) : 1;
  const sentimentFactor = Math.max(0.2, sentiment);
  return weightFactor * recencyFactor * sentimentFactor;
}

function sanitizeSummary(summary: string): string {
  if (!summary) return 'No summary available.';
  const cleaned = summary.replace(/\s+/g, ' ').trim();
  return cleaned.length > 400 ? `${cleaned.slice(0, 397)}...` : cleaned;
}

function extractJson(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function finalizeActions(base: InsightItem, candidate?: InsightAction[]): InsightAction[] {
  if (!candidate || candidate.length === 0) return defaultActions(base);
  const valid = candidate.filter((action) => allowedActions.includes(action.action));
  if (valid.length === 0) return defaultActions(base);
  return valid.map((action) => ({ ...action, label: action.label.trim() }));
}

async function summariseWithAi(
  prepared: PreparedInsight[],
  signal?: AbortSignal
): Promise<Map<number, InsightItem> | null> {
  if (prepared.length === 0) return new Map();

  const payload = prepared.map((item) => ({
    index: item.index,
    title: item.baseItem.title,
    summary: item.ranked.summary,
    provider: item.ranked.provider,
    impact: item.baseItem.impact,
    confidence: item.baseItem.confidence,
    holdingId: item.baseItem.holdingId ?? null,
    holdings: item.ranked.relatedHoldings.map((ctx) => ({
      holdingId: ctx.holdingId,
      name: ctx.name,
      weight: Number(ctx.weight.toFixed(4))
    })),
    sentimentScore: item.ranked.sentimentScore ?? null,
    publishedAt: item.ranked.publishedAt,
    url: item.baseItem.source.url
  }));

  const systemPrompt = [
    'You summarise financial news for a personal portfolio tracker.',
    'Return strict JSON with schema {"items":[{index,title,summary,impact,confidence,holdingId?,actions?}]}.',
    'Impact must be positive, negative, neutral, or unclear. Confidence between 0 and 1.',
    'Only propose actions from: rebalance, set_alert, add_note, open_research.',
    'Keep each summary under 240 characters and emphasise the key takeaway.',
    'If unsure about impact, use "unclear" with confidence around 0.4.'
  ].join(' ');

  const userPrompt = `Portfolio news items:\n${JSON.stringify(payload, null, 2)}\nReturn the updated list as JSON.`;

  const result = await callAi({
    feature: 'insights',
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    cacheTtlSec: 60 * 60,
    abortSignal: signal
  });

  if (!result.ok || !result.text) return null;

  const jsonText = extractJson(result.text);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    console.warn('[insights][ai] JSON parse failed', error);
    return null;
  }

  const validated = aiResponseSchema.safeParse(parsed);
  if (!validated.success) {
    console.warn('[insights][ai] schema mismatch', validated.error);
    return null;
  }

  const byIndex = new Map<number, PreparedInsight>(prepared.map((item) => [item.index, item]));
  const map = new Map<number, InsightItem>();

  validated.data.items.forEach((item) => {
    const preparedItem = byIndex.get(item.index);
    if (!preparedItem) return;
    const base = preparedItem.baseItem;
    const merged: InsightItem = {
      ...base,
      title: item.title?.trim() || base.title,
      summary: item.summary?.trim() || base.summary,
      impact: item.impact ?? base.impact,
      confidence: clampConfidence(item.confidence ?? base.confidence),
      actions: finalizeActions(base, item.actions)
    };
    if (item.holdingId) merged.holdingId = item.holdingId;
    map.set(item.index, merged);
  });

  return map;
}

function prepareBaseItems(ranked: RankedInsight[]): PreparedInsight[] {
  return ranked.map((entry, index) => {
    const primaryHolding = entry.relatedHoldings[0];
    const base: InsightItem = {
      holdingId: primaryHolding?.holdingId,
      type: entry.type,
      title: entry.title,
      summary: sanitizeSummary(entry.summary),
      source: {
        name: entry.provider === 'alpha_vantage' ? 'Alpha Vantage' : 'Finnhub',
        url: entry.url
      },
      impact: impactFromSentiment(entry.sentimentScore),
      confidence: confidenceFromSentiment(entry.sentimentScore),
      actions: []
    };
    base.actions = defaultActions(base);
    return { index, ranked: entry, baseItem: base };
  });
}

export async function runInsightsJob(options?: { signal?: AbortSignal }): Promise<InsightRecord | null> {
  const repo = getRepository();
  const holdings = await repo.getHoldings({ includeDeleted: false });
  if (!holdings.length) return null;

  const state = useUIStore.getState();
  const lookbackHours = Math.max(12, state.insightsLookbackHours || 48);
  const now = new Date();
  const { contexts } = buildHoldingContexts(holdings, state.displayCurrency, state.usdToEurRate || 1);

  const providerCalls: Promise<NormalizedProviderInsight[]>[] = [];

  if (state.insightsAlphaVantageEnabled) {
    const key = (import.meta.env.VITE_ALPHAVANTAGE_KEY as string | undefined) || undefined;
    if (key) {
      providerCalls.push(
        fetchAlphaVantageNews(contexts, { apiKey: key, windowHours: lookbackHours, now, signal: options?.signal })
      );
    } else {
      console.info('[insights] Alpha Vantage disabled: missing VITE_ALPHAVANTAGE_KEY');
    }
  }

  if (state.insightsFinnhubEnabled) {
    const key = (import.meta.env.VITE_FINNHUB_KEY as string | undefined) || undefined;
    if (key) {
      providerCalls.push(
        fetchFinnhubNews(contexts, { apiKey: key, windowHours: lookbackHours, now, signal: options?.signal })
      );
    } else {
      console.info('[insights] Finnhub disabled: missing VITE_FINNHUB_KEY');
    }
  }

  const runId = nanoid('ins-run-');
  const baseRecord = {
    runId,
    createdAt: now.toISOString(),
    displayCurrency: state.displayCurrency,
    items: [] as InsightItem[]
  };

  if (providerCalls.length === 0) {
    const id = await repo.saveInsights(baseRecord);
    return { ...baseRecord, id };
  }

  const results: NormalizedProviderInsight[] = [];
  const settled = await Promise.allSettled(providerCalls);
  settled.forEach((entry) => {
    if (entry.status === 'fulfilled') {
      results.push(...entry.value);
    } else {
      console.warn('[insights] provider fetch failed', entry.reason);
    }
  });

  const windowStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const filtered = dedupeInsights(
    results.filter((item) => {
      const publishedAt = new Date(item.publishedAt);
      return !Number.isNaN(publishedAt.getTime()) && publishedAt >= windowStart;
    })
  );

  const ranked = filtered
    .map((item) => ({ ...item, score: scoreInsight(item, now) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  const prepared = prepareBaseItems(ranked);
  const aiMap = await summariseWithAi(prepared, options?.signal);

  const mergedItems = prepared.map((entry) => {
    const aiItem = aiMap?.get(entry.index);
    if (!aiItem) {
      return { ...entry.baseItem, actions: defaultActions(entry.baseItem) };
    }
    return aiItem;
  });

  const recordPayload = { ...baseRecord, items: mergedItems };
  const id = await repo.saveInsights(recordPayload);
  return { ...recordPayload, id };
}

export async function getRecentInsights(limit = 5): Promise<InsightRecord[]> {
  return getRepository().getInsights({ limit });
}

export function mapInsightsByHolding(record?: InsightRecord | null): Map<string, InsightItem[]> {
  const map = new Map<string, InsightItem[]>();
  if (!record) return map;
  record.items.forEach((item) => {
    if (!item.holdingId) return;
    if (!map.has(item.holdingId)) {
      map.set(item.holdingId, []);
    }
    map.get(item.holdingId)!.push(item);
  });
  return map;
}


