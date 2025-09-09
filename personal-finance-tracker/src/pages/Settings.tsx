import Card from '@/components/ui/Card';
import ExportImport from '@/components/settings/ExportImport';
import DemoDataButton from '@/components/settings/DemoDataButton';
import Button from '@/components/ui/Button';
import { clearAllData } from '@/lib/exportImport';

export default function Settings() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Backup</h2>
        <ExportImport />
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Demo & Reset</h2>
        <div className="flex gap-3">
          <DemoDataButton />
          <Button
            variant="destructive"
            onClick={async () => {
              await clearAllData();
              alert('All data cleared.');
            }}
          >
            Clear Data
          </Button>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Data is stored in your browser (IndexedDB). Clearing removes all entities.
        </p>
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-semibold">Future: Heat Map (Phase 2)</h2>
        <p className="text-sm text-gray-600">
          Placeholder for a performance-sensitive heat map view of asset changes over time. We will
          pre-aggregate bins and render with canvas for large portfolios.
        </p>
      </Card>
    </div>
  );
}

