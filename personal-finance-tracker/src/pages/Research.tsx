import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Dialog from '@/components/ui/Dialog';
import { useResearchReports, useDeleteResearchReport } from '@/hooks/useResearchReports';
import { useHoldings } from '@/hooks/useHoldings';
import { useCategories } from '@/hooks/useCategories';
import type { ResearchReport } from '@/features/research/types';

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function summarizeSection(body: string) {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 180) return normalized;
  return normalized.slice(0, 177) + '...';
}

type SortKey = 'recent' | 'holding' | 'category';

type DecoratedReport = ResearchReport & {
  categoryName: string;
};

export default function ResearchIndex() {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const { data: reports = [], isLoading } = useResearchReports();
  const { data: holdings = [] } = useHoldings();
  const { data: categories = [] } = useCategories();
  const deleteMutation = useDeleteResearchReport();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<{ id: string; name: string } | null>(null);

  const holdingsById = useMemo(() => new Map(holdings.map((holding) => [holding.id, holding])), [holdings]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const decoratedReports = useMemo(() => {
    return reports.map((report) => {
      let categoryName = 'Uncategorized';
      if (report.metadata?.holdingCategoryId) {
        categoryName = categoriesById.get(report.metadata.holdingCategoryId)?.name ?? categoryName;
      } else {
        const holding = holdingsById.get(report.subjectKey);
        if (holding?.categoryId) {
          categoryName = categoriesById.get(holding.categoryId)?.name ?? categoryName;
        }
      }
      return { ...report, categoryName } satisfies DecoratedReport;
    });
  }, [reports, holdingsById, categoriesById]);

  const sortedReports = useMemo(() => {
    const copy = [...decoratedReports];
    switch (sortKey) {
      case 'holding':
        copy.sort((a, b) => a.subjectName.localeCompare(b.subjectName, undefined, { sensitivity: 'base' }));
        break;
      case 'category':
        copy.sort((a, b) => {
          const categoryCompare = a.categoryName.localeCompare(b.categoryName, undefined, { sensitivity: 'base' });
          if (categoryCompare !== 0) return categoryCompare;
          return a.subjectName.localeCompare(b.subjectName, undefined, { sensitivity: 'base' });
        });
        break;
      case 'recent':
      default:
        copy.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        break;
    }
    return copy;
  }, [decoratedReports, sortKey]);

  const handleDeleteClick = (reportId: string, subjectName: string) => {
    setReportToDelete({ id: reportId, name: subjectName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return;
    try {
      await deleteMutation.mutateAsync(reportToDelete.id);
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    } catch (error) {
      console.error('[research] failed to delete report', error);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Research Library</h1>
          <p className="text-sm text-slate-400">
            Track AI-generated reports and revisit prior analyses whenever you need them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="research-sort" className="text-sm text-slate-400">
            Sort by
          </label>
          <Select
            id="research-sort"
            className="w-48"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
          >
            <option value="recent">Most recent</option>
            <option value="holding">Holding</option>
            <option value="category">Category</option>
          </Select>
        </div>
      </header>

      {isLoading ? (
        <Card>
          <p className="text-sm text-slate-400">Loading saved research�</p>
        </Card>
      ) : sortedReports.length === 0 ? (
        <Card>
          <div className="space-y-2">
            <p className="text-sm text-slate-400">No research has been saved yet.</p>
            <p className="text-xs text-slate-500">Generate a report from the Holdings page to see it appear here.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sortedReports.map((report) => {
            const latestSections = [...report.sections]
              .sort((a, b) => a.order - b.order)
              .slice(0, 3);

            return (
              <Card key={report.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/research/${report.id}`} className="text-xl font-semibold text-blue-300 hover:text-blue-200">
                      {report.subjectName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Generated {formatDate(report.createdAt)}</span>
                      <span>Model: {report.modelId}</span>
                      <span>Sections: {report.sections.length}</span>
                      <span>Sources: {report.sources.length}</span>
                      <span className="rounded-full bg-slate-800/50 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-300">
                        {report.categoryName}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => navigate(`/research/${report.id}`)}>
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteClick(report.id, report.subjectName)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {latestSections.length > 0 && (
                  <div className="space-y-2 rounded-2xl border border-slate-700/50 bg-slate-900/60 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Key highlights</p>
                    <ul className="space-y-3 text-sm text-slate-200">
                      {latestSections.map((section) => (
                        <li key={section.id}>
                          <p className="font-medium text-slate-100">{section.title}</p>
                          <p className="text-slate-400">{summarizeSection(section.bodyMd)}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title="Delete Research Report">
        <div className="space-y-4">
          <p className="text-slate-300">
            Are you sure you want to delete the research report for <span className="font-semibold text-slate-100">{reportToDelete?.name}</span>?
          </p>
          <p className="text-sm text-slate-400">This action cannot be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

