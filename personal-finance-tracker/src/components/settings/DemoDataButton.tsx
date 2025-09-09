import Button from '@/components/ui/Button';
import { importFromJson } from '@/lib/exportImport';

export default function DemoDataButton() {
  async function onLoad() {
    const resp = await fetch('/demo-seed.json').catch(() => undefined);
    if (!resp?.ok) {
      alert('Demo seed not found. Run `npm run seed:build` first.');
      return;
    }
    const text = await resp.text();
    const result = await importFromJson(text);
    if (result.ok) alert('Demo data loaded. Check Dashboard!');
    else alert(`Failed to load demo: ${result.error}`);
  }
  return <Button onClick={onLoad}>Load Demo Data</Button>;
}

