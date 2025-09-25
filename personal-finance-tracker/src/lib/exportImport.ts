import { getRepository } from './repository';
import { SCHEMA_VERSION } from './constants';
import { migrateIfNeeded } from './validation';
import type { ImportBundle, AiCacheEntry } from './repository/types';

const repo = getRepository();

export async function exportToJson(): Promise<Blob> {
  const data = await repo.exportAll();
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    ...data,
    meta: { exportedAt: new Date().toISOString() }
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export async function importFromJson(text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const parsed = migrateIfNeeded(JSON.parse(text));
    const bundle: ImportBundle = {
      holdings: parsed.holdings,
      categories: parsed.categories,
      pricePoints: parsed.pricePoints
    };
    if (Object.prototype.hasOwnProperty.call(parsed, 'modelPrefs')) {
      bundle.modelPrefs = parsed.modelPrefs ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(parsed, 'aiCache')) {
      bundle.aiCache = (parsed.aiCache ?? []) as AiCacheEntry[];
    }
    await repo.importAll(bundle);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

export async function clearAllData() {
  await repo.clearAll();
}


