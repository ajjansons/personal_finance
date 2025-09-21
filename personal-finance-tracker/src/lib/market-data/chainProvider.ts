import { MarketDataProvider } from './provider';
import { coinGeckoProvider } from './adapters/coingecko';
import { twelveDataProvider } from './adapters/twelvedata';

export const chainProvider: MarketDataProvider = {
  async getQuote(symbol, type) {
    if (type === 'crypto') return coinGeckoProvider.getQuote(symbol, type);
    if (type === 'stock') return twelveDataProvider.getQuote(symbol, type);
    // other types unsupported for live prices; fall back to 0
    return { price: 0, currency: 'EUR', asOf: new Date().toISOString() };
  }
};

