import Button from '@/components/ui/Button';
import { exportToJson, importFromJson } from '@/lib/exportImport';

export default function ExportImport() {
  async function onExport() {
    const blob = await exportToJson();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pft-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onImport(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const res = await importFromJson(text);
    if (res.ok) {
      alert('Import successful.');
    } else {
      alert(`Import failed: ${res.error}`);
    }
    ev.target.value = '';
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={onExport}>Export JSON</Button>
        <label className="inline-flex items-center gap-2">
          <span className="rounded-md border px-3 py-2 text-sm cursor-pointer bg-white hover:bg-gray-50">
            Import JSON
          </span>
          <input className="hidden" type="file" accept="application/json" onChange={onImport} />
        </label>
      </div>
      <p className="text-sm text-gray-500">
        Your data never leaves your browser. Export regularly to keep backups.
      </p>
    </div>
  );
}

