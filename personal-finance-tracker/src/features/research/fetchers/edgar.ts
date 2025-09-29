import type { FetchedSource } from '../types';

/**
 * Fetch recent SEC EDGAR filings for a given stock symbol
 * Uses the SEC EDGAR API: https://data.sec.gov/
 */
export async function fetchEDGARFilings(
  symbol: string,
  limit = 5,
  signal?: AbortSignal
): Promise<FetchedSource[]> {
  if (!symbol) return [];

  try {
    // First, we need to get the CIK (Central Index Key) for the symbol
    // SEC provides a company tickers JSON endpoint
    const tickersUrl = 'https://www.sec.gov/files/company_tickers.json';
    const tickersResponse = await fetch(tickersUrl, {
      signal,
      headers: {
        'User-Agent': 'Personal Finance Tracker (educational use)',
        'Accept': 'application/json'
      }
    });

    if (!tickersResponse.ok) {
      console.warn('[edgar] Failed to fetch company tickers', tickersResponse.status);
      return [];
    }

    const tickers = await tickersResponse.json();

    // Find the CIK for our symbol
    let cik: string | null = null;
    for (const key in tickers) {
      const company = tickers[key];
      if (company.ticker?.toUpperCase() === symbol.toUpperCase()) {
        // CIK needs to be padded to 10 digits
        cik = String(company.cik_str).padStart(10, '0');
        break;
      }
    }

    if (!cik) {
      console.info('[edgar] No CIK found for symbol:', symbol);
      return [];
    }

    // Now fetch the company's recent filings
    const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;
    const submissionsResponse = await fetch(submissionsUrl, {
      signal,
      headers: {
        'User-Agent': 'Personal Finance Tracker (educational use)',
        'Accept': 'application/json'
      }
    });

    if (!submissionsResponse.ok) {
      console.warn('[edgar] Failed to fetch submissions for CIK', cik, submissionsResponse.status);
      return [];
    }

    const submissions = await submissionsResponse.json();
    const filings = submissions.filings?.recent;

    if (!filings || !Array.isArray(filings.form)) {
      return [];
    }

    const sources: FetchedSource[] = [];
    const relevantForms = ['10-K', '10-Q', '8-K', 'DEF 14A'];

    for (let i = 0; i < filings.form.length && sources.length < limit; i++) {
      const form = filings.form[i];
      if (!relevantForms.includes(form)) continue;

      const filingDate = filings.filingDate?.[i];
      const accessionNumber = filings.accessionNumber?.[i];
      const primaryDocument = filings.primaryDocument?.[i];
      const description = filings.primaryDocDescription?.[i] || form;

      if (!accessionNumber || !filingDate) continue;

      // Construct the filing URL
      const accessionNumberClean = accessionNumber.replace(/-/g, '');
      const filingUrl = `https://www.sec.gov/Archives/edgar/data/${cik.replace(/^0+/, '')}/${accessionNumberClean}/${primaryDocument || accessionNumber + '.txt'}`;

      sources.push({
        title: `${form} Filing - ${filingDate}`,
        url: filingUrl,
        type: 'filing',
        content: `${description}. Filed on ${filingDate}.`,
        excerpt: `${form} filing dated ${filingDate}`
      });
    }

    return sources;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      return [];
    }
    console.warn('[edgar] Fetch error:', error);
    return [];
  }
}