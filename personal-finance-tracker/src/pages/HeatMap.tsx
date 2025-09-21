import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { useHoldings } from '@/hooks/useHoldings';
import { useQuotes } from '@/hooks/useQuotes';
import { useUsdEurRate, convert } from '@/lib/fx/twelveDataFx';
import { useUIStore } from '@/lib/state/uiStore';
import { formatCurrency } from '@/lib/utils/date';
import type { AssetType, Holding } from '@/lib/repository/types';
import { ResponsiveContainer, Treemap, Tooltip, Cell } from 'recharts';

type GroupMode = 'type' | 'all';

type SelectionEntry = { mode: 'all' | 'custom'; ids: string[] };
type SelectionMap = Record<AssetType, SelectionEntry>;

type EnrichedHolding = Holding & {
  displayValue: number;
  baseValue: number;
  changePct: number;
};

type HeatMapLeaf = {
  id: string;
  name: string; // label shown on the tile (symbol/name + daily change)
  fullName: string;
  symbol?: string;
  type: AssetType;
  holdingId: string;
  size: number;
  color: string;
  textColor: string;
  changeLabel: string;
  changePct: number;
  valueLabel: string;
  typeLabel: string;
};

type HeatMapGroup = {
  name: string;
  type?: AssetType;
  groupValue: number;
  groupValueLabel: string;
  children: HeatMapLeaf[];
};

const ORDERED_TYPES: AssetType[] = ['stock', 'crypto', 'cash', 'real_estate', 'other'];

const TYPE_LABEL: Record<AssetType, string> = {
  stock: 'Stocks',
  crypto: 'Crypto',
  cash: 'Cash',
  real_estate: 'Real Estate',
  other: 'Other'
};

const createInitialSelection = (): SelectionMap => ({
  stock: { mode: 'all', ids: [] },
  crypto: { mode: 'all', ids: [] },
  cash: { mode: 'all', ids: [] },
  real_estate: { mode: 'all', ids: [] },
  other: { mode: 'all', ids: [] }
});

const normalizeCurrency = (code?: string): 'USD' | 'EUR' =>
  code && code.toUpperCase() === 'USD' ? 'USD' : 'EUR';

const getHeatColor = (pct: number) => {
  if (!isFinite(pct)) return 'rgba(71,85,105,0.65)';
  const clamped = Math.max(-20, Math.min(20, pct));
  const ratio = (clamped + 20) / 40; // 0 -> red, 1 -> green
  const start = { r: 220, g: 38, b: 38 };
  const end = { r: 34, g: 197, b: 94 };
  const r = Math.round(start.r + (end.r - start.r) * ratio);
  const g = Math.round(start.g + (end.g - start.g) * ratio);
  const b = Math.round(start.b + (end.b - start.b) * ratio);
  return `rgb(${r}, ${g}, ${b})`;
};

const getTextColor = (rgb: string) => {
  const match = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(rgb);
  if (!match) return '#f8fafc';
  const [, rs, gs, bs] = match;
  const r = Number(rs);
  const g = Number(gs);
  const b = Number(bs);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 160 ? '#0f172a' : '#f8fafc';
};

const formatChangeLabel = (pct: number) => {
  if (!isFinite(pct)) return '+0.00%';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
};

const getSizingValue = (holding: EnrichedHolding) => {
  const displayMagnitude = Math.abs(holding.displayValue);
  if (Number.isFinite(displayMagnitude) && displayMagnitude > 0) return displayMagnitude;
  const baseMagnitude = Math.abs(holding.baseValue);
  if (Number.isFinite(baseMagnitude) && baseMagnitude > 0) return baseMagnitude;
  return 1;
};

