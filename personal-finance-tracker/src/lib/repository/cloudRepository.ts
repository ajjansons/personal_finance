import {
  Category,
  CategoryCreate,
  Holding,
  HoldingCreate,
  ModelPrefs,
  AiCacheEntry,
  ExportBundle,
  ImportBundle,
  PortfolioRepository,
  PricePoint,
  PricePointCreate
} from './types';

export class CloudPortfolioRepository implements PortfolioRepository {
  private notImplemented() {
    throw new Error('Cloud storage is not implemented in Phase 1.');
  }
  getHoldings(): Promise<Holding[]> { this.notImplemented(); return Promise.resolve([]); }
  createHolding(_h: HoldingCreate): Promise<string> { this.notImplemented(); return Promise.resolve(''); }
  updateHolding(_h: Holding): Promise<void> { this.notImplemented(); return Promise.resolve(); }
  softDeleteHolding(_id: string): Promise<void> { this.notImplemented(); return Promise.resolve(); }

  getCategories(): Promise<Category[]> { this.notImplemented(); return Promise.resolve([]); }
  createCategory(_c: CategoryCreate): Promise<string> { this.notImplemented(); return Promise.resolve(''); }
  updateCategory(_c: Category): Promise<void> { this.notImplemented(); return Promise.resolve(); }
  deleteCategory(_id: string): Promise<void> { this.notImplemented(); return Promise.resolve(); }

  addPricePoint(_p: PricePointCreate): Promise<string> { this.notImplemented(); return Promise.resolve(''); }
  getPriceHistory(_holdingId: string): Promise<PricePoint[]> { this.notImplemented(); return Promise.resolve([]); }
  getAllPricePoints(): Promise<PricePoint[]> { this.notImplemented(); return Promise.resolve([]); }
  addTransaction(_t: any): Promise<string> { this.notImplemented(); return Promise.resolve(''); }
  getTransactions(_holdingId: string): Promise<any[]> { this.notImplemented(); return Promise.resolve([]); }
  getAllTransactions(): Promise<any[]> { this.notImplemented(); return Promise.resolve([]); }

  getModelPrefs(): Promise<ModelPrefs | null> { this.notImplemented(); return Promise.resolve(null); }
  setModelPrefs(_prefs: ModelPrefs): Promise<void> { this.notImplemented(); return Promise.resolve(); }

  aiCacheGet(_key: string): Promise<AiCacheEntry | undefined> { this.notImplemented(); return Promise.resolve(undefined); }
  aiCacheSet(_entry: { key: string; value: unknown; ttlSec: number }): Promise<void> { this.notImplemented(); return Promise.resolve(); }
  aiCachePurgeExpired(): Promise<number> { this.notImplemented(); return Promise.resolve(0); }


  exportAll(): Promise<ExportBundle> {
    this.notImplemented(); return Promise.resolve({ holdings: [], categories: [], pricePoints: [], modelPrefs: null, aiCache: [] });
  }
  importAll(_payload: ImportBundle): Promise<void> {
    this.notImplemented(); return Promise.resolve();
  }
  clearAll(): Promise<void> { this.notImplemented(); return Promise.resolve(); }
}

