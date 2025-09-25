export type AiProviderId = 'openai' | 'anthropic' | 'xai';
export type AiFeature = 'chat' | 'insights' | 'research';
export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUSD?: number;
}

export interface AiError {
  code?: string;
  message: string;
  status?: number;
  provider?: AiProviderId;
  retryable?: boolean;
  details?: unknown;
}

export interface AiCallLogEntry {
  id: string;
  timestamp: string;
  provider: AiProviderId | 'unavailable';
  feature: AiFeature;
  model?: string;
  cached?: boolean;
  ok: boolean;
  message?: string;
  error?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  costUSD?: number;
  durationMs?: number;
  cacheKey?: string;
}

export interface ProviderRecommendedModels {
  feature: AiFeature;
  defaults: string[];
  all?: string[];
  note?: string;
}

export interface ProviderRespondRequest {
  model: string;
  system?: string;
  messages: AiMessage[];
  stream?: boolean;
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  useProxy?: boolean;
  webSearch?: boolean;
  feature?: AiFeature;
}

export type ProviderRespondResult =
  | {
      ok: true;
      model: string;
      text: string;
      usage?: AiUsage;
      finishReason?: string;
      raw?: unknown;
      toolCalls?: string[];
    }
  | {
      ok: false;
      error: AiError;
      raw?: unknown;
      toolCalls?: string[];
    };

export interface AiProvider {
  id: AiProviderId;
  listRecommendedModels(): Promise<ProviderRecommendedModels[]>;
  respond(req: ProviderRespondRequest): Promise<ProviderRespondResult>;
}

export interface AiClientRequest {
  feature: AiFeature;
  messages: AiMessage[];
  system?: string;
  stream?: boolean;
  onToken?: (token: string) => void;
  cacheTtlSec?: number;
  forceRefresh?: boolean;
  modelOverride?: string;
  abortSignal?: AbortSignal;
}

export type AiClientResult = ProviderRespondResult & {
  providerId: AiProviderId;
  feature: AiFeature;
  fromCache?: boolean;
  cacheKey?: string;
  toolCalls?: string[];
};

export interface AiCacheValue {
  response: ProviderRespondResult & { cachedAt: string };
  feature: AiFeature;
  model: string;
  provider: AiProviderId;
}
