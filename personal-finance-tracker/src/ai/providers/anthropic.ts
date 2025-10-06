import type {
  AiProvider,
  AiUsage,
  ProviderRecommendedModels,
  ProviderRespondRequest,
  ProviderRespondResult
} from '@/ai/types';
import { listToolDefinitions, executeToolByName } from '@/ai/tools';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const PROXY_PATH = '/ai-proxy/anthropic/messages';

const DEFAULT_MODEL_LIST: ProviderRecommendedModels[] = [
  {
    feature: 'chat',
    defaults: ['claude-sonnet-4.5'],
    all: ['claude-sonnet-4.5', 'claude-sonnet-4.5-reasoning'],
    note: 'General portfolio Q&A and conversations.'
  },
  {
    feature: 'insights',
    defaults: ['claude-sonnet-4.5'],
    all: ['claude-sonnet-4.5', 'claude-sonnet-4.5-reasoning'],
    note: 'Summaries and lightweight reasoning.'
  },
  {
    feature: 'research',
    defaults: ['claude-sonnet-4.5-reasoning'],
    all: ['claude-sonnet-4.5-reasoning', 'claude-sonnet-4.5'],
    note: 'Deeper synthesis with extended thinking capabilities.'
  }
];

type AnthropicMessage =
  | {
      role: 'user' | 'assistant';
      content: string | AnthropicContentBlock[];
    };

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

function extractKey(): string | undefined {
  const key = (import.meta.env as Record<string, string | undefined>).VITE_ANTHROPIC_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

function buildHeaders(key: string | undefined, useProxy: boolean | undefined) {
  const result: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01'
  };
  if (key && !useProxy) {
    result['x-api-key'] = key;
  }
  return result;
}

function buildMessages(req: ProviderRespondRequest): AnthropicMessage[] {
  return req.messages.map((message) => ({
    role: message.role === 'system' ? 'user' : message.role,
    content: message.content
  }));
}

function extractTextFromResponse(json: any): string {
  if (!json?.content) return '';

  if (Array.isArray(json.content)) {
    const textBlocks = json.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text || '')
      .join('');
    return textBlocks;
  }

  if (typeof json.content === 'string') {
    return json.content;
  }

  return '';
}

function mapUsage(raw: any): AiUsage | undefined {
  if (!raw?.usage) return undefined;
  const usage = raw.usage;
  const promptTokens = usage.input_tokens ?? 0;
  const completionTokens = usage.output_tokens ?? 0;
  const totalTokens = promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

async function respond(req: ProviderRespondRequest): Promise<ProviderRespondResult> {
  const apiKey = extractKey();
  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: 'missing_api_key',
        message: 'Anthropic API key is not configured. Set VITE_ANTHROPIC_API_KEY in .env.local.',
        provider: 'anthropic'
      }
    };
  }

  const url = req.useProxy ? PROXY_PATH : ANTHROPIC_API_URL;
  const baseMessages = buildMessages(req);
  const toolDefinitions = req.feature === 'chat' ? listToolDefinitions() : [];

  const anthropicTools = toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));

  const calledTools: string[] = [];
  const messages: AnthropicMessage[] = [...baseMessages];

  let allowTools = anthropicTools.length > 0;
  let lastResponseJson: any = null;

  for (let iteration = 0; iteration < 4; iteration++) {
    const body: Record<string, unknown> = {
      model: req.model,
      messages,
      max_tokens: 4096,
      stream: false
    };

    if (req.system) {
      body.system = req.system;
    }

    if (anthropicTools.length > 0 && allowTools) {
      body.tools = anthropicTools;
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
      console.error('[anthropic] request failed', {
        status: response.status,
        statusText: response.statusText,
        requestBody: { model: req.model, allowTools, useProxy: req.useProxy },
        responseBody: parsed ?? errorText
      });
      return {
        ok: false,
        error: {
          code: 'http_error',
          message: `Anthropic request failed (${response.status})${providerMessage ? `: ${providerMessage}` : ''}`,
          status: response.status,
          provider: 'anthropic',
          details: parsed ?? errorText
        }
      };
    }

    const json = await response.json();
    lastResponseJson = json;

    // Check for tool use in response
    const toolUseBlocks = Array.isArray(json.content)
      ? json.content.filter((block: any) => block.type === 'tool_use')
      : [];

    if (!allowTools || toolUseBlocks.length === 0) {
      const text = extractTextFromResponse(json);
      if (req.stream && req.onToken && text) {
        req.onToken(text);
      }
      const usage = mapUsage(json);
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

    // Add assistant message with tool use
    messages.push({
      role: 'assistant',
      content: json.content
    });

    // Execute tools and add results
    const toolResults: AnthropicContentBlock[] = [];
    for (const toolUse of toolUseBlocks) {
      const toolName = toolUse.name ?? 'unknown_tool';
      let toolResult = await executeToolByName(toolName, toolUse.input ?? {});
      if (!toolResult) {
        toolResult = {
          success: false,
          error: 'Tool execution returned no result',
          data_provenance: []
        };
      }
      calledTools.push(toolName);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(toolResult)
      });
    }

    messages.push({
      role: 'user',
      content: toolResults
    });
  }

  return {
    ok: false,
    error: {
      code: 'tool_loop',
      message: 'Unable to complete request after multiple tool exchanges.',
      provider: 'anthropic',
      details: lastResponseJson
    }
  };
}

export const anthropicProvider: AiProvider = {
  id: 'anthropic',
  async listRecommendedModels(): Promise<ProviderRecommendedModels[]> {
    return DEFAULT_MODEL_LIST;
  },
  respond
};
