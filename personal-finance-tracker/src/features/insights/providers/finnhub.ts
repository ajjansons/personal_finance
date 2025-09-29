import { NormalizedProviderInsight, HoldingNewsContext, ProviderFetchOptions } from "../types";

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extract basic sentiment from text using keyword analysis
 * Returns a score from -1 (very negative) to +1 (very positive)
 */
function extractBasicSentiment(headline: string, summary: string): number | undefined {
  const text = `${headline} ${summary}`.toLowerCase();

  const positiveKeywords = [
    'surge', 'soar', 'gain', 'profit', 'beat', 'exceed', 'strong', 'growth',
    'launch', 'partner', 'acquire', 'expand', 'approve', 'upgrade', 'breakthrough'
  ];

  const negativeKeywords = [
    'drop', 'fall', 'plunge', 'loss', 'miss', 'weak', 'decline', 'lawsuit',
    'investigation', 'layoff', 'downgrade', 'warning', 'concern', 'delay', 'fraud'
  ];

  let positiveCount = 0;
  let negativeCount = 0;

  positiveKeywords.forEach(keyword => {
    if (text.includes(keyword)) positiveCount++;
  });

  negativeKeywords.forEach(keyword => {
    if (text.includes(keyword)) negativeCount++;
  });

  const total = positiveCount + negativeCount;
  if (total === 0) return undefined;

  // Calculate a rough sentiment score
  const score = (positiveCount - negativeCount) / Math.max(total, 1);

  // Scale to be more moderate (-0.8 to +0.8 range)
  return score * 0.8;
}

export async function fetchFinnhubNews(
  contexts: HoldingNewsContext[],
  options: ProviderFetchOptions
): Promise<NormalizedProviderInsight[]> {
  const { apiKey, windowHours, now, signal } = options;
  if (!apiKey || contexts.length === 0) return [];

  const symbols = Array.from(
    new Set(
      contexts
        .map((ctx) => ctx.symbol?.toUpperCase())
        .filter((symbol): symbol is string => Boolean(symbol))
    )
  ).slice(0, 10);

  if (symbols.length === 0) return [];

  const fromDate = formatDate(new Date(now.getTime() - windowHours * 60 * 60 * 1000));
  const toDate = formatDate(now);

  const symbolMap = new Map<string, HoldingNewsContext[]>();
  contexts.forEach((ctx) => {
    if (!ctx.symbol) return;
    const key = ctx.symbol.toUpperCase();
    if (!symbolMap.has(key)) symbolMap.set(key, []);
    symbolMap.get(key)!.push(ctx);
  });

  const results: NormalizedProviderInsight[] = [];
  const seen = new Set<string>();

  for (const symbol of symbols) {
    const url = new URL("https://finnhub.io/api/v1/company-news");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("from", fromDate);
    url.searchParams.set("to", toDate);
    url.searchParams.set("token", apiKey);

    try {
      const response = await fetch(url.toString(), { signal });
      if (!response.ok) {
        console.warn("[insights][finnhub] request failed", symbol, response.status, await response.text());
        continue;
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) continue;

      payload.forEach((item: any) => {
        const urlStr = typeof item?.url === "string" ? item.url : undefined;
        if (!urlStr || seen.has(urlStr)) return;
        const headline = typeof item?.headline === "string" ? item.headline : undefined;
        if (!headline) return;
        const summary = typeof item?.summary === "string" ? item.summary : "";
        const timestamp = typeof item?.datetime === "number" ? item.datetime * 1000 : undefined;
        const published = timestamp ? new Date(timestamp) : undefined;
        if (!published) return;
        if (published < new Date(now.getTime() - windowHours * 60 * 60 * 1000)) return;

        const related = symbolMap.get(symbol) ?? [];

        // Extract basic sentiment from headline and summary
        const sentimentScore = extractBasicSentiment(headline, summary);

        const normalized: NormalizedProviderInsight = {
          id: urlStr,
          provider: "finnhub",
          title: headline,
          summary,
          url: urlStr,
          publishedAt: published.toISOString(),
          type: "news",
          sentimentScore,
          relatedHoldings: related,
          raw: item
        };

        seen.add(urlStr);
        results.push(normalized);
      });
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        break;
      }
      console.warn("[insights][finnhub] fetch error", symbol, error);
    }
  }

  return results;
}
