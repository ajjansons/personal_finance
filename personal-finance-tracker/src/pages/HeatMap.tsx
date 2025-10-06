import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import { useHoldings } from '@/hooks/useHoldings';
import { useQuotes } from '@/hooks/useQuotes';
import { useUsdEurRate, convert } from '@/lib/fx/twelveDataFx';
import { useUIStore } from '@/lib/state/uiStore';
import { formatCurrency } from '@/lib/utils/date';
import type { AssetType, Holding } from '@/lib/repository/types';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';

/** ----------------------------------------------------------------
 *  Settings & Types
 *  ---------------------------------------------------------------- */
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
  name: string;
  fullName: string;
  displayName: string;
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
  name: string; // "Stocks" / "Crypto" (TradingView sector style)
  type?: AssetType;
  groupValue: number;
  groupValueLabel: string;
  children: HeatMapLeaf[];
};

const ORDERED_TYPES: AssetType[] = ['stock', 'crypto', 'cash', 'real_estate', 'other'];
const HEATMAP_TYPES: AssetType[] = ['stock', 'crypto']; // TradingView-style split

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

/** ----------------------------------------------------------------
 *  TradingView-like heatmap colors
 *  ---------------------------------------------------------------- */
const TV_GREEN = { r: 8, g: 153, b: 129 };      // #089981
const TV_RED = { r: 242, g: 54, b: 69 };        // #f23645
const TV_NEUTRAL = { r: 120, g: 123, b: 134 };  // #787b86

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const mix = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t)
});

const getHeatColor = (pct: number) => {
  if (!isFinite(pct)) return 'rgba(120,123,134,0.65)';
  const clamped = clamp(pct, -15, 15);
  if (clamped === 0) {
    const n = TV_NEUTRAL;
    return `rgb(${n.r}, ${n.g}, ${n.b})`;
  }
  if (clamped > 0) {
    const t = clamped / 15; // 0 -> neutral, 1 -> green
    const c = mix(TV_NEUTRAL, TV_GREEN, t);
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  const t = Math.abs(clamped) / 15; // 0 -> neutral, 1 -> red
  const c = mix(TV_NEUTRAL, TV_RED, t);
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
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

const truncateLabel = (value: string, maxChars: number) => {
  if (!value) return '';
  if (!Number.isFinite(maxChars) || maxChars <= 0) return value;
  if (value.length <= maxChars) return value;
  if (maxChars <= 3) return value.slice(0, maxChars);
  return `${value.slice(0, maxChars - 3).trimEnd()}...`;
};

/** ----------------------------------------------------------------
 *  Custom Treemap renderer - renders leaf nodes with adaptive labels
 *  ---------------------------------------------------------------- */
const TVTreemapTile = (props: any) => {
  const {
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    onMouseEnter,
    onMouseLeave,
    onMouseMove,
    clipPath
  } = props;

  const datum = props?.payload ?? props;

  // Check if this is a parent/root node with children
  const hasChildren = datum && Array.isArray(datum.children) && datum.children.length > 0;

  if (width <= 2 || height <= 2) return null;

  // Only skip rendering for nodes that have children (parent nodes)
  // But ALSO check: if it has children but ALSO has our leaf data (symbol, holdingId), render it anyway
  if (hasChildren && !datum.holdingId) return null;
  if (!datum) return null;

  // Extract data - Recharts may nest our data in different ways
  const safeChangePct = Number.isFinite(datum.changePct) ? datum.changePct : 0;
  const color = datum.color || getHeatColor(safeChangePct);
  const textColor = datum.textColor || getTextColor(color);
  // Center coordinates relative to the translated group (not absolute)
  const centerX = width / 2;
  const centerY = height / 2;
  const changeLabel = datum.changeLabel || formatChangeLabel(safeChangePct);
  const symbol = datum.symbol || '';
  const displayName = datum.displayName || datum.fullName || datum.name || symbol || '';


  const area = Math.max(width * height, 1);
  const base = Math.sqrt(area);
  const nameFontSize = clamp(Math.floor(base * 0.22), 6, 18);
  const changeFontSize = clamp(Math.floor(base * 0.18), 5, 12);

  // Show symbol if tile is large enough for readable text
  const showName = width >= 35 && height >= 20;
  // Always show change % if tile can fit it - prioritize this over symbol
  const showChange = width >= 20 && height >= 12;

  let nameLabel = displayName;
  if (showName) {
    const horizontalPadding = Math.max(nameFontSize * 0.5, 4);
    const approxCharWidth = Math.max(nameFontSize * 0.5, 1.5);
    const available = Math.max(width - horizontalPadding, approxCharWidth);
    const maxChars = Math.max(1, Math.floor(available / approxCharWidth));
    nameLabel = truncateLabel(displayName, maxChars);
  }

  return (
    <g clipPath={clipPath} transform={`translate(${x},${y})`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove}>
      <rect width={width} height={height} fill={color} stroke="rgba(15,23,42,0.35)" strokeWidth={1} rx={6} />
      {showName && nameLabel && (
        <text
          x={centerX}
          y={showChange ? centerY - changeFontSize * 0.6 : centerY}
          fill={textColor}
          fontSize={nameFontSize}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}
        >
          {nameLabel}
        </text>
      )}
      {showChange && (
        <text
          x={centerX}
          y={showName ? centerY + nameFontSize * 0.4 : centerY}
          fill={safeChangePct >= 0 ? '#dcfce7' : '#fee2e2'}
          fontSize={changeFontSize}
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ pointerEvents: 'none' }}
        >
          {changeLabel}
        </text>
      )}
    </g>
  );
};

