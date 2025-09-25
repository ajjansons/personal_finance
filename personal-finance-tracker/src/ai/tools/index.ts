import { z } from 'zod';
import { getRepository } from '@/lib/repository';
import {
  calcMarketValue,
  computeAllocationsByCategory,
  computeAllocationsByType,
  computePortfolioSeries
} from '@/lib/calculations';
import type { AiUsage } from '@/ai/types';

export type ToolExecutionSuccess<TData = unknown> = {
  success: true;
  data: TData;
  data_provenance: string[];
};

export type ToolExecutionFailure = {
  success: false;
  error: string;
  data_provenance: string[];
};

export type ToolExecutionResult<TData = unknown> = ToolExecutionSuccess<TData> | ToolExecutionFailure;

type ToolDefinition<S extends z.ZodTypeAny> = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  schema: S;
  execute: (input: z.infer<S>) => Promise<ToolExecutionResult>;
};

function defineTool<S extends z.ZodTypeAny>(definition: ToolDefinition<S>): ToolDefinition<S> {
  return definition;
}

const holdingsFilterSchema = z
  .object({
    filter: z
      .object({
        type: z.enum(['stock', 'crypto', 'cash', 'real_estate', 'other']).optional(),
        categoryId: z.string().min(1).optional(),
        search: z.string().min(1).optional(),
        includeDeleted: z.boolean().optional()
      })
      .optional()
  })
  .default({});

const holdingDetailsSchema = z.object({
  holdingId: z.string().min(1)
});

const priceHistorySchema = z.object({
  holdingId: z.string().min(1),
  range: z.enum(['1w', '1m', '3m', '6m', '1y', 'max']).optional()
});

const portfolioSnapshotTool = defineTool({
  name: 'get_portfolio_snapshot',
  description:
    'Return a high-level snapshot of the current portfolio including totals, allocations by type/category, and the historical value series.',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  schema: z.object({}).default({}),
  async execute() {
    const repo = getRepository();
    const [holdings, categories, pricePoints, transactions] = await Promise.all([
      repo.getHoldings({ includeDeleted: false }),
      repo.getCategories(),
      repo.getAllPricePoints(),
      repo.getAllTransactions()
    ]);

    const activeHoldings = holdings.filter((holding) => !holding.isDeleted);
    const allocationsByType = computeAllocationsByType(activeHoldings);
    const allocationsByCategory = computeAllocationsByCategory(activeHoldings, categories);
    const portfolioSeries = computePortfolioSeries(activeHoldings, pricePoints, transactions);

    const totalMarketValue = allocationsByType.reduce((sum, entry) => sum + entry.value, 0);
    const totalCostBasis = activeHoldings.reduce((sum, holding) => {
      const basis = typeof holding.buyValue === 'number' ? holding.buyValue : holding.units * holding.pricePerUnit;
      return sum + basis;
    }, 0);
    const unrealizedPnlValue = totalMarketValue - totalCostBasis;
    const unrealizedPnlPercent = totalCostBasis ? unrealizedPnlValue / totalCostBasis : null;
    const lastUpdatedAt = activeHoldings.reduce<string | null>((latest, holding) => {
      const candidate = holding.updatedAt ?? holding.createdAt;
      if (!candidate) return latest;
      if (!latest || candidate > latest) return candidate;
      return latest;
    }, null);

    const data = {
      holdingsCount: activeHoldings.length,
      totalMarketValue,
      totalCostBasis,
      unrealizedPnlValue,
      unrealizedPnlPercent,
      allocationsByType,
      allocationsByCategory,
      portfolioSeries,
      lastUpdatedAt
    };

    return {
      success: true,
      data,
      data_provenance: [
        'repository:getHoldings',
        'repository:getCategories',
        'repository:getAllPricePoints',
        'repository:getAllTransactions',
        'calculations:computeAllocationsByType',
        'calculations:computeAllocationsByCategory',
        'calculations:computePortfolioSeries'
      ]
    } satisfies ToolExecutionSuccess;
  }
});

