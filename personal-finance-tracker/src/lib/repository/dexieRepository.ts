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
  Transaction,
  PriceAlert,
  PriceAlertCreate,
  InsightRecord,
  AiThread,
  AiMessage
} from './types';
import type { ResearchReport } from '@/features/research/types';

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
    const existing = await db.holdings.get(h.id);
    const updatedAt = new Date().toISOString();
    await db.holdings.put({ ...h, updatedAt });

    if (existing && existing.purchaseDate !== h.purchaseDate) {
      const transactions = await db.transactions.where('holdingId').equals(h.id).sortBy('dateISO');
      const baseline = transactions.find((tx) => tx.dateISO === existing.purchaseDate);
      if (baseline) {
        await db.transactions.put({ ...baseline, dateISO: h.purchaseDate });
      }

      const pricePoints = await db.pricePoints.where('holdingId').equals(h.id).sortBy('dateISO');
      const firstPrice = pricePoints.find((point) => point.dateISO === existing.purchaseDate);
      if (firstPrice) {
        await db.pricePoints.put({ ...firstPrice, dateISO: h.purchaseDate });
      }
    }
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

  async appendHoldingNote(holdingId: string, text: string): Promise<Holding> {
    const trimmed = (text ?? '').trim();
    if (!trimmed) {
      throw new Error('Note text is required.');
    }
    const holding = await db.holdings.get(holdingId);
    if (!holding) {
      throw new Error(`Holding ${holdingId} not found`);
    }
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${trimmed}`;
    const notes = holding.notes && holding.notes.trim().length
      ? `${holding.notes}\n${entry}`
      : entry;
    const updated: Holding = { ...holding, notes, updatedAt: timestamp };
    await db.holdings.put(updated);
    return updated;
  }

  async createPriceAlert(payload: PriceAlertCreate): Promise<string> {
    const id = nanoid('alert-');
    const record: PriceAlert = {
      id,
      holdingId: payload.holdingId,
      rule: payload.rule,
      createdAt: new Date().toISOString(),
    };
    await db.priceAlerts.put(record);
    return id;
  }

  async getPriceAlerts(holdingId?: string): Promise<PriceAlert[]> {
    if (holdingId) {
      return db.priceAlerts.where('holdingId').equals(holdingId).sortBy('createdAt');
    }
    return db.priceAlerts.orderBy('createdAt').toArray();
  }

  async deletePriceAlert(id: string): Promise<void> {
    await db.priceAlerts.delete(id);
  }
  async saveInsights(record: Omit<InsightRecord, 'id'>): Promise<string> {
    const id = nanoid('ins-');
    const created: InsightRecord = { ...record, id };
    await db.insights.put(created);
    return id;
  }

  async getInsights(opts?: { limit?: number }): Promise<InsightRecord[]> {
    const limit = opts?.limit ?? 5;
    const collection = db.insights.orderBy('createdAt').reverse();
    if (limit > 0) {
      return collection.limit(limit).toArray();
    }
    return collection.toArray();
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
    const [holdings, categories, pricePoints, modelPrefs, aiCache, insights, priceAlerts] = await Promise.all([
      db.holdings.toArray(),
      db.categories.toArray(),
      db.pricePoints.toArray(),
      db.modelPrefs.get(MODEL_PREFS_ID),
      db.aiCache.toArray(),
      db.insights.toArray(),
      db.priceAlerts.toArray()
    ]);
    const payload: ExportBundle = {
      holdings,
      categories,
      pricePoints,
      modelPrefs: modelPrefs ?? null,
      aiCache,
      insights,
      priceAlerts
    };
    return payload;
  }

  async importAll(payload: ImportBundle): Promise<void> {
    await db.transaction('rw', [db.holdings, db.categories, db.pricePoints, db.transactions, db.modelPrefs, db.aiCache, db.priceAlerts, db.insights], async () => {
      await db.holdings.clear();
      await db.categories.clear();
      await db.pricePoints.clear();
      await db.transactions.clear();
      await db.priceAlerts.clear();
      await db.insights.clear();
      const today = new Date().toISOString().slice(0, 10);
      const holdingsWithDate = payload.holdings.map((h) => ({
        ...h,
        purchaseDate: (h as any).purchaseDate || today
      }));
      await db.holdings.bulkPut(holdingsWithDate as any);
      await db.categories.bulkPut(payload.categories);
      await db.pricePoints.bulkPut(payload.pricePoints);

      // Recreate baseline transactions for imported holdings lacking entries
      const trxTable = db.transactions;
      for (const holding of holdingsWithDate) {
        const isAmount = holding.type === 'cash' || holding.type === 'real_estate';
        const baseAmount = typeof holding.buyValue === 'number' ? holding.buyValue : ((holding.units || 0) * (holding.pricePerUnit || 0));
        const deltaUnits = isAmount ? baseAmount : (holding.units || 0);
        await trxTable.put({
          id: nanoid('tx-'),
          holdingId: holding.id,
          dateISO: holding.purchaseDate,
          deltaUnits,
          pricePerUnit: isAmount ? undefined : holding.pricePerUnit
        } as any);
      }

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

      if (payload.insights && payload.insights.length) {
        await db.insights.bulkPut(payload.insights as InsightRecord[]);
      }
      if (payload.priceAlerts && payload.priceAlerts.length) {
        await db.priceAlerts.bulkPut(payload.priceAlerts as PriceAlert[]);
      }
    });
  }

  async saveResearchReport(report: Omit<ResearchReport, 'id'>): Promise<string> {
    const id = nanoid('res-');
    await db.researchReports.put({ ...report, id } as ResearchReport);
    return id;
  }

  async getResearchReport(id: string): Promise<ResearchReport | null> {
    const report = await db.researchReports.get(id);
    return report || null;
  }

  async getResearchReports(opts?: {
    subjectKey?: string;
    subjectType?: 'holding' | 'sector';
    limit?: number;
  }): Promise<ResearchReport[]> {
    let collection = db.researchReports.orderBy('createdAt').reverse();

    if (opts?.subjectKey) {
      collection = db.researchReports.where('subjectKey').equals(opts.subjectKey).reverse();
    } else if (opts?.subjectType) {
      collection = db.researchReports.where('subjectType').equals(opts.subjectType).reverse();
    }

    if (opts?.limit) {
      return await collection.limit(opts.limit).toArray();
    }

    return await collection.toArray();
  }

  async deleteResearchReport(id: string): Promise<void> {
    await db.researchReports.delete(id);
  }

  // Chat Threads
  async createThread(thread: Omit<AiThread, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = nanoid('thread-');
    const now = new Date().toISOString();
    await db.aiThreads.put({ ...thread, id, createdAt: now, updatedAt: now } as AiThread);
    return id;
  }

  async getThread(id: string): Promise<AiThread | null> {
    const thread = await db.aiThreads.get(id);
    return thread || null;
  }

  async getThreads(opts?: { pageRoute?: string; limit?: number }): Promise<AiThread[]> {
    let collection = db.aiThreads.orderBy('updatedAt').reverse();

    if (opts?.pageRoute) {
      collection = db.aiThreads.where('pageRoute').equals(opts.pageRoute).reverse();
    }

    if (opts?.limit) {
      return await collection.limit(opts.limit).toArray();
    }

    return await collection.toArray();
  }

  async updateThread(id: string, updates: Partial<Omit<AiThread, 'id' | 'createdAt'>>): Promise<void> {
    const existing = await db.aiThreads.get(id);
    if (!existing) return;

    const updatedAt = new Date().toISOString();
    await db.aiThreads.put({ ...existing, ...updates, id, updatedAt });
  }

  async deleteThread(id: string): Promise<void> {
    await db.transaction('rw', [db.aiThreads, db.aiMessages], async () => {
      await db.aiThreads.delete(id);
      await db.aiMessages.where('threadId').equals(id).delete();
    });
  }

  // Chat Messages
  async addMessage(message: Omit<AiMessage, 'id' | 'createdAt'>): Promise<string> {
    const id = nanoid('msg-');
    const createdAt = new Date().toISOString();
    await db.aiMessages.put({ ...message, id, createdAt } as AiMessage);

    // Update thread's updatedAt timestamp
    await this.updateThread(message.threadId, {});

    return id;
  }

  async getMessages(threadId: string): Promise<AiMessage[]> {
    return await db.aiMessages.where('threadId').equals(threadId).sortBy('createdAt');
  }

  async deleteMessages(threadId: string): Promise<void> {
    await db.aiMessages.where('threadId').equals(threadId).delete();
  }

  async clearAll(): Promise<void> {
    await db.transaction('rw', [db.holdings, db.categories, db.pricePoints, db.transactions, db.priceAlerts, db.insights, db.researchReports, db.aiThreads, db.aiMessages], async () => {
      await db.holdings.clear();
      await db.categories.clear();
      await db.pricePoints.clear();
      await db.transactions.clear();
      await db.priceAlerts.clear();
      await db.insights.clear();
      await db.researchReports.clear();
      await db.aiThreads.clear();
      await db.aiMessages.clear();
    });
  }
}





