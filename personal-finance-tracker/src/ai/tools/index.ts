import { z } from 'zod';
import { getRepository } from '@/lib/repository';
import {
  computeHoldingValuation,
  computePortfolioSeries
} from '@/lib/calculations';
import type { HoldingValuation } from '@/lib/calculations';
import type { FiatCurrency, Holding } from '@/lib/repository/types';
import { useUIStore } from '@/lib/state/uiStore';
import { chainProvider } from '@/lib/market-data/chainProvider';
import { convert } from '@/lib/fx/twelveDataFx';
import type { AiUsage } from '@/ai/types';
import { generateResearchReport } from '@/features/research/researchEngine';

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

const whatIfSchema = z.object({
  holdingId: z.string().min(1),
  deltaUnits: z.number(),
  pricePerUnit: z.number().positive().optional()
});

const rebalancePolicySchema = z
  .object({
    method: z.enum(['equal', 'custom']).optional(),
    targetWeights: z.record(z.string(), z.number().nonnegative()).optional(),
    minTradeValue: z.number().nonnegative().optional()
  })
  .default({});

const addNoteSchema = z.object({
  holdingId: z.string().min(1),
  text: z.string().min(1)
});

const priceAlertRuleSchema = z.object({
  type: z.enum(['price_above', 'price_below']),
  price: z.number().positive(),
  currency: z.enum(['USD', 'EUR']).optional()
});

const setAlertSchema = z.object({
  holdingId: z.string().min(1),
  rule: priceAlertRuleSchema
});

type QuoteSnapshot = {
  price: number;
  currency: FiatCurrency;
  changePercent?: number;
};

