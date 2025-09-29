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

const POSITIVE_KEYWORDS = [
  'partnership', 'acquired', 'acquisition', 'merger', 'revenue growth', 'beat expectations',
  'exceeds', 'profit', 'gains', 'surge', 'breakthrough', 'expansion', 'launched', 'innovation',
  'success', 'approved', 'upgrade', 'outperform', 'strong', 'bullish', 'rally', 'soars'
];

const NEGATIVE_KEYWORDS = [
  'lawsuit', 'sued', 'investigation', 'downgrade', 'miss', 'misses', 'layoffs', 'bankruptcy',
  'decline', 'drops', 'plunge', 'falls', 'losses', 'warning', 'concern', 'delays', 'recall',
  'scandal', 'fraud', 'bearish', 'underperform', 'slump', 'weak', 'disappoints'
];

const NEUTRAL_KEYWORDS = [
  'announced', 'scheduled', 'updated', 'reports', 'conference', 'meeting', 'statement',
  'released', 'filed', 'declared', 'presented'
];

type KeywordAnalysisResult = {
  impact: InsightItem['impact'];
  confidence: number;
  matchedKeywords: string[];
};

function analyzeNewsKeywords(title: string, summary: string): KeywordAnalysisResult {
  const text = `${title} ${summary}`.toLowerCase();

  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];
  const neutralMatches: string[] = [];

  POSITIVE_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword.toLowerCase())) {
      positiveMatches.push(keyword);
    }
  });

  NEGATIVE_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword.toLowerCase())) {
      negativeMatches.push(keyword);
    }
  });

  NEUTRAL_KEYWORDS.forEach((keyword) => {
    if (text.includes(keyword.toLowerCase())) {
      neutralMatches.push(keyword);
    }
  });

  const totalMatches = positiveMatches.length + negativeMatches.length + neutralMatches.length;

  // No keywords matched
  if (totalMatches === 0) {
    return { impact: 'unclear', confidence: 0.3, matchedKeywords: [] };
  }

  // Determine dominant sentiment
  let impact: InsightItem['impact'] = 'neutral';
  let matchedKeywords: string[] = [];

  if (positiveMatches.length > negativeMatches.length && positiveMatches.length > neutralMatches.length) {
    impact = 'positive';
    matchedKeywords = positiveMatches;
  } else if (negativeMatches.length > positiveMatches.length && negativeMatches.length > neutralMatches.length) {
    impact = 'negative';
    matchedKeywords = negativeMatches;
  } else if (neutralMatches.length > 0 && positiveMatches.length === negativeMatches.length) {
    impact = 'neutral';
    matchedKeywords = neutralMatches;
  } else if (positiveMatches.length > 0 && negativeMatches.length > 0) {
    // Mixed signals - mark as unclear but with higher confidence
    impact = 'unclear';
    matchedKeywords = [...positiveMatches, ...negativeMatches];
  } else {
    impact = 'neutral';
    matchedKeywords = neutralMatches;
  }

  // Calculate confidence based on keyword strength
  const dominantCount = matchedKeywords.length;
  const baseConfidence = Math.min(0.85, 0.4 + (dominantCount * 0.15));

  return { impact, confidence: baseConfidence, matchedKeywords };
}

function clampConfidence(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, Number(value)));
}

function impactFromSentiment(score?: number, title?: string, summary?: string): InsightItem['impact'] {
  // If we have a valid sentiment score, use it
  if (Number.isFinite(score as number)) {
    const value = Number(score);
    if (value > 0.2) return 'positive';
    if (value < -0.2) return 'negative';
    if (Math.abs(value) <= 0.08) return 'neutral';
    return value > 0 ? 'positive' : 'negative';
  }

  // Fallback to keyword analysis
  if (title || summary) {
    const analysis = analyzeNewsKeywords(title || '', summary || '');
    return analysis.impact;
  }

  return 'unclear';
}

