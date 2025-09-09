import {
  Category,
  CategoryCreate,
  Holding,
  HoldingCreate,
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

  exportAll(): Promise<{ holdings: Holding[]; categories: Category[]; pricePoints: PricePoint[] }> {
    this.notImplemented(); return Promise.resolve({ holdings: [], categories: [], pricePoints: [] });
  }
  importAll(_payload: { holdings: Holding[]; categories: Category[]; pricePoints: PricePoint[] }): Promise<void> {
    this.notImplemented(); return Promise.resolve();
  }
  clearAll(): Promise<void> { this.notImplemented(); return Promise.resolve(); }
}