export default function HeatMap() {
  const { data: rawHoldings } = useHoldings();
  const holdings: Holding[] = rawHoldings || [];
  const { rate } = useUsdEurRate();
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [typeFilter, setTypeFilter] = useState<'all' | AssetType>('all');
  const [selections, setSelections] = useState<SelectionMap>(() => createInitialSelection());

  const activeHoldings = useMemo(() => holdings.filter((h) => !h.isDeleted), [holdings]);
  const { quotes } = useQuotes(activeHoldings);

  const enrichedHoldings = useMemo<EnrichedHolding[]>(() => {
    return activeHoldings.map((holding) => {
      const holdingCurrency = normalizeCurrency(holding.currency);
      const key = `${holding.type}:${(holding.symbol || '').toUpperCase()}`;
      let baseValue = 0;

      if (holding.type === 'cash' || holding.type === 'real_estate') {
        const givenBuyValue = typeof (holding as any).buyValue === 'number' ? (holding as any).buyValue : null;
        const fallback = (holding.units || 0) * (holding.pricePerUnit || 0);
        baseValue = givenBuyValue != null && isFinite(givenBuyValue) ? givenBuyValue : fallback;
      } else {
        const units = holding.units || 0;
        const quote = quotes[key];
        let priceInHolding = holding.pricePerUnit || 0;
        if (quote && isFinite(quote.price)) {
          priceInHolding = quote.currency === holdingCurrency
            ? quote.price
            : convert(quote.price, quote.currency, holdingCurrency, rate);
        }
        baseValue = priceInHolding * units;
      }

      const displayValue = convert(baseValue, holdingCurrency, displayCurrency, rate);
      const quoteChange = quotes[key]?.changePercent;
      const changePct =
        holding.type === 'cash' || holding.type === 'real_estate'
          ? 0
          : (typeof quoteChange === 'number' && isFinite(quoteChange) ? quoteChange : 0);

      return {
        ...holding,
        displayValue,
        baseValue,
        changePct
      };
    });
  }, [activeHoldings, quotes, displayCurrency, rate]);

  const holdingsByType = useMemo<Record<AssetType, EnrichedHolding[]>>(() => {
    const map: Record<AssetType, EnrichedHolding[]> = {
      stock: [],
      crypto: [],
      cash: [],
      real_estate: [],
      other: []
    };
    enrichedHoldings.forEach((holding) => {
      map[holding.type].push(holding);
    });
    ORDERED_TYPES.forEach((type) => {
      map[type].sort((a, b) => getSizingValue(b) - getSizingValue(a));
    });
    return map;
  }, [enrichedHoldings]);

  useEffect(() => {
    if (typeFilter !== 'all' && holdingsByType[typeFilter].length === 0) {
      setTypeFilter('all');
    }
  }, [typeFilter, holdingsByType]);

  const availableTypes = useMemo(
    () => ORDERED_TYPES.filter((type) => holdingsByType[type].length > 0),
    [holdingsByType]
  );

  const filteredHoldings = useMemo(() => {
    if (typeFilter === 'all') return enrichedHoldings;
    const subset = holdingsByType[typeFilter];
    const selection = selections[typeFilter];
    if (selection.mode === 'all') return subset;
    if (selection.ids.length === 0) return [];
    const allowed = new Set(selection.ids);
    return subset.filter((holding) => allowed.has(holding.id));
  }, [enrichedHoldings, typeFilter, selections, holdingsByType]);

  const sortedHoldings = useMemo(
    () => [...filteredHoldings].sort((a, b) => getSizingValue(b) - getSizingValue(a)),
    [filteredHoldings]
  );

  const hasRenderableHoldings = useMemo(
    () => sortedHoldings.some((holding) => getSizingValue(holding) > 0),
    [sortedHoldings]
  );

  const { treeData, leaves } = useMemo(() => {
    if (!hasRenderableHoldings || sortedHoldings.length === 0) {
      return { treeData: [] as HeatMapGroup[], leaves: [] as HeatMapLeaf[] };
    }

    const makeLeaf = (holding: EnrichedHolding): HeatMapLeaf => {
      const changePct = isFinite(holding.changePct) ? holding.changePct : 0;
      const color = getHeatColor(changePct);
      const changeLabel = formatChangeLabel(changePct);
      const symbol = holding.symbol ? holding.symbol.toUpperCase() : undefined;
      const short = symbol || holding.name;
      return {
        id: holding.id,
        name: `${short} ${changeLabel}`,
        fullName: holding.name,
        symbol,
        type: holding.type,
        holdingId: holding.id,
        size: getSizingValue(holding),
        color,
        textColor: getTextColor(color),
        changeLabel,
        changePct,
        valueLabel: formatCurrency(Math.max(holding.displayValue, 0), displayCurrency),
        typeLabel: TYPE_LABEL[holding.type]
      };
    };

    if (groupMode === 'all') {
      const nodes = sortedHoldings.map(makeLeaf);
      return {
        treeData: [
          {
            name: 'All Holdings',
            type: undefined,
            groupValue: nodes.reduce((sum, leaf) => sum + leaf.size, 0),
            groupValueLabel: formatCurrency(
              nodes.reduce((sum, leaf) => sum + Math.max(leaf.size, 0), 0),
              displayCurrency
            ),
            children: nodes
          }
        ],
        leaves: nodes
      };
    }

    const groups: HeatMapGroup[] = [];
    const leafAccumulator: HeatMapLeaf[] = [];
    ORDERED_TYPES.forEach((type) => {
      const nodes = sortedHoldings
        .filter((holding) => holding.type === type)
        .map(makeLeaf);
      if (!nodes.length) return;
      leafAccumulator.push(...nodes);
      groups.push({
        name: TYPE_LABEL[type],
        type,
        groupValue: nodes.reduce((sum, leaf) => sum + leaf.size, 0),
        groupValueLabel: formatCurrency(
          nodes.reduce((sum, leaf) => sum + Math.max(leaf.size, 0), 0),
          displayCurrency
        ),
        children: nodes
      });
    });
    return { treeData: groups, leaves: leafAccumulator };
  }, [sortedHoldings, groupMode, displayCurrency, hasRenderableHoldings]);

  const toggleHolding = useCallback(
    (type: AssetType, id: string, checked: boolean) => {
      const universe = holdingsByType[type];
      setSelections((prev) => {
        const current = prev[type];
        const base = current.mode === 'all'
          ? new Set(universe.map((holding) => holding.id))
          : new Set(current.ids);

        if (checked) {
          base.add(id);
        } else {
          base.delete(id);
        }

        if (base.size === universe.length) {
          return { ...prev, [type]: { mode: 'all', ids: [] } };
        }

        return { ...prev, [type]: { mode: 'custom', ids: Array.from(base) } };
      });
    },
    [holdingsByType]
  );

  const selectedType: AssetType | null = typeFilter === 'all' ? null : typeFilter;
  const holdingsForSelectedType = selectedType ? holdingsByType[selectedType] : [];
  const selectionState = selectedType ? selections[selectedType] : null;
  const allSelected = selectionState?.mode === 'all';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-100">Heat Map</h1>
        <p className="text-slate-400">
          Visualize portfolio performance with block sizes based on position value and colors based on daily change.
        </p>
      </div>

      <Card className="p-6 xl:p-8 space-y-6 xl:space-y-8 min-h-[640px]">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="group-mode">
              Group holdings
            </label>
            <Select
              id="group-mode"
              value={groupMode}
              onChange={(event) => setGroupMode(event.target.value as GroupMode)}
            >
              <option value="type">Group by type</option>
              <option value="all">All holdings together</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="type-filter">
              Type filter
            </label>
            <Select
              id="type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | AssetType)}
            >
              <option value="all">All types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </div>
          <div className="hidden md:flex flex-col justify-end">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-2 w-24 rounded-full bg-gradient-to-r from-red-500 via-slate-500 to-emerald-500" />
              <span>Daily % change</span>
            </div>
          </div>
        </div>

        {selectedType && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Holdings</p>
                <p className="text-sm font-semibold text-slate-200">{TYPE_LABEL[selectedType]}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!selectedType) return;
                    setSelections((prev) => ({ ...prev, [selectedType]: { mode: 'all', ids: [] } }));
                  }}
                  disabled={!selectedType || allSelected}
                >
                  Select all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!selectedType) return;
                    setSelections((prev) => ({ ...prev, [selectedType]: { mode: 'custom', ids: [] } }));
                  }}
                  disabled={!selectedType || (selectionState?.mode === 'custom' && selectionState.ids.length === 0)}
                >
                  Clear selection
                </Button>
              </div>
            </div>
            {holdingsForSelectedType.length > 0 ? (
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {holdingsForSelectedType.map((holding) => {
                  const checked = selectionState?.mode === 'all'
                    ? true
                    : selectionState?.ids.includes(holding.id) ?? false;
                  return (
                    <label
                      key={holding.id}
                      className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-900/40 px-3 py-2 transition-colors hover:border-slate-500/40"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-slate-100">{holding.name}</span>
                        {holding.symbol && (
                          <span className="text-xs uppercase text-slate-400">{holding.symbol}</span>
                        )}
                      </span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-blue-500 focus:ring-blue-400"
                        checked={checked}
                        onChange={(event) => toggleHolding(holding.type, holding.id, event.target.checked)}
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No holdings available for this type.</p>
            )}
          </div>
        )}

        <div className="min-h-[520px] h-[640px] xl:h-[720px]">
          {treeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={treeData}
                dataKey="size"
                stroke="rgba(15,23,42,0.35)"
                animationDuration={400}
              >
                {leaves.map((leaf) => (
                  <Cell key={leaf.holdingId} fill={leaf.color} />
                ))}
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload[0]) return null;
                    const data = payload[0].payload as HeatMapLeaf;
                    if (!data || !data.holdingId) return null;
                    return (
                      <div className="rounded-xl bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-lg border border-slate-700">
                        <div className="font-semibold">{data.fullName}</div>
                        {data.typeLabel && (
                          <div className="text-xs text-slate-400 mb-1">{data.typeLabel}</div>
                        )}
                        <div className="mt-2 flex flex-col gap-1 text-xs">
                          <span className="flex justify-between gap-4">
                            <span className="text-slate-400">Symbol</span>
                            <span>{data.symbol ?? '—'}</span>
                          </span>
                          <span className="flex justify-between gap-4">
                            <span className="text-slate-400">Daily change</span>
                            <span className={data.changePct >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {data.changeLabel}
                            </span>
                          </span>
                          <span className="flex justify-between gap-4">
                            <span className="text-slate-400">Value</span>
                            <span>{data.valueLabel}</span>
                          </span>
                        </div>
                      </div>
                    );
                  }}
                  wrapperStyle={{ outline: 'none' }}
                />
              </Treemap>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 text-center text-slate-400 space-y-2">
              <p className="text-sm">No holdings match the current filters.</p>
              {activeHoldings.length > 0 ? (
                <p className="text-xs text-slate-500">Try adjusting your filters or selections above.</p>
              ) : (
                <p className="text-xs text-slate-500">Add holdings to your portfolio to populate the heat map.</p>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
