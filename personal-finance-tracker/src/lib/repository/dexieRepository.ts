import { db } from '@/lib/db';
import { nanoid } from './nanoid';
import {
  Category,
  CategoryCreate,
  Holding,
  HoldingCreate,
  PortfolioRepository,
  PricePoint,
  PricePointCreate
} from './types';

export class DexiePortfolioRepository implements PortfolioRepository {
  async getHoldings(opts?: { includeDeleted?: boolean }): Promise<Holding[]> {
    const coll = db.holdings.orderBy('name');
    const arr = await coll.toArray();
    return (opts?.includeDeleted ? arr : arr.filter((h) => !h.isDeleted));
  }
  async createHolding(h: HoldingCreate): Promise<string> {
    const id = nanoid('h-');
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const derivedBuy = (h as any).buyValue ?? (h.units || 0) * (h.pricePerUnit || 0);
    await db.holdings.put({
      ...h,
      id,
      // default purchaseDate to today if missing
      purchaseDate: (h as any).purchaseDate || today,
      buyValue: (h as any).buyValue ?? derivedBuy,
      // For cash/real_estate, we keep current value aligned with amount; for others we rely on units*pricePerUnit.
      currentValue: (h.type === 'cash' || h.type === 'real_estate') ? ((h as any).currentValue ?? derivedBuy) : undefined,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    });
    // Also add price point for today
    await db.pricePoints.put({
      id: nanoid('pp-'),
      holdingId: id,
      dateISO: today,
      pricePerUnit: h.pricePerUnit
    });
    return id;
  }
  async updateHolding(h: Holding): Promise<void> {
    await db.holdings.put({ ...h, updatedAt: new Date().toISOString() });
  }
  async softDeleteHolding(id: string): Promise<void> {
    const h = await db.holdings.get(id);
    if (h) await db.holdings.put({ ...h, isDeleted: true, updatedAt: new Date().toISOString() });
  }

  async getCategories(): Promise<Category[]> {
    return db.categories.orderBy('sortOrder').toArray();
  }
  async createCategory(c: CategoryCreate): Promise<string> {
    const id = nanoid('c-');
    await db.categories.put({ ...c, id });
    return id;
  }
  async updateCategory(c: Category): Promise<void> {
    await db.categories.put(c);
  }
  async deleteCategory(id: string): Promise<void> {
    await db.categories.delete(id);
  }

  async addPricePoint(p: PricePointCreate): Promise<string> {
    const id = nanoid('pp-');
    await db.pricePoints.put({ ...p, id });
    // also reflect latest price on holding
    const h = await db.holdings.get(p.holdingId);
    if (h) {
      const updated: any = { ...h, pricePerUnit: p.pricePerUnit, updatedAt: new Date().toISOString() };
      // For cash/real_estate we mirror current value to amount; for others ignore currentValue to avoid staleness.
      if (h.type === 'cash' || h.type === 'real_estate') {
        updated.currentValue = (h.units || 0) * p.pricePerUnit;
      } else {
        updated.currentValue = undefined;
      }
      await db.holdings.put(updated);
    }
    return id;
  }
  async getPriceHistory(holdingId: string): Promise<PricePoint[]> {
    return db.pricePoints.where('holdingId').equals(holdingId).sortBy('dateISO');
  }
  async getAllPricePoints(): Promise<PricePoint[]> {
    return db.pricePoints.orderBy('dateISO').toArray();
  }

  async exportAll() {
    const [holdings, categories, pricePoints] = await Promise.all([
      db.holdings.toArray(),
      db.categories.toArray(),
      db.pricePoints.toArray()
    ]);
    return { holdings, categories, pricePoints };
  }

  async importAll(payload: { holdings: Holding[]; categories: Category[]; pricePoints: PricePoint[] }) {
    await db.transaction('rw', db.holdings, db.categories, db.pricePoints, async () => {
      await db.holdings.clear();
      await db.categories.clear();
      await db.pricePoints.clear();
      const today = new Date().toISOString().slice(0, 10);
      const holdingsWithDate = payload.holdings.map((h) => ({
        ...h,
        purchaseDate: (h as any).purchaseDate || today
      }));
      await db.holdings.bulkPut(holdingsWithDate as any);
      await db.categories.bulkPut(payload.categories);
      await db.pricePoints.bulkPut(payload.pricePoints);
    });
  }

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.holdings, db.categories, db.pricePoints, async () => {
      await db.holdings.clear();
      await db.categories.clear();
      await db.pricePoints.clear();
    });
  }
}
