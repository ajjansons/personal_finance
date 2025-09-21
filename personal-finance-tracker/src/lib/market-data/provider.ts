export interface MarketDataProvider {
  getQuote(
    symbol: string,
    type: 'stock' | 'crypto'
  ): Promise<{ price: number; currency: 'USD' | 'EUR'; asOf: string; changePercent?: number; changeAbs?: number }>;
}
