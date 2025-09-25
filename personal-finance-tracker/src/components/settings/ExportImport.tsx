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
        <label className="relative inline-flex items-center gap-2 cursor-pointer group">
          <span className="rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/20 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl group-focus-within:ring-2 group-focus-within:ring-blue-400 group-focus-within:ring-offset-2 group-focus-within:ring-offset-slate-900">
            Import JSON
          </span>
          <input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="application/json" onChange={onImport} />
        </label>
      </div>
      <p className="text-sm text-gray-500">
        Your data never leaves your browser. Export regularly to keep backups.
      </p>
    </div>
  );
}


