import { z } from 'zod';
import { SCHEMA_VERSION } from './constants';

export const AssetTypeEnum = z.enum(['stock', 'crypto', 'cash', 'real_estate', 'other']);

export const HoldingSchema = z.object({
  id: z.string(),
  type: AssetTypeEnum,
  name: z.string(),
  symbol: z.string().optional(),
  units: z.number().finite(),
  pricePerUnit: z.number().finite(),
  currency: z.string(),
  categoryId: z.string().optional(),
  purchaseDate: z.string(),
  tags: z.array(z.string()),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isDeleted: z.boolean()
});
export type HoldingIn = z.input<typeof HoldingSchema>;
export type HoldingOut = z.output<typeof HoldingSchema>;

export const PricePointSchema = z.object({
  id: z.string(),
  holdingId: z.string(),
  dateISO: z.string(),
  pricePerUnit: z.number().finite()
});
export type PricePointIn = z.input<typeof PricePointSchema>;
export type PricePointOut = z.output<typeof PricePointSchema>;

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  sortOrder: z.number()
});
export type CategoryIn = z.input<typeof CategorySchema>;
export type CategoryOut = z.output<typeof CategorySchema>;

export const AppMetaSchema = z.object({
  id: z.literal('app-meta'),
  schemaVersion: z.number(),
  createdAt: z.string(),
  lastBackupAt: z.string().optional()
});

export const ExportSchema = z.object({
  schemaVersion: z.number(),
  holdings: z.array(HoldingSchema),
  pricePoints: z.array(PricePointSchema),
  categories: z.array(CategorySchema),
  meta: z.any().optional()
});

export function migrateIfNeeded(json: unknown): z.infer<typeof ExportSchema> {
  // Allow reading older exports and migrate forward
  let obj: any = json;
  if (obj && typeof obj === 'object' && 'schemaVersion' in obj) {
    if (obj.schemaVersion < 2) {
      const today = new Date().toISOString().slice(0, 10);
      obj.holdings = (obj.holdings || []).map((h: any) => ({
        purchaseDate: h.purchaseDate || today,
        ...h
      }));
      obj.schemaVersion = 2;
    }
  }
  const parsed = ExportSchema.parse(obj);
  if (parsed.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion ${parsed.schemaVersion}, expected ${SCHEMA_VERSION}`);
  }
  return parsed;
}