const holdingsTool = defineTool({
  name: 'get_holdings',
  description:
    'Return the holdings list with computed market value, cost basis, and portfolio weight. Filter by type, category, or search term if provided.',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['stock', 'crypto', 'cash', 'real_estate', 'other'] },
          categoryId: { type: 'string' },
          search: { type: 'string', description: 'Case-insensitive match against holding name or symbol.' },
          includeDeleted: { type: 'boolean', default: false }
        },
        additionalProperties: false
      }
    },
    additionalProperties: false
  },
  schema: holdingsFilterSchema,
  async execute(input) {
    const repo = getRepository();
    const includeDeleted = input.filter?.includeDeleted ?? false;
    const holdings = await repo.getHoldings({ includeDeleted });

    const filtered = holdings.filter((holding) => {
      if (!includeDeleted && holding.isDeleted) return false;
      if (input.filter?.type && holding.type !== input.filter.type) return false;
      if (input.filter?.categoryId && holding.categoryId !== input.filter.categoryId) return false;
      if (input.filter?.search) {
        const haystack = `${holding.name} ${holding.symbol ?? ''}`.toLowerCase();
        if (!haystack.includes(input.filter.search.toLowerCase())) return false;
      }
      return true;
    });

    const totalMarketValue = filtered.reduce((sum, holding) => sum + calcMarketValue(holding), 0);

    const data = filtered
      .map((holding) => {
        const marketValue = calcMarketValue(holding);
        const costBasis = typeof holding.buyValue === 'number' ? holding.buyValue : holding.units * holding.pricePerUnit;
        const pnlValue = marketValue - costBasis;
        const pnlPercent = costBasis ? pnlValue / costBasis : null;
        return {
          id: holding.id,
          name: holding.name,
          symbol: holding.symbol ?? null,
          type: holding.type,
          units: holding.units,
          pricePerUnit: holding.pricePerUnit,
          currency: holding.currency,
          categoryId: holding.categoryId ?? null,
          purchaseDate: holding.purchaseDate,
          tags: holding.tags,
          notes: holding.notes ?? null,
          createdAt: holding.createdAt,
          updatedAt: holding.updatedAt,
          deleted: holding.isDeleted,
          marketValue,
          costBasis,
          unrealizedPnlValue: pnlValue,
          unrealizedPnlPercent: pnlPercent,
          portfolioWeight: totalMarketValue ? marketValue / totalMarketValue : 0
        };
      })
      .sort((a, b) => b.marketValue - a.marketValue);

    return {
      success: true,
      data,
      data_provenance: ['repository:getHoldings', 'calculations:calcMarketValue']
    } satisfies ToolExecutionSuccess;
  }
});

const holdingDetailsTool = defineTool({
  name: 'get_holding_details',
  description: 'Return detailed metrics, latest quoting, and recent transactions for a single holding.',
  parameters: {
    type: 'object',
    properties: {
      holdingId: { type: 'string' }
    },
    required: ['holdingId'],
    additionalProperties: false
  },
  schema: holdingDetailsSchema,
  async execute(input) {
    const repo = getRepository();
    const holdings = await repo.getHoldings({ includeDeleted: true });
    const holding = holdings.find((item) => item.id === input.holdingId);
    if (!holding) {
      return {
        success: false,
        error: `Holding ${input.holdingId} not found`,
        data_provenance: ['repository:getHoldings']
      } satisfies ToolExecutionFailure;
    }

    const [categories, priceHistory, transactions] = await Promise.all([
      repo.getCategories(),
      repo.getPriceHistory(holding.id),
      repo.getTransactions(holding.id)
    ]);

    const categoryName = categories.find((category) => category.id === holding.categoryId)?.name ?? null;
    const marketValue = calcMarketValue(holding);
    const costBasis = typeof holding.buyValue === 'number' ? holding.buyValue : holding.units * holding.pricePerUnit;
    const pnlValue = marketValue - costBasis;
    const pnlPercent = costBasis ? pnlValue / costBasis : null;
    const lastPricePoint = priceHistory[priceHistory.length - 1] ?? null;
    const previousPricePoint = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : null;
    const lastPrice = lastPricePoint?.pricePerUnit ?? holding.pricePerUnit;
    const previousPrice = previousPricePoint?.pricePerUnit ?? lastPrice;
    const dayChangeValue = lastPrice - previousPrice;
    const dayChangePercent = previousPrice ? dayChangeValue / previousPrice : null;

    const data = {
      holding: {
        id: holding.id,
        name: holding.name,
        symbol: holding.symbol ?? null,
        type: holding.type,
        currency: holding.currency,
        categoryId: holding.categoryId ?? null,
        categoryName,
        tags: holding.tags,
        notes: holding.notes ?? null,
        purchaseDate: holding.purchaseDate,
        createdAt: holding.createdAt,
        updatedAt: holding.updatedAt,
        deleted: holding.isDeleted
      },
      metrics: {
        units: holding.units,
        pricePerUnit: holding.pricePerUnit,
        lastPrice,
        previousPrice,
        dayChangeValue,
        dayChangePercent,
        marketValue,
        costBasis,
        unrealizedPnlValue: pnlValue,
        unrealizedPnlPercent: pnlPercent
      },
      recentTransactions: transactions.slice(-10),
      pricePointsSample: priceHistory.slice(-30)
    };

    return {
      success: true,
      data,
      data_provenance: [
        'repository:getHoldings',
        'repository:getCategories',
        'repository:getPriceHistory',
        'repository:getTransactions',
        'calculations:calcMarketValue'
      ]
    } satisfies ToolExecutionSuccess;
  }
});

