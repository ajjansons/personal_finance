import { getRepository } from './repository';
import { SCHEMA_VERSION } from './constants';
import { migrateIfNeeded } from './validation';

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
    await repo.importAll({
      holdings: parsed.holdings,
      categories: parsed.categories,
      pricePoints: parsed.pricePoints
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}

export async function clearAllData() {
  await repo.clearAll();
}