/** ----------------------------------------------------------------
 *  Component
 *  ---------------------------------------------------------------- */
export default function HeatMap() {
  const { data: rawHoldings } = useHoldings();
  const holdings: Holding[] = rawHoldings || [];
  const { rate } = useUsdEurRate();
  const displayCurrency = useUIStore((s) => s.displayCurrency);
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [typeFilter, setTypeFilter] = useState<'all' | Extract<AssetType, 'stock' | 'crypto'>>('all');
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

  // Only show Stocks/Crypto like TradingView
  const availableTypes = useMemo(
    () => HEATMAP_TYPES.filter((type) => holdingsByType[type].length > 0),
    [holdingsByType]
  );

  // Universe shown on heatmap
  const filteredHoldings = useMemo(() => {
    const onlyTvTypes = enrichedHoldings.filter((h) => HEATMAP_TYPES.includes(h.type));
    if (typeFilter === 'all') return onlyTvTypes;

    const subset = holdingsByType[typeFilter];
    const selection = selections[typeFilter];
    if (selection.mode === 'all') return subset;
    if (selection.ids.length === 0) return [];
    const allowed = new Set(selection.ids);
    return subset.filter((h) => allowed.has(h.id));
  }, [enrichedHoldings, typeFilter, selections, holdingsByType]);

  const sortedHoldings = useMemo(
    () => [...filteredHoldings].sort((a, b) => getSizingValue(b) - getSizingValue(a)),
    [filteredHoldings]
  );

  const hasRenderableHoldings = useMemo(
    () => sortedHoldings.some((holding) => getSizingValue(holding) > 0),
    [sortedHoldings]
  );

  const { treeData } = useMemo(() => {
    if (!hasRenderableHoldings || sortedHoldings.length === 0) {
      return { treeData: [] as HeatMapGroup[] };
    }

    const makeLeaf = (holding: EnrichedHolding): HeatMapLeaf => {
      const changePct = isFinite(holding.changePct) ? holding.changePct : 0;
      const color = getHeatColor(changePct);
      const changeLabel = formatChangeLabel(changePct);
      const symbol = holding.symbol ? holding.symbol.toUpperCase() : undefined;
      const short = symbol || holding.name;

      return {
        id: holding.id,
        name: short,
        fullName: holding.name,
        displayName: short,
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
        ]
      };
    }

    const groups: HeatMapGroup[] = [];
    HEATMAP_TYPES.forEach((type) => {
      const nodes = sortedHoldings.filter((h) => h.type === type).map(makeLeaf);
      if (!nodes.length) return;
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
    return { treeData: groups };
  }, [sortedHoldings, groupMode, displayCurrency, hasRenderableHoldings]);
  const allLeaves = useMemo(() => treeData.flatMap((group) => group.children), [treeData]);

  const toggleHolding = useCallback(
    (type: AssetType, id: string, checked: boolean) => {
      const universe = holdingsByType[type];
      setSelections((prev) => {
        const current = prev[type];
        const base = current.mode === 'all'
          ? new Set(universe.map((holding) => holding.id))
          : new Set(current.ids);

        if (checked) base.add(id);
        else base.delete(id);

        if (base.size === universe.length) {
          return { ...prev, [type]: { mode: 'all', ids: [] } };
        }
        return { ...prev, [type]: { mode: 'custom', ids: Array.from(base) } };
      });
    },
    [holdingsByType]
  );

  const renderTooltip = useCallback(({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;
    const node = payload[0].payload as HeatMapLeaf;
    if (!node || !node.holdingId) return null;
    return (
      <div className="rounded-xl bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-lg border border-slate-700">
        <div className="font-semibold">{node.fullName}</div>
        {node.typeLabel && (
          <div className="text-xs text-slate-400 mb-1">{node.typeLabel}</div>
        )}
        <div className="mt-2 flex flex-col gap-1 text-xs">
          <span className="flex justify-between gap-4">
            <span className="text-slate-400">Symbol</span>
            <span>{node.symbol ?? '-'}</span>
          </span>
          <span className="flex justify-between gap-4">
            <span className="text-slate-400">Daily change</span>
            <span className={node.changePct >= 0 ? 'text-green-400' : 'text-red-400'}>
              {node.changeLabel}
            </span>
          </span>
          <span className="flex justify-between gap-4">
            <span className="text-slate-400">Value</span>
            <span>{node.valueLabel}</span>
          </span>
        </div>
      </div>
    );
  }, []);

  const renderTreemap = (nodes: HeatMapLeaf[]) => (
    <ResponsiveContainer width="100%" height="100%">
      <Treemap
        data={[{ name: "root", children: nodes }]}
        dataKey="size"
        stroke="rgba(15,23,42,0.35)"
        isAnimationActive={false}
        content={<TVTreemapTile />}
      >
        <Tooltip content={renderTooltip} wrapperStyle={{ outline: "none" }} />
      </Treemap>
    </ResponsiveContainer>
  );

  const overallGroup = treeData[0];
  const selectedType: AssetType | null = typeFilter === 'all' ? null : typeFilter;
  const holdingsForSelectedType = selectedType ? holdingsByType[selectedType] : [];
  const selectionState = selectedType ? selections[selectedType] : null;
  const allSelected = selectionState?.mode === 'all';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-100">Heat Map</h1>
        <p className="text-slate-400">TradingView-style heatmap: block size by position value, color by daily change.</p>
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
              <option value="type">Split into Stocks &amp; Crypto</option>
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
              onChange={(event) => setTypeFilter(event.target.value as 'all' | Extract<AssetType, 'stock' | 'crypto'>)}
            >
              <option value="all">Stocks + Crypto</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </Select>
          </div>

          <div className="hidden md:flex flex-col justify-end">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="h-2 w-28 rounded-full bg-gradient-to-r from-[#f23645] via-[#787b86] to-[#089981]" />
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
          {allLeaves.length > 0 ? (
            groupMode === 'type' ? (
              <div className="grid h-full gap-6 md:grid-cols-2">
                {treeData.map((group) => (
                  <div key={group.name} className="flex h-full flex-col gap-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Segment</p>
                        <p className="text-sm font-semibold text-slate-200">{group.name}</p>
                      </div>
                      <span className="text-xs text-slate-400">{group.groupValueLabel}</span>
                    </div>
                    <div className="flex-1 min-h-[260px] md:min-h-[320px]">
                      {renderTreemap(group.children)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              overallGroup ? (
                <div className="flex h-full flex-col gap-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Portfolio</p>
                      <p className="text-sm font-semibold text-slate-200">{overallGroup.name}</p>
                    </div>
                    <span className="text-xs text-slate-400">{overallGroup.groupValueLabel}</span>
                  </div>
                  <div className="flex-1 min-h-[320px]">
                    {renderTreemap(overallGroup.children)}
                  </div>
                </div>
              ) : null
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-900/30 text-center text-slate-400 space-y-2">
              <p className="text-sm">No holdings match the current filters.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
