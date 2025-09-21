import { MarketDataProvider } from '../provider';

// Minimal CoinGecko adapter for crypto latest price.
// Uses /search to map symbol -> CoinGecko ID, then /simple/price for price and 24h change.
// Returns price in USD; UI can convert to EUR via FX utility.

const API_BASE = 'https://api.coingecko.com/api/v3';

// In-memory caches
const idCache = new Map<string, string>(); // SYMBOL -> id
const quoteCache = new Map<string, { at: number; data: any }>(); // id -> data
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`CoinGecko error ${res.status}`);
  return res.json();
}

async function mapSymbolToId(symbol: string, headers: Record<string, string>): Promise<string> {
  const sym = symbol.trim().toUpperCase();
  if (idCache.has(sym)) return idCache.get(sym)!;
  const data = await fetchJson(`${API_BASE}/search?query=${encodeURIComponent(sym)}`, { headers });
  const exact = (data?.coins || []).find((c: any) => (c.symbol || '').toUpperCase() === sym);
  const id = exact?.id || (data?.coins?.[0]?.id as string | undefined);
  if (!id) throw new Error('CoinGecko id not found');
  idCache.set(sym, id);
  return id;
}

export const coinGeckoProvider: MarketDataProvider = {
  async getQuote(symbol: string, type: 'stock' | 'crypto') {
    if (type !== 'crypto') throw new Error('coinGeckoProvider supports crypto only');
    if (!symbol) throw new Error('Missing crypto symbol');
    const key = import.meta.env.VITE_COINGECKO_API_KEY;
    const headers: Record<string, string> = {};
    if (key) {
      headers['x-cg-api-key'] = key;
      if (key.startsWith('CG-')) {
        headers['x-cg-demo-api-key'] = key;
      } else {
        headers['x-cg-pro-api-key'] = key;
      }
    }
    const id = await mapSymbolToId(symbol, headers);

    const cache = quoteCache.get(id);
    const now = Date.now();
    if (cache && now - cache.at < CACHE_TTL_MS) {
      const entry = cache.data[id];
      const price = Number(entry?.usd ?? entry?.eur);
      const currency = entry?.usd != null ? 'USD' : 'EUR';
      const pct = Number(entry?.usd_24h_change ?? entry?.eur_24h_change);
      return { price, currency, asOf: new Date().toISOString(), changePercent: isFinite(pct) ? pct : undefined, changeAbs: isFinite(pct) ? (price * pct) / 100 : undefined };
    }

    const url = `${API_BASE}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd,eur&include_24hr_change=true`;
    const data = await fetchJson(url, { headers });
    quoteCache.set(id, { at: now, data });
    const entry = data?.[id];
    if (!entry) throw new Error('Symbol not found on CoinGecko');
    const price = Number(entry.usd ?? entry.eur);
    const currency: 'USD' | 'EUR' = entry.usd != null ? 'USD' : 'EUR';
    const pct = Number(entry.usd_24h_change ?? entry.eur_24h_change);
    return { price, currency, asOf: new Date().toISOString(), changePercent: isFinite(pct) ? pct : undefined, changeAbs: isFinite(pct) ? (price * pct) / 100 : undefined };
  }
};


