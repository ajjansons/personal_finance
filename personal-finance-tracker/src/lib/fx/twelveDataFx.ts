import { useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = 'https://api.twelvedata.com';

export type UsdEurRate = {
  rate: number; // USD -> EUR
  asOf: string;
};

async function fetchUsdEur(): Promise<UsdEurRate> {
  const key = import.meta.env.VITE_TWELVE_DATA_KEY;
  if (!key) throw new Error('Missing Twelve Data API key');
  // Prefer currency_conversion for 1 USD -> EUR
  const url1 = `${API_BASE}/currency_conversion?symbol=USD/EUR&amount=1&apikey=${encodeURIComponent(key)}`;
  let res = await fetch(url1);
  if (res.ok) {
    const data = await res.json();
    const rate = Number((data as any)?.result);
    if (isFinite(rate) && rate > 0) return { rate, asOf: new Date().toISOString() };
  }
  // Fallback to exchange_rate
  const url2 = `${API_BASE}/exchange_rate?symbol=USD/EUR&apikey=${encodeURIComponent(key)}`;
  res = await fetch(url2);
  if (!res.ok) throw new Error(`TwelveData FX error ${res.status}`);
  const data2 = await res.json();
  const rate2 = Number((data2 as any)?.rate);
  if (!isFinite(rate2) || rate2 <= 0) throw new Error('Invalid FX rate');
  return { rate: rate2, asOf: new Date().toISOString() };
}

export function useUsdEurRate() {
  const qc = useQueryClient();
  const q = useQuery<UsdEurRate>({
    queryKey: ['fx', 'USD_EUR'],
    queryFn: fetchUsdEur,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1
  });
  return {
    rate: q.data?.rate ?? 1,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    invalidate: () => qc.invalidateQueries({ queryKey: ['fx', 'USD_EUR'] })
  };
}

export function convert(amount: number, from: 'USD' | 'EUR', to: 'USD' | 'EUR', usdToEurRate: number) {
  if (!isFinite(amount)) return 0;
  if (from === to) return amount;
  if (!usdToEurRate || usdToEurRate <= 0) return amount; // fallback: no conversion if bad rate
  // from USD to EUR
  if (from === 'USD' && to === 'EUR') return amount * usdToEurRate;
  // from EUR to USD
  if (from === 'EUR' && to === 'USD') return amount / usdToEurRate;
  return amount;
}