const priceHistoryTool = defineTool({
  name: 'get_price_history',
  description: 'Return the historical price points and transactions for a holding, optionally restricted to a time range.',
  parameters: {
    type: 'object',
    properties: {
      holdingId: { type: 'string' },
      range: { type: 'string', enum: ['1w', '1m', '3m', '6m', '1y', 'max'] }
    },
    required: ['holdingId'],
    additionalProperties: false
  },
  schema: priceHistorySchema,
  async execute(input) {
    const repo = getRepository();
    const [pricePoints, transactions, holdings] = await Promise.all([
      repo.getPriceHistory(input.holdingId),
      repo.getTransactions(input.holdingId),
      repo.getHoldings({ includeDeleted: true })
    ]);

    const holding = holdings.find((item) => item.id === input.holdingId);
    if (!holding) {
      return {
        success: false,
        error: `Holding ${input.holdingId} not found`,
        data_provenance: ['repository:getHoldings']
      } satisfies ToolExecutionFailure;
    }

    const rangeDaysMap: Record<string, number> = {
      '1w': 7,
      '1m': 30,
      '3m': 90,
      '6m': 180,
      '1y': 365
    };

    let filteredPrices = pricePoints.slice();
    let filteredTransactions = transactions.slice();

    if (input.range && input.range !== 'max') {
      const days = rangeDaysMap[input.range];
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      filteredPrices = filteredPrices.filter((point) => Date.parse(point.dateISO) >= cutoff);
      filteredTransactions = filteredTransactions.filter((tx) => Date.parse(tx.dateISO) >= cutoff);
    }

    const data = {
      holding: {
        id: holding.id,
        name: holding.name,
        symbol: holding.symbol ?? null,
        type: holding.type,
        currency: holding.currency
      },
      range: input.range ?? 'max',
      pricePoints: filteredPrices,
      transactions: filteredTransactions
    };

    return {
      success: true,
      data,
      data_provenance: ['repository:getPriceHistory', 'repository:getTransactions', 'repository:getHoldings']
    } satisfies ToolExecutionSuccess;
  }
});

const TOOL_DEFINITIONS = [portfolioSnapshotTool, holdingsTool, holdingDetailsTool, priceHistoryTool] as const;
const TOOL_MAP = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

export type SupportedToolName = (typeof TOOL_DEFINITIONS)[number]['name'];

export function listToolDefinitions() {
  return TOOL_DEFINITIONS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters
  }));
}

export async function executeToolByName(name: string, rawArgs: unknown): Promise<ToolExecutionResult> {
  const tool = TOOL_MAP.get(name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}`, data_provenance: [] };
  }

  let parsedArgs: unknown = rawArgs;
  if (typeof rawArgs === 'string') {
    const trimmed = rawArgs.trim();
    if (trimmed.length) {
      try {
        parsedArgs = JSON.parse(trimmed);
      } catch (error: any) {
        return {
          success: false,
          error: `Invalid JSON arguments for ${name}: ${error?.message ?? error}`,
          data_provenance: []
        };
      }
    } else {
      parsedArgs = {};
    }
  }

  try {
    // TS cannot infer the concrete schema type for each tool through the heterogeneous map.
    // The zod parse call guarantees runtime validation, so we rely on `any` when invoking the executor.
    const input = tool.schema.parse(parsedArgs ?? {}) as any;
    return await tool.execute(input);
  } catch (error: any) {
    return {
      success: false,
      error: error?.message ?? 'Tool execution failed',
      data_provenance: []
    };
  }
}
