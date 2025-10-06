import Dexie, { Table } from 'dexie';
import {
  AppMeta,
  Category,
  Holding,
  PricePoint,
  Transaction,
  ModelPrefs,
  AiCacheEntry,
  PriceAlert,
  InsightRecord,
  AiThread,
  AiMessage,
} from './repository/types';
import type { ResearchReport } from '@/features/research/types';
import { SCHEMA_VERSION } from './constants';

const normalizeFiat = (code: unknown): 'USD' | 'EUR' => (typeof code === 'string' && code.toUpperCase() === 'USD') ? 'USD' : 'EUR';

export class AppDB extends Dexie {
  holdings!: Table<Holding, string>;
  pricePoints!: Table<PricePoint, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  appMeta!: Table<AppMeta, string>;
  modelPrefs!: Table<ModelPrefs, string>;
  aiCache!: Table<AiCacheEntry, string>;
  priceAlerts!: Table<PriceAlert, string>;
  insights!: Table<InsightRecord, string>;
  researchReports!: Table<ResearchReport, string>;
  aiThreads!: Table<AiThread, string>;
  aiMessages!: Table<AiMessage, string>;

  constructor() {
    super('personal-finance-tracker');
    this.version(1).stores({
      holdings: 'id, type, categoryId, name',
      pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
      categories: 'id, name, sortOrder',
      appMeta: 'id'
    });
    // v2: introduce purchaseDate on holdings; backfill existing rows to today
    this.version(2)
      .stores({
        holdings: 'id, type, categoryId, name',
        pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
        categories: 'id, name, sortOrder',
        appMeta: 'id'
      })
      .upgrade(async (tx) => {
        const today = new Date().toISOString().slice(0, 10);
        await tx.table('holdings').toCollection().modify((h: any) => {
          if (!h.purchaseDate) h.purchaseDate = today;
        });
      });
    // v3: add buyValue/currentValue optional fields; initialize from units*pricePerUnit
    this.version(3)
      .stores({
        holdings: 'id, type, categoryId, name',
        pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
        categories: 'id, name, sortOrder',
        appMeta: 'id'
      })
      .upgrade(async (tx) => {
        await tx.table('holdings').toCollection().modify((h: any) => {
          const derived = (h.units || 0) * (h.pricePerUnit || 0);
          if (typeof h.buyValue !== 'number') h.buyValue = derived;
          if (typeof h.currentValue !== 'number') h.currentValue = derived;
        });
      });

    // v4: introduce transactions table and backfill baseline entries from existing holdings
    this.version(4)
      .stores({
        holdings: 'id, type, categoryId, name',
        pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
        transactions: 'id, holdingId, dateISO, [holdingId+dateISO]',
        categories: 'id, name, sortOrder',
        appMeta: 'id'
      })
      .upgrade(async (tx) => {
        const nano = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;
        const holdings: any[] = await tx.table('holdings').toArray();
        const trxTable = tx.table('transactions');
        for (const h of holdings) {
          const dateISO: string = (h.purchaseDate as string) || new Date().toISOString().slice(0, 10);
          const isAmount = h.type === 'cash' || h.type === 'real_estate';
          const baseAmount = typeof h.buyValue === 'number' ? h.buyValue : ((h.units || 0) * (h.pricePerUnit || 0));
          const deltaUnits = isAmount ? baseAmount : (h.units || 0);
          const existing = await trxTable.where('holdingId').equals(h.id).count();
          if (existing === 0) {
            await trxTable.put({
              id: nano('tx-'),
              holdingId: h.id,
              dateISO,
              deltaUnits,
              pricePerUnit: isAmount ? undefined : (h.pricePerUnit || 0)
            } as any);
          }
        }
      });

    // v5: store buyValueCurrency and category deposits
    this.version(5)
      .stores({
        holdings: 'id, type, categoryId, name',
        pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
        transactions: 'id, holdingId, dateISO, [holdingId+dateISO]',
        categories: 'id, name, sortOrder',
        appMeta: 'id'
      })
      .upgrade(async (tx) => {
        await tx.table('holdings').toCollection().modify((h: any) => {
          const normalized = normalizeFiat((h.currency || '').toString().toUpperCase());
          if (!h.buyValueCurrency) h.buyValueCurrency = normalized;
        });
        await tx.table('categories').toCollection().modify((c: any) => {
          const normalized = normalizeFiat((c.depositCurrency || '').toString().toUpperCase());
          c.depositCurrency = normalized;
          if (typeof c.depositValue !== 'number') {
            c.depositValue = undefined;
          }
        });
      });

    // v6: introduce modelPrefs and aiCache stores
    this.version(6)
      .stores({
        holdings: 'id, type, categoryId, name',
        pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
        transactions: 'id, holdingId, dateISO, [holdingId+dateISO]',
        categories: 'id, name, sortOrder',
        appMeta: 'id',
        modelPrefs: 'id',
        aiCache: 'id,&key,createdAt',
        insights: 'id, runId, createdAt',
        priceAlerts: 'id, holdingId, createdAt'
      })
      .upgrade(async (tx) => {
        const prefsTable = tx.table('modelPrefs');
        const existing = await prefsTable.get('global');
        if (!existing) {
          await prefsTable.put({ id: 'global' });
        }
        if (!(await tx.table('priceAlerts').count())) {
          // no-op placeholder to ensure store exists
        }
        await tx.table('insights').count().catch(() => undefined);
      });

    // v7: introduce researchReports store
    this.version(7)
      .stores({
        holdings: 'id, type, categoryId, name',
        pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
        transactions: 'id, holdingId, dateISO, [holdingId+dateISO]',
        categories: 'id, name, sortOrder',
        appMeta: 'id',
        modelPrefs: 'id',
        aiCache: 'id,&key,createdAt',
        insights: 'id, runId, createdAt',
        priceAlerts: 'id, holdingId, createdAt',
        researchReports: 'id, subjectKey, createdAt, subjectType'
      });

    // v8: introduce aiThreads and aiMessages for chat history
    this.version(8)
      .stores({
        holdings: 'id, type, categoryId, name',
        pricePoints: 'id, holdingId, dateISO, [holdingId+dateISO]',
        transactions: 'id, holdingId, dateISO, [holdingId+dateISO]',
        categories: 'id, name, sortOrder',
        appMeta: 'id',
        modelPrefs: 'id',
        aiCache: 'id,&key,createdAt',
        insights: 'id, runId, createdAt',
        priceAlerts: 'id, holdingId, createdAt',
        researchReports: 'id, subjectKey, createdAt, subjectType',
        aiThreads: 'id, pinned, pageRoute, updatedAt, createdAt',
        aiMessages: 'id, threadId, createdAt, [threadId+createdAt]'
      });
  }
}

export const db = new AppDB();

// Initialize meta if not exists
async function ensureMeta() {
  const existing = await db.appMeta.get('app-meta');
  if (!existing) {
    await db.appMeta.put({
      id: 'app-meta',
      schemaVersion: SCHEMA_VERSION,
      createdAt: new Date().toISOString()
    });
  } else if (existing.schemaVersion !== SCHEMA_VERSION) {
    await db.appMeta.put({ ...existing, schemaVersion: SCHEMA_VERSION });
  }
}
ensureMeta();

async function ensureModelPrefs() {
  const existing = await db.modelPrefs.get('global');
  if (!existing) {
    await db.modelPrefs.put({ id: 'global' });
  }
}
ensureModelPrefs();


