import { NormalizedProviderInsight, HoldingNewsContext, ProviderFetchOptions } from "../types";

function parseAlphaDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isoLike = trimmed.replace(/\s+/g, " ");
  const direct = new Date(isoLike);
  if (!Number.isNaN(direct.getTime())) return direct;
  const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (compactMatch) {
    const [, y, m, d, hh, mm, ss] = compactMatch;
    const asIso = `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
    const parsed = new Date(asIso);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function buildSymbolMap(contexts: HoldingNewsContext[]): Map<string, HoldingNewsContext[]> {
  const map = new Map<string, HoldingNewsContext[]>();
  contexts.forEach((ctx) => {
    if (!ctx.symbol) return;
    const symbol = ctx.symbol.toUpperCase();
    if (!map.has(symbol)) {
      map.set(symbol, []);
    }
    map.get(symbol)!.push(ctx);
  });
  return map;
}

export async function fetchAlphaVantageNews(
  contexts: HoldingNewsContext[],
  options: ProviderFetchOptions
): Promise<NormalizedProviderInsight[]> {
  const { apiKey, windowHours, now, signal } = options;
  if (!apiKey || contexts.length === 0) return [];

  const symbols = Array.from(
    new Set(
      contexts
        .map((c) => c.symbol?.toUpperCase())
        .filter((value): value is string => Boolean(value))
    )
  );

  if (symbols.length === 0) return [];

  const tickers = symbols.slice(0, 10).join(",");
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", tickers);
  url.searchParams.set("sort", "RELEVANCE");
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), { signal });
    if (!response.ok) {
      console.warn("[insights][alphaVantage] request failed", response.status, await response.text());
      return [];
    }
    const payload = await response.json();
    const feed = Array.isArray(payload?.feed) ? payload.feed : [];
    if (feed.length === 0) {
      return [];
    }

    const symbolMap = buildSymbolMap(contexts);
    const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const seen = new Set<string>();
    const results: NormalizedProviderInsight[] = [];

    for (const item of feed) {
      const publishedAt = parseAlphaDate(item?.time_published);
      if (!publishedAt || publishedAt < windowStart) continue;

      const urlStr = typeof item?.url === "string" ? item.url : undefined;
      if (!urlStr) continue;
      if (seen.has(urlStr)) continue;

      const related: HoldingNewsContext[] = [];
      const tickerSentiment = Array.isArray(item?.ticker_sentiment) ? item.ticker_sentiment : [];
      tickerSentiment.forEach((entry: any) => {
        const ticker = typeof entry?.ticker === "string" ? entry.ticker.toUpperCase() : null;
        if (!ticker) return;
        const matches = symbolMap.get(ticker);
        if (!matches) return;
        matches.forEach((ctx) => {
          if (!related.some((r) => r.holdingId === ctx.holdingId)) {
            related.push(ctx);
          }
        });
      });

      const overallSentiment =
        typeof item?.overall_sentiment_score === "string"
          ? Number.parseFloat(item.overall_sentiment_score)
          : typeof item?.overall_sentiment_score === "number"
          ? item.overall_sentiment_score
          : undefined;

      const normalized: NormalizedProviderInsight = {
        id: urlStr,
        provider: "alpha_vantage",
        title: typeof item?.title === "string" ? item.title : "Untitled briefing",
        summary: typeof item?.summary === "string" ? item.summary : "",
        url: urlStr,
        publishedAt: publishedAt.toISOString(),
        type: "news",
        sentimentScore: Number.isFinite(overallSentiment as number) ? (overallSentiment as number) : undefined,
        relatedHoldings: related,
        raw: item
      };

      seen.add(urlStr);
      results.push(normalized);
    }

    return results;
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      return [];
    }
    console.warn("[insights][alphaVantage] fetch error", error);
    return [];
  }
}
