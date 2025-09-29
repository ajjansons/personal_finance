import type { InsightItem } from '@/lib/repository/types';

export type HoldingNewsContext = {
  holdingId: string;
  name: string;
  symbol?: string;
  weight: number;
  type: string;
};

export type ProviderFetchOptions = {
  apiKey?: string;
  windowHours: number;
  now: Date;
  signal?: AbortSignal;
};

export type NormalizedProviderInsight = {
  id: string;
  provider: 'alpha_vantage' | 'finnhub';
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  type: InsightItem['type'];
  sentimentScore?: number;
  relatedHoldings: HoldingNewsContext[];
  raw?: unknown;
};
