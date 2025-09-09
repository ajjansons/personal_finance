import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.cwd());
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf-8'));

const holdings = readJson(path.join(root, 'SEED/holdings.sample.json'));
const categories = readJson(path.join(root, 'SEED/categories.sample.json'));
const prices = readJson(path.join(root, 'SEED/prices.sample.json'));

const seed = {
  schemaVersion: 1,
  meta: { createdAt: new Date().toISOString() },
  holdings,
  categories,
  pricePoints: prices
};

const outDir = path.join(root, 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'demo-seed.json');
fs.writeFileSync(outFile, JSON.stringify(seed, null, 2), 'utf-8');
console.log(`✅ Wrote ${outFile}`);

