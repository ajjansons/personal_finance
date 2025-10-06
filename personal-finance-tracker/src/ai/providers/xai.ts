import type {
  AiProvider,
  AiUsage,
  ProviderRecommendedModels,
  ProviderRespondRequest,
  ProviderRespondResult
} from '@/ai/types';
import { listToolDefinitions, executeToolByName } from '@/ai/tools';

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const PROXY_PATH = '/ai-proxy/xai/chat/completions';

const DEFAULT_MODEL_LIST: ProviderRecommendedModels[] = [
  {
    feature: 'chat',
    defaults: ['grok-4'],
    all: ['grok-4', 'grok-4-fast'],
    note: 'General portfolio Q&A and conversations.'
  },
  {
    feature: 'insights',
    defaults: ['grok-4-fast'],
    all: ['grok-4-fast', 'grok-4'],
    note: 'Fast summaries and analysis.'
  },
  {
    feature: 'research',
    defaults: ['grok-4'],
    all: ['grok-4', 'grok-4-fast'],
    note: 'Deeper synthesis with optional Live Search.'
  }
];

type XAIChatMessage =
  | {
      role: 'system' | 'user' | 'assistant';
      content: string;
      tool_calls?: {
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }[];
    }
  | {
      role: 'tool';
      content: string;
      tool_call_id: string;
    };

function extractKey(): string | undefined {
  const key = (import.meta.env as Record<string, string | undefined>).VITE_XAI_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

function buildHeaders(key: string | undefined, useProxy: boolean | undefined) {
  const result: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key && !useProxy) {
    result.Authorization = 'Bearer ' + key;
  }
  return result;
}

function buildMessages(req: ProviderRespondRequest): XAIChatMessage[] {
  return req.messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

function extractTextFromResponse(json: any): string {
  if (!json) return '';
  const directOutput = json.choices?.[0]?.message?.content ?? json.choices?.[0]?.delta?.content;
  if (typeof directOutput === 'string') return directOutput;
  if (Array.isArray(directOutput)) {
    const joined = directOutput
      .map((entry: any) => (typeof entry === 'string' ? entry : entry?.text ?? entry?.content ?? ''))
      .join('');
    if (joined.trim()) return joined;
  }
  return '';
}

function mapUsage(raw: any): AiUsage | undefined {
  if (!raw) return undefined;
  const usage = raw.usage ?? raw;
  if (!usage) return undefined;
  const promptTokens = usage.prompt_tokens ?? usage.promptTokens;
  const completionTokens = usage.completion_tokens ?? usage.completionTokens;
  const totalTokens = usage.total_tokens ?? usage.totalTokens ?? (promptTokens ?? 0) + (completionTokens ?? 0);
  return { promptTokens, completionTokens, totalTokens };
}

async function respond(req: ProviderRespondRequest): Promise<ProviderRespondResult> {
  const apiKey = extractKey();
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: 'missing_api_key',
        message: 'xAI API key is not configured. Set VITE_XAI_API_KEY in .env.local.',
        provider: 'xai'
      }
    };
  }

  const url = req.useProxy ? PROXY_PATH : XAI_API_URL;
  const baseMessages = buildMessages(req);
  const toolDefinitions = req.feature === 'chat' ? listToolDefinitions() : [];
  const xaiTools = toolDefinitions.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));

  const calledTools: string[] = [];
  const messages: XAIChatMessage[] = [...baseMessages];

  let allowTools = xaiTools.length > 0;
  let lastResponseJson: any = null;

  for (let iteration = 0; iteration < 4; iteration++) {
    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      stream: false
    };

    // Add tools if available
    if (xaiTools.length > 0) {
      body.tools = xaiTools;
      body.tool_choice = allowTools ? 'auto' : 'none';
    }

    // Add Live Search flag for research feature if web search is enabled
    if (req.feature === 'research' && req.webSearch) {
      body.live_search = true;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(apiKey, req.useProxy),
      body: JSON.stringify(body),
      signal: req.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      let parsed: any;
      try {
        parsed = errorText ? JSON.parse(errorText) : undefined;
      } catch {
        parsed = undefined;
      }
      const providerMessage = parsed?.error?.message ?? parsed?.message;
      console.error('[xai] request failed', {
        status: response.status,
        statusText: response.statusText,
        requestBody: { model: req.model, allowTools, useProxy: req.useProxy, liveSearch: body.live_search },
        responseBody: parsed ?? errorText
      });
      return {
        ok: false,
        error: {
          code: 'http_error',
          message: `xAI request failed (${response.status})${providerMessage ? `: ${providerMessage}` : ''}`,
          status: response.status,
          provider: 'xai',
          details: parsed ?? errorText
        }
      };
    }

    const json = await response.json();
    lastResponseJson = json;
    const choice = json.choices?.[0];
    const toolCalls = allowTools ? choice?.message?.tool_calls ?? [] : [];

    if (!toolCalls || toolCalls.length === 0) {
      const text = extractTextFromResponse(json);
      if (req.stream && req.onToken && text) {
        req.onToken(text);
      }
      const usage = mapUsage(json.usage);
      return {
        ok: true,
        text,
        model: json.model ?? req.model,
        usage,
        raw: json,
        toolCalls: calledTools
      };
    }

    allowTools = false;

    messages.push({
      role: 'assistant',
      content: choice?.message?.content ?? '',
      tool_calls: toolCalls.map((call: any) => ({
        id: call.id ?? `${Date.now()}`,
        type: 'function' as const,
        function: {
          name: call.function?.name ?? 'unknown_tool',
          arguments: call.function?.arguments ?? '{}'
        }
      }))
    });

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function?.name ?? 'unknown_tool';
      let toolResult = await executeToolByName(toolName, toolCall.function?.arguments ?? '{}');
      if (!toolResult) {
        toolResult = {
          success: false,
          error: 'Tool execution returned no result',
          data_provenance: []
        };
      }
      calledTools.push(toolName);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id ?? `${Date.now()}`,
        content: JSON.stringify(toolResult)
      });
    }
  }

  return {
    ok: false,
    error: {
      code: 'tool_loop',
      message: 'Unable to complete request after multiple tool exchanges.',
      provider: 'xai',
      details: lastResponseJson
    }
  };
}

export const xaiProvider: AiProvider = {
  id: 'xai',
  async listRecommendedModels(): Promise<ProviderRecommendedModels[]> {
    return DEFAULT_MODEL_LIST;
  },
  respond
};
