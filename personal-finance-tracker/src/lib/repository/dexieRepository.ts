import { db } from '@/lib/db';
import { nanoid } from './nanoid';
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
  Transaction
} from './types';

const normalizeFiat = (code: string | undefined): 'USD' | 'EUR' => (code && code.toUpperCase() === 'USD') ? 'USD' : 'EUR';
const MODEL_PREFS_ID = 'global';

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
    const holdingCurrency = normalizeFiat((h.currency || '').toString());
    await db.holdings.put({
      ...h,
      id,
      // default purchaseDate to today if missing
      purchaseDate: (h as any).purchaseDate || today,
      buyValue: (h as any).buyValue ?? derivedBuy,
      buyValueCurrency: (h as any).buyValueCurrency ?? holdingCurrency,
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
    // Seed baseline transaction at purchase date
    const isAmount = h.type === 'cash' || h.type === 'real_estate';
    const baseDelta = isAmount ? ((h as any).buyValue ?? derivedBuy) : (h.units || 0);
    await db.transactions.put({
      id: nanoid('tx-'),
      holdingId: id,
      dateISO: (h as any).purchaseDate || today,
      deltaUnits: baseDelta,
      pricePerUnit: isAmount ? undefined : h.pricePerUnit
    } as any);
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
    await db.categories.put({
      ...c,
      id,
      depositCurrency: c.depositCurrency ? normalizeFiat(c.depositCurrency) : 'EUR'
    });
    return id;
  }
  async updateCategory(c: Category): Promise<void> {
    await db.categories.put({
      ...c,
      depositCurrency: c.depositCurrency ? normalizeFiat(c.depositCurrency) : 'EUR'
    });
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

  async addTransaction(t: Omit<Transaction, 'id'>): Promise<string> {
    const id = nanoid('tx-');
    await db.transactions.put({ ...t, id } as any);
    return id;
  }
  async getTransactions(holdingId: string): Promise<Transaction[]> {
    return db.transactions.where('holdingId').equals(holdingId).sortBy('dateISO') as any;
  }
  async getAllTransactions(): Promise<Transaction[]> {
    return db.transactions.orderBy('dateISO').toArray() as any;
  }

  async getModelPrefs(): Promise<ModelPrefs | null> {
    return (await db.modelPrefs.get(MODEL_PREFS_ID)) ?? null;
  }

  async setModelPrefs(prefs: ModelPrefs): Promise<void> {
    await db.modelPrefs.put({ ...prefs, id: MODEL_PREFS_ID });
  }

  async aiCacheGet(key: string): Promise<AiCacheEntry | undefined> {
    const entry = await db.aiCache.where('key').equals(key).first();
    if (!entry) return undefined;
    if (entry.ttlSec > 0) {
      const expires = Date.parse(entry.createdAt) + entry.ttlSec * 1000;
      if (Number.isFinite(expires) && expires <= Date.now()) {
        await db.aiCache.delete(entry.id);
        return undefined;
      }
    }
    return entry;
  }

  async aiCacheSet(entry: { key: string; value: unknown; ttlSec: number }): Promise<void> {
    const ttlSec = Number.isFinite(entry.ttlSec) && entry.ttlSec > 0 ? Math.floor(entry.ttlSec) : 0;
    const existing = await db.aiCache.where('key').equals(entry.key).first();
    const record: AiCacheEntry = {
      id: existing?.id ?? nanoid('cache-'),
      key: entry.key,
      value: entry.value,
      createdAt: new Date().toISOString(),
      ttlSec
    };
    await db.aiCache.put(record);
  }

  async aiCachePurgeExpired(): Promise<number> {
    const now = Date.now();
    const expiredKeys = await db.aiCache
      .filter((entry) => entry.ttlSec > 0 && (Date.parse(entry.createdAt) + entry.ttlSec * 1000) <= now)
      .primaryKeys();
    if (!expiredKeys.length) return 0;
    await db.aiCache.bulkDelete(expiredKeys as string[]);
    return expiredKeys.length;
  }
  async exportAll(): Promise<ExportBundle> {
    const [holdings, categories, pricePoints, modelPrefs, aiCache] = await Promise.all([
      db.holdings.toArray(),
      db.categories.toArray(),
      db.pricePoints.toArray(),
      db.modelPrefs.get(MODEL_PREFS_ID),
      db.aiCache.toArray()
    ]);
    const payload: ExportBundle = {
      holdings,
      categories,
      pricePoints,
      modelPrefs: modelPrefs ?? null,
      aiCache
    };
    return payload;
  }

  async importAll(payload: ImportBundle): Promise<void> {
    await db.transaction('rw', [db.holdings, db.categories, db.pricePoints, db.modelPrefs, db.aiCache], async () => {
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

      if (Object.prototype.hasOwnProperty.call(payload, 'modelPrefs')) {
        const prefs = payload.modelPrefs;
        if (prefs) {
          await db.modelPrefs.put({ ...prefs, id: MODEL_PREFS_ID });
        } else {
          await db.modelPrefs.delete(MODEL_PREFS_ID);
        }
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'aiCache')) {
        await db.aiCache.clear();
        if (payload.aiCache && payload.aiCache.length) {
          await db.aiCache.bulkPut(payload.aiCache as AiCacheEntry[]);
        }
      }
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