function confidenceFromSentiment(score?: number, title?: string, summary?: string): number {
  // If we have a valid sentiment score, calculate confidence from it
  if (Number.isFinite(score as number)) {
    const magnitude = Math.abs(Number(score));
    return Math.min(0.9, Math.max(0.25, magnitude * 1.2));
  }

  // Fallback to keyword-based confidence
  if (title || summary) {
    const analysis = analyzeNewsKeywords(title || '', summary || '');
    return analysis.confidence;
  }

  return 0.35;
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
    'You are a financial news analyst for a personal portfolio tracker.',
    'Analyze each news item and determine its impact on the holdings.',
    '',
    'CLASSIFICATION RULES:',
    '- positive: Revenue growth, partnerships, product launches, upgrades, beating expectations, expansion, approvals',
    '- negative: Lawsuits, downgrades, missing expectations, layoffs, investigations, recalls, warnings, declining performance',
    '- neutral: Routine announcements, scheduled events, updates without clear directional impact',
    '- unclear: Mixed signals or insufficient information to determine impact',
    '',
    'CONFIDENCE SCORING (0.0 to 1.0):',
    '- 0.2-0.3: Very uncertain, vague news, minimal details',
    '- 0.4-0.5: Some uncertainty, general news, indirect relevance',
    '- 0.6-0.7: Reasonably confident, clear news with direct relevance',
    '- 0.8-0.9: High confidence, major news with clear implications, well-sourced',
    '',
    'ACTIONS (only suggest if highly relevant):',
    '- rebalance: For significant positive developments that may warrant increasing allocation',
    '- set_alert: For concerning negative news or volatility indicators',
    '- add_note: For any noteworthy context worth recording',
    '- open_research: For major developments requiring deeper investigation',
    '',
    'SUMMARY GUIDELINES:',
    '- Keep under 200 characters',
    '- Lead with the key takeaway (what happened and why it matters)',
    '- Focus on portfolio implications',
    '- Be specific with numbers/percentages when available',
    '',
    'Return strict JSON: {"items":[{index,title,summary,impact,confidence,holdingId?,actions?}]}'
  ].join('\n');

  const userPrompt = `Analyze these portfolio news items and return the enriched JSON:\n\n${JSON.stringify(payload, null, 2)}`;

  const result = await callAi({
    feature: 'insights',
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    cacheTtlSec: 5 * 60, // Reduced to 5 minutes for more real-time insights
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
      impact: impactFromSentiment(entry.sentimentScore, entry.title, entry.summary),
      confidence: confidenceFromSentiment(entry.sentimentScore, entry.title, entry.summary),
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

  const runId = nanoid('ins-run-');
  const baseRecord = {
    runId,
    createdAt: now.toISOString(),
    displayCurrency: state.displayCurrency,
    items: [] as InsightItem[]
  };

  // Build provider calls with individual timeouts
  const providerCalls: Promise<NormalizedProviderInsight[]>[] = [];

  if (state.insightsAlphaVantageEnabled) {
    const key = (import.meta.env.VITE_ALPHAVANTAGE_KEY as string | undefined) || undefined;
    if (key) {
      // Wrap with timeout to prevent hanging
      providerCalls.push(
        Promise.race([
          fetchAlphaVantageNews(contexts, { apiKey: key, windowHours: lookbackHours, now, signal: options?.signal }),
          new Promise<NormalizedProviderInsight[]>((resolve) =>
            setTimeout(() => {
              console.warn('[insights] Alpha Vantage timed out after 10s');
              resolve([]);
            }, 10000)
          )
        ])
      );
    } else {
      console.info('[insights] Alpha Vantage disabled: missing VITE_ALPHAVANTAGE_KEY');
    }
  }

  if (state.insightsFinnhubEnabled) {
    const key = (import.meta.env.VITE_FINNHUB_KEY as string | undefined) || undefined;
    if (key) {
      // Wrap with timeout to prevent hanging
      providerCalls.push(
        Promise.race([
          fetchFinnhubNews(contexts, { apiKey: key, windowHours: lookbackHours, now, signal: options?.signal }),
          new Promise<NormalizedProviderInsight[]>((resolve) =>
            setTimeout(() => {
              console.warn('[insights] Finnhub timed out after 10s');
              resolve([]);
            }, 10000)
          )
        ])
      );
    } else {
      console.info('[insights] Finnhub disabled: missing VITE_FINNHUB_KEY');
    }
  }

  if (providerCalls.length === 0) {
    const id = await repo.saveInsights(baseRecord);
    return { ...baseRecord, id };
  }

  // Fetch from all providers in parallel with error handling
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

  // For better performance, use keyword-based analysis as baseline and skip AI if it takes too long
  // Check if we should even try AI summarization (default to true)
  const shouldUseAi = true;

  let mergedItems: InsightItem[] = prepared.map((entry) => ({
    ...entry.baseItem,
    actions: defaultActions(entry.baseItem)
  }));

  if (shouldUseAi && prepared.length > 0) {
    try {
      // Add a timeout for AI summarization to prevent long waits
      const aiMap = await Promise.race([
        summariseWithAi(prepared, options?.signal),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)) // 15 second timeout
      ]);

      if (aiMap) {
        mergedItems = prepared.map((entry) => {
          const aiItem = aiMap.get(entry.index);
          if (!aiItem) {
            return { ...entry.baseItem, actions: defaultActions(entry.baseItem) };
          }
          return aiItem;
        });
      } else {
        console.info('[insights] AI summarization timed out, using keyword-based analysis');
      }
    } catch (error) {
      console.warn('[insights] AI summarization failed, using keyword-based analysis', error);
    }
  }

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


