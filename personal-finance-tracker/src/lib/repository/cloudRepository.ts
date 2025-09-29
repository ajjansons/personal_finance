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
  PricePointCreate,
  PriceAlert,
  PriceAlertCreate,
  InsightRecord
} from './types';
import type { ResearchReport } from '@/features/research/types';

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

  appendHoldingNote(_holdingId: string, _text: string): Promise<Holding> { this.notImplemented(); return Promise.resolve({} as Holding); }

  createPriceAlert(_payload: PriceAlertCreate): Promise<string> { this.notImplemented(); return Promise.resolve(''); }
  getPriceAlerts(_holdingId?: string): Promise<PriceAlert[]> { this.notImplemented(); return Promise.resolve([]); }
  deletePriceAlert(_id: string): Promise<void> { this.notImplemented(); return Promise.resolve(); }
  saveInsights(_record: Omit<InsightRecord, 'id'>): Promise<string> { this.notImplemented(); return Promise.resolve(''); }
  getInsights(_opts?: { limit?: number }): Promise<InsightRecord[]> { this.notImplemented(); return Promise.resolve([]); }

  saveResearchReport(_report: Omit<ResearchReport, 'id'>): Promise<string> { this.notImplemented(); return Promise.resolve(''); }
  getResearchReport(_id: string): Promise<ResearchReport | null> { this.notImplemented(); return Promise.resolve(null); }
  getResearchReports(_opts?: { subjectKey?: string; subjectType?: 'holding' | 'sector'; limit?: number }): Promise<ResearchReport[]> { this.notImplemented(); return Promise.resolve([]); }
  deleteResearchReport(_id: string): Promise<void> { this.notImplemented(); return Promise.resolve(); }

  exportAll(): Promise<ExportBundle> {
    this.notImplemented(); return Promise.resolve({ holdings: [], categories: [], pricePoints: [], modelPrefs: null, aiCache: [], priceAlerts: [], insights: [] });
  }
  importAll(_payload: ImportBundle): Promise<void> {
    this.notImplemented(); return Promise.resolve();
  }
  clearAll(): Promise<void> { this.notImplemented(); return Promise.resolve(); }
}



