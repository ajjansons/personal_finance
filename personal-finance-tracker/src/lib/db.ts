import Dexie, { Table } from 'dexie';
import { AppMeta, Category, Holding, PricePoint } from './repository/types';
import { SCHEMA_VERSION } from './constants';

export class AppDB extends Dexie {
  holdings!: Table<Holding, string>;
  pricePoints!: Table<PricePoint, string>;
  categories!: Table<Category, string>;
  appMeta!: Table<AppMeta, string>;

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
  }
}
ensureMeta();