function makeQuoteKey(holding: Pick<Holding, 'type' | 'symbol'>) {
  return `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
}

async function fetchQuoteSnapshots(holdings: Holding[]): Promise<Record<string, QuoteSnapshot>> {
  const targets = Array.from(
    new Set(
      holdings
        .filter((holding) => !holding.isDeleted && (holding.type === 'stock' || holding.type === 'crypto') && holding.symbol)
        .map((holding) => makeQuoteKey(holding))
    )
  );

  if (targets.length === 0) return {};

  const map: Record<string, QuoteSnapshot> = {};
  await Promise.all(
    targets.map(async (key) => {
      const [type, symbol] = key.split(':');
      try {
        const quote = await chainProvider.getQuote(symbol, type as 'stock' | 'crypto');
        map[key] = {
          price: quote.price,
          currency: quote.currency,
          changePercent: quote.changePercent
        };
      } catch (error) {
        console.warn('[ai-tools] quote fetch failed', { key, error });
      }
    })
  );
  return map;
}

function buildValuations(
  holdings: Holding[],
  options: { quotes: Record<string, QuoteSnapshot | undefined>; targetCurrency: FiatCurrency; usdToEurRate: number }
) {
  return holdings.map((holding) => {
    const quoteKey = makeQuoteKey(holding);
    const snapshot = options.quotes[quoteKey];
    const valuation = computeHoldingValuation(holding, {
      quote: snapshot ? { price: snapshot.price, currency: snapshot.currency } : undefined,
      targetCurrency: options.targetCurrency,
      usdToEurRate: options.usdToEurRate
    });
    return { holding, valuation, quote: snapshot } as {
      holding: Holding;
      valuation: HoldingValuation;
      quote?: QuoteSnapshot;
    };
  });
}

function getAiCurrencyConfig(): { targetCurrency: FiatCurrency; usdToEurRate: number } {
  const state = useUIStore.getState();
  const targetCurrency = state.displayCurrency ?? 'EUR';
  const usdToEurRate = state.usdToEurRate && state.usdToEurRate > 0 ? state.usdToEurRate : 1;
  return { targetCurrency, usdToEurRate };
}

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
    const { targetCurrency, usdToEurRate } = getAiCurrencyConfig();
    const quotes = await fetchQuoteSnapshots(activeHoldings);
    const valuations = buildValuations(activeHoldings, {
      quotes,
      targetCurrency,
      usdToEurRate
    });

    const totalMarketValue = valuations.reduce((sum, entry) => sum + entry.valuation.currentValueTarget, 0);
    const totalCostBasis = valuations.reduce((sum, entry) => sum + entry.valuation.costBasisTarget, 0);
    const unrealizedPnlValue = totalMarketValue - totalCostBasis;
    const unrealizedPnlPercent = totalCostBasis ? unrealizedPnlValue / totalCostBasis : null;

    const byType = new Map<string, number>();
    valuations.forEach(({ holding, valuation }) => {
      byType.set(holding.type, (byType.get(holding.type) || 0) + valuation.currentValueTarget);
    });
    const allocationsByType = Array.from(byType.entries()).map(([name, value]) => ({
      name,
      value,
      percent: totalMarketValue ? value / totalMarketValue : 0
    }));

    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const byCategory = new Map<string, number>();
    valuations.forEach(({ holding, valuation }) => {
      const key = categoryNames.get(holding.categoryId || '') || 'Uncategorized';
      byCategory.set(key, (byCategory.get(key) || 0) + valuation.currentValueTarget);
    });
    const allocationsByCategory = Array.from(byCategory.entries()).map(([name, value]) => ({
      name,
      value,
      percent: totalMarketValue ? value / totalMarketValue : 0
    }));

    const portfolioSeries = computePortfolioSeries(activeHoldings, pricePoints, transactions, {
      targetCurrency,
      usdToEurRate,
      quotes
    });

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
      lastUpdatedAt,
      displayCurrency: targetCurrency
    };

    return {
      success: true,
      data,
      data_provenance: [
        'repository:getHoldings',
        'repository:getCategories',
        'repository:getAllPricePoints',
        'repository:getAllTransactions',
        'market-data:chainProvider',
        'calculations:computeHoldingValuation',
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
    const { targetCurrency, usdToEurRate } = getAiCurrencyConfig();
    const quotes = await fetchQuoteSnapshots(holdings);
    const valuations = buildValuations(holdings, {
      quotes,
      targetCurrency,
      usdToEurRate
    });

    const totalActiveValue = valuations.reduce((sum, entry) => {
      if (entry.holding.isDeleted && !includeDeleted) return sum;
      return sum + entry.valuation.currentValueTarget;
    }, 0);

    const filtered = valuations.filter(({ holding }) => {
      if (!includeDeleted && holding.isDeleted) return false;
      if (input.filter?.type && holding.type !== input.filter.type) return false;
      if (input.filter?.categoryId && holding.categoryId !== input.filter.categoryId) return false;
      if (input.filter?.search) {
        const haystack = `${holding.name} ${holding.symbol ?? ''}`.toLowerCase();
        if (!haystack.includes(input.filter.search.toLowerCase())) return false;
      }
      return true;
    });

    const data = filtered
      .map(({ holding, valuation, quote }) => {
        const pnlPercent = valuation.gainPercent != null ? valuation.gainPercent / 100 : null;
        return {
          id: holding.id,
          name: holding.name,
          symbol: holding.symbol ?? null,
          type: holding.type,
          units: holding.units,
          pricePerUnit: holding.pricePerUnit,
          pricePerUnitDisplay: valuation.unitPriceTarget,
          currency: holding.currency,
          categoryId: holding.categoryId ?? null,
          purchaseDate: holding.purchaseDate,
          tags: holding.tags,
          notes: holding.notes ?? null,
          createdAt: holding.createdAt,
          updatedAt: holding.updatedAt,
          deleted: holding.isDeleted,
          marketValue: valuation.currentValueTarget,
          costBasis: valuation.costBasisTarget,
          unrealizedPnlValue: valuation.gainTarget,
          unrealizedPnlPercent: pnlPercent,
          portfolioWeight: totalActiveValue ? valuation.currentValueTarget / totalActiveValue : 0,
          dailyChangePercent: quote?.changePercent ?? null,
          displayCurrency: targetCurrency,
          usedQuote: valuation.usedQuote
        };
      })
      .sort((a, b) => b.marketValue - a.marketValue);

    return {
      success: true,
      data,
      data_provenance: ['repository:getHoldings', 'market-data:chainProvider', 'calculations:computeHoldingValuation']
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
    const { targetCurrency, usdToEurRate } = getAiCurrencyConfig();
    const quotes = await fetchQuoteSnapshots([holding]);
    const quote = quotes[makeQuoteKey(holding)];
    const valuation = computeHoldingValuation(holding, {
      quote: quote ? { price: quote.price, currency: quote.currency } : undefined,
      targetCurrency,
      usdToEurRate
    });

    const holdingCurrency = valuation.holdingCurrency;
    const lastPricePoint = priceHistory[priceHistory.length - 1] ?? null;
    const previousPricePoint = priceHistory.length > 1 ? priceHistory[priceHistory.length - 2] : null;
    const lastPriceHolding = lastPricePoint?.pricePerUnit ?? valuation.unitPriceHolding ?? holding.pricePerUnit;
    const previousPriceHolding = previousPricePoint?.pricePerUnit ?? lastPriceHolding;
    const lastPriceDisplay = convert(lastPriceHolding, holdingCurrency, targetCurrency, usdToEurRate);
    const previousPriceDisplay = convert(previousPriceHolding, holdingCurrency, targetCurrency, usdToEurRate);
    const dayChangeValue = lastPriceDisplay - previousPriceDisplay;
    const dayChangePercent = previousPriceDisplay ? dayChangeValue / previousPriceDisplay : null;

    const pricePointsSample = priceHistory.slice(-30).map((point) => ({
      ...point,
      pricePerUnitDisplay: convert(point.pricePerUnit, holdingCurrency, targetCurrency, usdToEurRate)
    }));

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
        deleted: holding.isDeleted,
        displayCurrency: targetCurrency
      },
      metrics: {
        units: holding.units,
        pricePerUnit: holding.pricePerUnit,
        pricePerUnitDisplay: valuation.unitPriceTarget,
        lastPriceDisplay,
        previousPriceDisplay,
        dayChangeValue,
        dayChangePercent,
        marketValue: valuation.currentValueTarget,
        costBasis: valuation.costBasisTarget,
        unrealizedPnlValue: valuation.gainTarget,
        unrealizedPnlPercent: valuation.gainPercent != null ? valuation.gainPercent / 100 : null,
        usedQuote: valuation.usedQuote,
        quoteChangePercent: quote?.changePercent ?? null
      },
      recentTransactions: transactions.slice(-10),
      pricePointsSample
    };

    return {
      success: true,
      data,
      data_provenance: [
        'repository:getHoldings',
        'repository:getCategories',
        'repository:getPriceHistory',
        'repository:getTransactions',
        'market-data:chainProvider',
        'calculations:computeHoldingValuation'
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

const whatIfTool = defineTool({
  name: 'what_if',
  description: 'Simulate the impact of buying or selling units of a holding without persisting changes.',
  parameters: {
    type: 'object',
    properties: {
      holdingId: { type: 'string' },
      deltaUnits: { type: 'number' },
      pricePerUnit: { type: 'number' }
    },
    required: ['holdingId', 'deltaUnits'],
    additionalProperties: false
  },
  schema: whatIfSchema,
  async execute(input) {
    const repo = getRepository();
    const holdings = await repo.getHoldings({ includeDeleted: false });
    const holding = holdings.find((candidate) => candidate.id === input.holdingId);
    if (!holding) {
      return { success: false, error: `Holding ${input.holdingId} not found`, data_provenance: ['repository:getHoldings'] } as ToolExecutionFailure;
    }

    const { targetCurrency, usdToEurRate } = getAiCurrencyConfig();
    const quotes = await fetchQuoteSnapshots(holdings);
    const valuations = buildValuations(holdings, { quotes, targetCurrency, usdToEurRate });

    const beforePortfolio = valuations.reduce((sum, entry) => sum + entry.valuation.currentValueTarget, 0);
    const currentValuation = valuations.find((entry) => entry.holding.id === holding.id)?.valuation;
    if (!currentValuation) {
      return { success: false, error: 'Unable to compute holding valuation.', data_provenance: ['repository:getHoldings'] };
    }

    const isAmount = holding.type === 'cash' || holding.type === 'real_estate';
    const newUnits = isAmount ? holding.units : holding.units + input.deltaUnits;
    if (!isAmount && newUnits < 0) {
      return { success: false, error: 'Resulting units would be negative. Adjust deltaUnits.', data_provenance: [] };
    }

    const quoteKey = makeQuoteKey(holding);
    const quote = quotes[quoteKey];
    const holdingCurrency = currentValuation.holdingCurrency;
    const inferredPriceHolding = (() => {
      if (typeof input.pricePerUnit === 'number') return input.pricePerUnit;
      if (quote) {
        return convert(quote.price, quote.currency, holdingCurrency, usdToEurRate);
      }
      return currentValuation.unitPriceHolding ?? holding.pricePerUnit;
    })();

    let afterHoldingValueHolding: number;
    if (isAmount) {
      afterHoldingValueHolding = currentValuation.currentValueHolding + input.deltaUnits;
    } else {
      afterHoldingValueHolding = (newUnits) * (inferredPriceHolding ?? holding.pricePerUnit);
    }
    const afterHoldingValueTarget = convert(afterHoldingValueHolding, holdingCurrency, targetCurrency, usdToEurRate);

    const beforeHoldingTarget = currentValuation.currentValueTarget;
    const afterPortfolio = beforePortfolio - beforeHoldingTarget + afterHoldingValueTarget;

    return {
      success: true,
      data: {
        holdingId: holding.id,
        deltaUnits: input.deltaUnits,
        pricePerUnitUsed: inferredPriceHolding,
        currency: targetCurrency,
        before: {
          holdingValue: beforeHoldingTarget,
          portfolioValue: beforePortfolio
        },
        after: {
          holdingValue: afterHoldingValueTarget,
          portfolioValue: afterPortfolio
        },
        difference: {
          holdingValue: afterHoldingValueTarget - beforeHoldingTarget,
          portfolioValue: afterPortfolio - beforePortfolio
        }
      },
      data_provenance: ['repository:getHoldings', 'market-data:chainProvider', 'calculations:computeHoldingValuation']
    } satisfies ToolExecutionSuccess;
  }
});

const suggestRebalanceTool = defineTool({
  name: 'suggest_rebalance',
  description: 'Suggest a set of trades to achieve target portfolio weights without executing them.',
  parameters: {
    type: 'object',
    properties: {
      policy: {
        type: 'object',
        additionalProperties: true
      }
    },
    additionalProperties: false
  },
  schema: z.object({ policy: rebalancePolicySchema }).default({ policy: {} as any }),
  async execute(input) {
    const repo = getRepository();
    const holdings = await repo.getHoldings({ includeDeleted: false });
    if (holdings.length === 0) {
      return { success: false, error: 'No holdings available to rebalance.', data_provenance: ['repository:getHoldings'] };
    }

    const { targetCurrency, usdToEurRate } = getAiCurrencyConfig();
    const quotes = await fetchQuoteSnapshots(holdings);
    const valuations = buildValuations(holdings, { quotes, targetCurrency, usdToEurRate });
    const totalValue = valuations.reduce((sum, entry) => sum + entry.valuation.currentValueTarget, 0);
    if (totalValue === 0) {
      return { success: false, error: 'Portfolio total value is zero; cannot compute rebalance.', data_provenance: ['repository:getHoldings'] };
    }

    const method = input.policy.method ?? (input.policy.targetWeights ? 'custom' : 'equal');
    const minTradeValue = input.policy.minTradeValue ?? 1;

    let targetWeights: Record<string, number> = {};
    if (method === 'custom' && input.policy.targetWeights) {
      const raw = input.policy.targetWeights;
      const sum = Object.values(raw).reduce((acc, value) => acc + value, 0);
      if (sum <= 0) {
        return { success: false, error: 'Custom targetWeights must sum to a positive number.', data_provenance: [] };
      }
      targetWeights = Object.fromEntries(
        holdings.map((holding) => {
          const weight = raw[holding.id] ?? 0;
          return [holding.id, weight / sum];
        })
      );
    } else {
      const equalWeight = 1 / holdings.length;
      targetWeights = Object.fromEntries(holdings.map((holding) => [holding.id, equalWeight]));
    }

    const trades = valuations.map(({ holding, valuation }) => {
      const targetWeight = targetWeights[holding.id] ?? 0;
      const targetValue = targetWeight * totalValue;
      const diffValue = targetValue - valuation.currentValueTarget;
      const action = diffValue > minTradeValue ? 'buy' : diffValue < -minTradeValue ? 'sell' : 'hold';
      let deltaUnits = 0;
      if (action !== 'hold') {
        if (holding.type === 'cash' || holding.type === 'real_estate') {
          deltaUnits = diffValue;
        } else {
          const unitPrice = valuation.unitPriceTarget ?? convert(valuation.unitPriceHolding ?? holding.pricePerUnit, valuation.holdingCurrency, targetCurrency, usdToEurRate);
          deltaUnits = unitPrice ? diffValue / unitPrice : 0;
        }
      }
      return {
        holdingId: holding.id,
        action,
        deltaValue: diffValue,
        deltaUnits,
        targetValue,
        currentValue: valuation.currentValueTarget
      };
    });

    const summary = trades.reduce(
      (acc, trade) => {
        if (trade.action === 'buy') acc.totalBuy += trade.deltaValue;
        if (trade.action === 'sell') acc.totalSell += Math.abs(trade.deltaValue);
        return acc;
      },
      { totalBuy: 0, totalSell: 0 }
    );

    return {
      success: true,
      data: {
        currency: targetCurrency,
        targetWeights,
        trades,
        summary
      },
      data_provenance: ['repository:getHoldings', 'market-data:chainProvider', 'calculations:computeHoldingValuation']
    } satisfies ToolExecutionSuccess;
  }
});

const addNoteTool = defineTool({
  name: 'add_note',
  description: 'Append a text note to the specified holding.',
  parameters: {
    type: 'object',
    properties: {
      holdingId: { type: 'string' },
      text: { type: 'string' }
    },
    required: ['holdingId', 'text'],
    additionalProperties: false
  },
  schema: addNoteSchema,
  async execute(input) {
    const repo = getRepository();
    try {
      const updated = await repo.appendHoldingNote(input.holdingId, input.text);
      return {
        success: true,
        data: { holdingId: input.holdingId, notes: updated.notes ?? '' },
        data_provenance: ['repository:appendHoldingNote']
      } satisfies ToolExecutionSuccess;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message ?? 'Failed to append note.',
        data_provenance: ['repository:appendHoldingNote']
      } satisfies ToolExecutionFailure;
    }
  }
});

const setAlertTool = defineTool({
  name: 'set_alert',
  description: 'Create a local price alert for a holding.',
  parameters: {
    type: 'object',
    properties: {
      holdingId: { type: 'string' },
      rule: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['price_above', 'price_below'] },
          price: { type: 'number' },
          currency: { type: 'string', enum: ['USD', 'EUR'] }
        },
        required: ['type', 'price'],
        additionalProperties: false
      }
    },
    required: ['holdingId', 'rule'],
    additionalProperties: false
  },
  schema: setAlertSchema,
  async execute(input) {
    const repo = getRepository();
    try {
      const id = await repo.createPriceAlert({ holdingId: input.holdingId, rule: input.rule });
      const alerts = await repo.getPriceAlerts(input.holdingId);
      return {
        success: true,
        data: { alertId: id, alerts },
        data_provenance: ['repository:createPriceAlert', 'repository:getPriceAlerts']
      } satisfies ToolExecutionSuccess;
    } catch (error: any) {
      return {
        success: false,
        error: error?.message ?? 'Failed to create price alert.',
        data_provenance: ['repository:createPriceAlert']
      } satisfies ToolExecutionFailure;
    }
  }
});

const openResearchSchema = z.object({
  subject_id: z.string().min(1).describe('The holding ID or sector name to research'),
  subject_type: z.enum(['holding', 'sector']).default('holding').describe('Type of subject to research')
});

const openResearchTool = defineTool({
  name: 'open_research',
  description: 'Generate a comprehensive AI-powered investment research report for a holding or sector. The report includes financial analysis, market position, risks, opportunities, and sources.',
  parameters: {
    type: 'object',
    properties: {
      subject_id: {
        type: 'string',
        description: 'The holding ID (from get_holdings) or sector name to research'
      },
      subject_type: {
        type: 'string',
        enum: ['holding', 'sector'],
        description: 'Type of subject: holding (for individual stocks/assets) or sector (for industry analysis)',
        default: 'holding'
      }
    },
    required: ['subject_id']
  },
  schema: openResearchSchema,
  async execute(input) {
    const repo = getRepository();
    const provenance = ['local-db', 'edgar-api', 'research-engine'];

    try {
      if (input.subject_type === 'holding') {
        // Get holding details
        const holdings = await repo.getHoldings({ includeDeleted: false });
        const holding = holdings.find((h) => h.id === input.subject_id);

        if (!holding) {
          return {
            success: false,
            error: `Holding not found: ${input.subject_id}`,
            data_provenance: provenance
          };
        }

        // Generate research report
        const report = await generateResearchReport({
          subjectType: 'holding',
          subjectId: holding.id,
          holdingSymbol: holding.symbol,
          holdingName: holding.name,
          holdingType: holding.type,
          holdingCategoryId: holding.categoryId
        });

        if (!report) {
          return {
            success: false,
            error: 'Failed to generate research report. The AI service may be unavailable or the holding may not have sufficient public information.',
            data_provenance: provenance
          };
        }

        // Return preview with report ID
        const preview = report.sections[0]?.bodyMd?.substring(0, 200) || 'No preview available';

        return {
          success: true,
          data: {
            reportId: report.id,
            holdingName: holding.name,
            symbol: holding.symbol,
            sectionsCount: report.sections.length,
            sourcesCount: report.sources.length,
            preview: preview + '...',
            message: `Research report generated successfully for ${holding.name}. The report includes ${report.sections.length} sections and cites ${report.sources.length} sources. View the full report in the Holdings page or navigate to /research/${report.id}`
          },
          data_provenance: provenance
        };
      }

      // Sector research not yet implemented
      return {
        success: false,
        error: 'Sector research is not yet implemented. Please use subject_type="holding" to research individual holdings.',
        data_provenance: provenance
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message ?? 'Research report generation failed',
        data_provenance: provenance
      };
    }
  }
});

const searchResearchSchema = z.object({
  query: z.string().min(1).describe('Search query to find relevant information in research reports'),
  holding_id: z.string().optional().describe('Optional: Limit search to reports for a specific holding ID'),
  limit: z.number().int().positive().max(20).default(5).describe('Maximum number of relevant sections to return')
});

const searchResearchTool = defineTool({
  name: 'search_research',
  description: 'Search through all saved research reports to find relevant information. Returns matching sections with references to the source reports. Use this to answer questions about holdings that have been researched.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query - what information are you looking for? (e.g., "revenue growth", "competitive advantages", "risk factors")'
      },
      holding_id: {
        type: 'string',
        description: 'Optional: Limit search to reports about a specific holding'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of relevant sections to return (default: 5, max: 20)',
        default: 5
      }
    },
    required: ['query']
  },
  schema: searchResearchSchema,
  async execute(input) {
    const repo = getRepository();
    const provenance = ['local-db:researchReports'];

    try {
      // Get all research reports (or filtered by holding_id)
      const reports = await repo.getResearchReports({
        subjectKey: input.holding_id,
        limit: 100 // Get enough reports to search through
      });

      if (reports.length === 0) {
        return {
          success: true,
          data: {
            message: input.holding_id
              ? `No research reports found for holding ${input.holding_id}`
              : 'No research reports have been generated yet. Use open_research to generate a report first.',
            results: []
          },
          data_provenance: provenance
        };
      }

      // Simple keyword search through sections
      const queryLower = input.query.toLowerCase();
      const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);

      type SearchResult = {
        reportId: string;
        holdingName: string;
        sectionTitle: string;
        sectionContent: string;
        relevanceScore: number;
        sourceCount: number;
      };

      const results: SearchResult[] = [];

      for (const report of reports) {
        for (const section of report.sections) {
          const sectionTextLower = (section.title + ' ' + section.bodyMd).toLowerCase();

          // Calculate relevance score based on keyword matches
          let score = 0;
          for (const keyword of keywords) {
            const matches = (sectionTextLower.match(new RegExp(keyword, 'g')) || []).length;
            score += matches;
          }

          if (score > 0) {
            results.push({
              reportId: report.id,
              holdingName: report.subjectName,
              sectionTitle: section.title,
              sectionContent: section.bodyMd.substring(0, 500) + (section.bodyMd.length > 500 ? '...' : ''),
              relevanceScore: score,
              sourceCount: report.sources.length
            });
          }
        }
      }

      // Sort by relevance and limit
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const topResults = results.slice(0, input.limit);

      return {
        success: true,
        data: {
          message: `Found ${topResults.length} relevant sections across ${reports.length} research reports`,
          query: input.query,
          results: topResults.map(r => ({
            holding: r.holdingName,
            section: r.sectionTitle,
            content: r.sectionContent,
            reportLink: `/research/${r.reportId}`,
            relevance: r.relevanceScore
          }))
        },
        data_provenance: provenance
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message ?? 'Failed to search research reports',
        data_provenance: provenance
      };
    }
  }
});

const TOOL_DEFINITIONS = [
  portfolioSnapshotTool,
  holdingsTool,
  holdingDetailsTool,
  priceHistoryTool,
  whatIfTool,
  suggestRebalanceTool,
  addNoteTool,
  setAlertTool,
  openResearchTool,
  searchResearchTool
] as const;
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

