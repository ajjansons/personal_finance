import { MarketDataProvider } from '../provider';

const API_BASE = 'https://api.twelvedata.com';

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TwelveData error ${res.status}`);
  const data = await res.json();
  if ((data as any)?.status === 'error') throw new Error((data as any)?.message || 'TwelveData error');
  return data;
}

function toNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export const twelveDataProvider: MarketDataProvider = {
  async getQuote(symbol: string, type: 'stock' | 'crypto') {
    if (type !== 'stock') throw new Error('twelveDataProvider supports stock only');
    const key = import.meta.env.VITE_TWELVE_DATA_KEY;
    if (!key) throw new Error('Missing Twelve Data API key');
    const sym = encodeURIComponent(symbol);
    const url = `${API_BASE}/quote?symbol=${sym}&apikey=${encodeURIComponent(key)}`;
    const data: Record<string, unknown> = await fetchJson(url);

    const priceCandidate = [
      toNumber(data.price),
      toNumber(data.last),
      toNumber(data.last_price),
      toNumber(data.close),
      toNumber(data.previous_close),
      toNumber(data.open)
    ].find((v) => typeof v === 'number');

    if (priceCandidate == null) throw new Error('Invalid price');

    const changeAbs = toNumber(data.change);
    const changePercent = toNumber(data.percent_change);

    let asOf = new Date().toISOString();
    if (typeof data.last_quote_at === 'number') {
      asOf = new Date((data.last_quote_at as number) * 1000).toISOString();
    } else if (typeof data.datetime === 'string') {
      asOf = new Date(data.datetime as string).toISOString();
    }

    return {
      price: priceCandidate,
      currency: 'USD',
      asOf,
      changePercent: changePercent,
      changeAbs: changeAbs
    };
  }
};
