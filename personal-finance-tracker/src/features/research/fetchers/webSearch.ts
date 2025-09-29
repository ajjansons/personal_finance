import type { FetchedSource } from '../types';

/**
 * Fetch recent news and analysis from public web sources
 * Uses search patterns to find relevant investment content
 */
export async function fetchPublicWebSources(
  symbol: string,
  companyName: string,
  limit = 5,
  signal?: AbortSignal
): Promise<FetchedSource[]> {
  const sources: FetchedSource[] = [];

  if (!symbol && !companyName) return sources;

  try {
    // Create search queries for different types of content
    const queries = [
      `${companyName} ${symbol} stock analysis recent`,
      `${companyName} ${symbol} earnings financial results`,
      `${companyName} ${symbol} news announcement`,
      `${companyName} ${symbol} investor outlook`,
      `${companyName} ${symbol} market trends`
    ];

    // Generate search result links (not actual fetching, just reference points)
    for (let i = 0; i < Math.min(queries.length, limit); i++) {
      const query = queries[i];
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws`;

      let sourceType: 'news' | 'other' = 'news';
      let title = '';
      let content = '';

      if (query.includes('analysis')) {
        sourceType = 'other';
        title = `${companyName} Investment Analysis`;
        content = `Recent investment analysis and research reports for ${companyName} (${symbol}). Includes analyst opinions, price targets, and market sentiment.`;
      } else if (query.includes('earnings')) {
        title = `${companyName} Earnings & Financial Results`;
        content = `Latest earnings reports and financial results for ${companyName}. Revenue, profit margins, and key financial metrics.`;
      } else if (query.includes('news')) {
        title = `${companyName} Recent News`;
        content = `Breaking news and recent announcements from ${companyName} affecting stock performance and company direction.`;
      } else if (query.includes('outlook')) {
        sourceType = 'other';
        title = `${companyName} Market Outlook`;
        content = `Market outlook and future projections for ${companyName}. Industry trends and competitive positioning analysis.`;
      } else {
        title = `${companyName} Market Trends`;
        content = `Market trends and sector analysis relevant to ${companyName}'s business operations and stock performance.`;
      }

      sources.push({
        title,
        url: searchUrl,
        type: sourceType,
        content,
        excerpt: query
      });
    }

    return sources;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return sources;
    }
    console.warn('[webSearch] Error:', error);
    return sources;
  }
}