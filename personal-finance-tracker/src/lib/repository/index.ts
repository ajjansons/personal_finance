import { PortfolioRepository } from './types';
import { DexiePortfolioRepository } from './dexieRepository';
import { CloudPortfolioRepository } from './cloudRepository';

let cached: PortfolioRepository | null = null;

export function getRepository(): PortfolioRepository {
  if (cached) return cached;
  const provider = (import.meta.env.VITE_STORAGE_PROVIDER || 'local') as 'local' | 'cloud';
  cached = provider === 'cloud' ? new CloudPortfolioRepository() : new DexiePortfolioRepository();
  return cached;
}

