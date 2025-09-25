import Card from '@/components/ui/Card';
import AiSettings from '@/components/settings/AiSettings';
import ExportImport from '@/components/settings/ExportImport';
import DemoDataButton from '@/components/settings/DemoDataButton';
import Button from '@/components/ui/Button';
import { clearAllData } from '@/lib/exportImport';

export default function Settings() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AiSettings />
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
    </div>
  );
}

