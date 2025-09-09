import { MarketDataProvider } from '../provider';

export const DummyProvider: MarketDataProvider = {
  async getQuote(symbol, type) {
    // Phase 1: no network. Return a dummy constant.
    return { price: 0, currency: type === 'crypto' ? 'EUR' : 'EUR', asOf: new Date().toISOString() };
    // In Phase 2+ replace with real providers and caching.
  }
};

