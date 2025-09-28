export type AssetType = 'stock' | 'crypto' | 'cash' | 'real_estate' | 'other';
export type FiatCurrency = 'USD' | 'EUR';

export type Holding = {
  id: string;
  type: AssetType;
  name: string;
  symbol?: string;
  units: number;
  pricePerUnit: number;
  // Optional direct value inputs to support non-unit-priced assets and gain calc
  buyValue?: number;
  buyValueCurrency?: FiatCurrency;
  currentValue?: number;
  currency: string;
  categoryId?: string;
  // ISO date YYYY-MM-DD when the asset was purchased
  purchaseDate: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
};

export type PricePoint = {
  id: string;
  holdingId: string;
  dateISO: string; // YYYY-MM-DD
  pricePerUnit: number;
};

export type Transaction = {
  id: string;
  holdingId: string;
  dateISO: string; // YYYY-MM-DD
  // For stock/crypto/other: shares delta. For cash/real_estate: amount delta.
  deltaUnits: number;
  // Optional reference trade price; ignored for cash/real_estate in calculations.
  pricePerUnit?: number;
};

export type Category = {
  id: string;
  name: string;
  color?: string;
  sortOrder: number;
  depositValue?: number;
  depositCurrency?: FiatCurrency;
};

export type AppMeta = {
  id: 'app-meta';
  schemaVersion: number;
  createdAt: string;
  lastBackupAt?: string;
};

export type ModelPrefs = {
  id: 'global';
  provider?: 'openai' | 'anthropic' | 'xai' | null;
  modelIdByFeature?: Record<string, string>;
  useProxy?: boolean;
  budgetUSD?: number;
  webSearchEnabled?: boolean;
  loggingEnabled?: boolean;
};

export type AiCacheEntry = {
  id: string;
  key: string;
  value: unknown;
  createdAt: string;
  ttlSec: number;
};

export type PriceAlertRule = {
  type: 'price_above' | 'price_below';
  price: number;
  currency?: FiatCurrency;
};

export type PriceAlert = {
  id: string;
  holdingId: string;
  rule: PriceAlertRule;
  createdAt: string;
  lastNotifiedAt?: string;
};

export type HoldingCreate = Omit<Holding, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>;
export type CategoryCreate = Omit<Category, 'id'>;
export type PricePointCreate = Omit<PricePoint, 'id'>;
export type PriceAlertCreate = Omit<PriceAlert, 'id' | 'createdAt' | 'lastNotifiedAt'>;

export type HoldingWithValue = Holding & { marketValue: number };

export type ExportBundle = {
  holdings: Holding[];
  categories: Category[];
  pricePoints: PricePoint[];
  modelPrefs?: ModelPrefs | null;
  aiCache?: AiCacheEntry[];
  priceAlerts?: PriceAlert[];
};

export type ImportBundle = ExportBundle;

export interface PortfolioRepository {
  getHoldings(opts?: { includeDeleted?: boolean }): Promise<Holding[]>;
  createHolding(h: HoldingCreate): Promise<string>;
  updateHolding(h: Holding): Promise<void>;
  softDeleteHolding(id: string): Promise<void>;

  getCategories(): Promise<Category[]>;
  createCategory(c: CategoryCreate): Promise<string>;
  updateCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  addPricePoint(p: PricePointCreate): Promise<string>;
  getPriceHistory(holdingId: string): Promise<PricePoint[]>;
  getAllPricePoints(): Promise<PricePoint[]>;

  // Transactions
  addTransaction(t: Omit<Transaction, 'id'>): Promise<string>;
  getTransactions(holdingId: string): Promise<Transaction[]>;
  getAllTransactions(): Promise<Transaction[]>;

  getModelPrefs(): Promise<ModelPrefs | null>;
  setModelPrefs(prefs: ModelPrefs): Promise<void>;

  aiCacheGet(key: string): Promise<AiCacheEntry | undefined>;
  aiCacheSet(entry: { key: string; value: unknown; ttlSec: number }): Promise<void>;
  aiCachePurgeExpired(): Promise<number>;

  appendHoldingNote(holdingId: string, text: string): Promise<Holding>;

  createPriceAlert(payload: PriceAlertCreate): Promise<string>;
  getPriceAlerts(holdingId?: string): Promise<PriceAlert[]>;
  deletePriceAlert(id: string): Promise<void>;

  exportAll(): Promise<ExportBundle>;
  importAll(payload: ImportBundle): Promise<void>;
  clearAll(): Promise<void>;
}
