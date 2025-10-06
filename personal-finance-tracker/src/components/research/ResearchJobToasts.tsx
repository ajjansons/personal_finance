import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Button from '@/components/ui/Button';
import { useResearchJobsStore, type ResearchJob } from '@/lib/state/researchJobsStore';

function formatProgressLabel(job: ResearchJob) {
  if (job.status === 'complete') return 'Completed';
  if (job.status === 'error') return 'Failed';
  if (job.status === 'cancelled') return 'Cancelled';
  return `${Math.round(job.progress)}%`;
}

function formatMessage(job: ResearchJob) {
  if (job.status === 'error' && job.error) return job.error;
  return job.message;
}

export default function ResearchJobToasts() {
  const jobs = useResearchJobsStore((s) => s.jobs);
  const cancelJob = useResearchJobsStore((s) => s.cancelJob);
  const dismissJob = useResearchJobsStore((s) => s.dismissJob);
  const markNotified = useResearchJobsStore((s) => s.markNotified);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)),
    [jobs]
  );

  useEffect(() => {
    sortedJobs.forEach((job) => {
      if (job.status === 'complete' && !job.notified) {
        queryClient.invalidateQueries({ queryKey: ['researchReports'] }).catch(() => undefined);
        markNotified(job.id);
      }
    });
  }, [sortedJobs, queryClient, markNotified]);

  if (sortedJobs.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-4">
      {sortedJobs.map((job) => {
        const running = job.status === 'running';
        const progressWidth = `${Math.max(5, Math.min(100, Math.round(job.progress)))}%`;

        return (
          <div
            key={job.id}
            className="w-80 rounded-2xl border border-blue-500/20 bg-slate-900/95 p-4 shadow-2xl shadow-blue-900/30 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">Researching {job.params.holdingName}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{formatProgressLabel(job)}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss research notification"
                className="text-slate-500 transition hover:text-slate-200"
                onClick={() => dismissJob(job.id)}
              >
                ×
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-300">{formatMessage(job)}</p>

            {running && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: progressWidth }} />
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              {running ? (
                <Button variant="ghost" size="sm" onClick={() => cancelJob(job.id)}>
                  Cancel
                </Button>
              ) : job.status === 'complete' && job.reportId ? (
                <>
                  <Button size="sm" onClick={() => navigate(`/research/${job.reportId}`)}>
                    View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => dismissJob(job.id)}>
                    Dismiss
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => dismissJob(job.id)}>
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

