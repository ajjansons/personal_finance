export interface MarketDataProvider {
  getQuote(symbol: string, type: 'stock' | 'crypto'): Promise<{ price: number; currency: string; asOf: string }>;
}

