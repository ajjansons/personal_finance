import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import type { InsightAction, InsightItem, InsightRecord } from "@/lib/repository/types";

const IMPACT_STYLES: Record<InsightItem["impact"], string> = {
  positive: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  negative: "text-red-300 bg-red-500/10 border-red-500/30",
  neutral: "text-slate-300 bg-slate-600/10 border-slate-600/30",
  unclear: "text-amber-200 bg-amber-500/10 border-amber-500/30"
};

type InsightsCardProps = {
  record?: InsightRecord | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onAction?: (action: InsightAction, item: InsightItem) => Promise<void> | void;
  busyActionKey?: string | null;
};

function formatTimestamp(iso?: string) {
  if (!iso) return "Never";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatConfidence(value?: number) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(Number(value) * 100)}%`;
}

export default function InsightsCard({ record, isLoading, isRefreshing, onRefresh, onAction, busyActionKey }: InsightsCardProps) {
  const items = record?.items ?? [];
  const hasInsights = items.length > 0;

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Latest developments affecting your portfolio</h3>
          <p className="text-xs text-slate-500">Last run {formatTimestamp(record?.createdAt)}</p>
        </div>
        <Button onClick={onRefresh} disabled={isRefreshing} size="sm">
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {isLoading && !record && (
        <div className="text-sm text-slate-500">Fetching market context…</div>
      )}

      {!isLoading && !hasInsights && (
        <div className="text-sm text-slate-500">
          No recent news matched your holdings. Try expanding the lookback window or refresh later.
        </div>
      )}

      {hasInsights && (
        <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          {items.map((item) => {
            const itemKey = item.source.url || item.title;
            const impactClass = IMPACT_STYLES[item.impact];
            return (
              <div
                key={itemKey}
                className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={["rounded-full border px-2 py-0.5 text-xs font-semibold", impactClass].join(" ")}
                  >
                    {item.impact.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-500">Confidence {formatConfidence(item.confidence)}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <h4 className="text-sm font-semibold text-slate-100">{item.title}</h4>
                  <p className="text-sm text-slate-300">{item.summary}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <a className="text-emerald-300 hover:text-emerald-200" href={item.source.url} target="_blank" rel="noreferrer">
                    {item.source.name}
                  </a>
                  {item.holdingId && <span className="text-slate-400">Related holding</span>}
                </div>
                {item.actions && item.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.actions.map((action) => {
                      const actionKey = itemKey + "-" + action.action;
                      return (
                        <Button
                          key={actionKey}
                          size="sm"
                          variant="ghost"
                          disabled={busyActionKey === actionKey}
                          onClick={() => onAction?.(action, item)}
                        >
                          {busyActionKey === actionKey ? "Working…" : action.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
