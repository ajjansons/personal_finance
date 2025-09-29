import type { FetchedSource } from '../types';

/**
 * Attempt to fetch investor relations pages and press releases
 * This uses common IR URL patterns and web search as fallback
 */
export async function fetchCompanyIRPages(
  symbol: string,
  companyName: string,
  limit = 3,
  signal?: AbortSignal
): Promise<FetchedSource[]> {
  const sources: FetchedSource[] = [];

  if (!symbol && !companyName) return sources;

  try {
    // Try common IR URL patterns
    const domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const commonPatterns = [
      `https://ir.${domain}.com`,
      `https://investors.${domain}.com`,
      `https://investor.${domain}.com`,
      `https://www.${domain}.com/investors`,
      `https://www.${domain}.com/investor-relations`
    ];

    // Check first pattern only (to avoid rate limiting)
    const urlToTry = commonPatterns[0];

    try {
      const response = await fetch(urlToTry, {
        signal,
        method: 'HEAD', // Use HEAD to just check if URL exists
        headers: {
          'User-Agent': 'Personal Finance Tracker'
        }
      });

      if (response.ok) {
        sources.push({
          title: `${companyName} Investor Relations`,
          url: urlToTry,
          type: 'ir_page',
          content: `Official investor relations page for ${companyName}. Contains press releases, financial reports, and corporate governance information.`,
          excerpt: 'Investor relations homepage'
        });
      }
    } catch (err) {
      // URL pattern didn't work, continue
    }

    // Add a generic search result suggestion
    if (sources.length === 0) {
      sources.push({
        title: `${companyName} Investor Relations`,
        url: `https://www.google.com/search?q=${encodeURIComponent(companyName + ' ' + symbol + ' investor relations')}`,
        type: 'ir_page',
        content: `Search for ${companyName} official investor relations page and recent press releases.`,
        excerpt: 'Investor relations search'
      });
    }

    // Add press release search
    sources.push({
      title: `${companyName} Recent Press Releases`,
      url: `https://www.google.com/search?q=${encodeURIComponent(companyName + ' ' + symbol + ' press release')}`,
      type: 'press_release',
      content: `Recent press releases from ${companyName} regarding product launches, partnerships, financial results, and corporate updates.`,
      excerpt: 'Press releases search'
    });

    return sources.slice(0, limit);
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return sources;
    }
    console.warn('[irPages] Fetch error:', error);
    return sources;
  }
}