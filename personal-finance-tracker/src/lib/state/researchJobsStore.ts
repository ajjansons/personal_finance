import { create } from 'zustand';
import { nanoid } from '@/lib/repository/nanoid';
import { generateResearchReport, type ProgressCallback } from '@/features/research/researchEngine';
import type { ResearchParams } from '@/features/research/types';

export type ResearchJobStep = 'planning' | 'fetching' | 'generating' | 'saving' | 'complete' | 'error' | 'cancelled';
export type ResearchJobStatus = 'running' | 'complete' | 'error' | 'cancelled';

export type ResearchJob = {
  id: string;
  params: ResearchParams;
  status: ResearchJobStatus;
  step: ResearchJobStep;
  progress: number;
  message: string;
  currentSection?: number;
  totalSections?: number;
  reportId?: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
  notified?: boolean;
};

type ResearchJobsState = {
  jobs: ResearchJob[];
  startJob: (params: ResearchParams) => string;
  cancelJob: (jobId: string) => void;
  dismissJob: (jobId: string) => void;
  markNotified: (jobId: string) => void;
};

const controllerMap = new Map<string, AbortController>();

function patchJob(jobId: string, partial: Partial<ResearchJob>) {
  useResearchJobsStore.setState((state) => ({
    jobs: state.jobs.map((job) =>
      job.id === jobId ? { ...job, ...partial, updatedAt: new Date().toISOString() } : job
    )
  }));
}

async function runResearchJob(jobId: string, params: ResearchParams, controller: AbortController) {
  const progressHandler: ProgressCallback = (update) => {
    patchJob(jobId, {
      step: update.step,
      progress: update.progress,
      message: update.message,
      currentSection: update.currentSection,
      totalSections: update.totalSections
    });
  };

  try {
    const report = await generateResearchReport({ ...params, signal: controller.signal }, progressHandler);

    controllerMap.delete(jobId);

    if (!report) {
      if (controller.signal.aborted) {
        patchJob(jobId, {
          status: 'cancelled',
          step: 'cancelled',
          message: 'Research cancelled',
          progress: 0
        });
      } else {
        patchJob(jobId, {
          status: 'error',
          step: 'error',
          message: 'Research failed. No report was generated.',
          error: 'Research generation returned no report.'
        });
      }
      return;
    }

    patchJob(jobId, {
      status: 'complete',
      step: 'complete',
      progress: 100,
      message: 'Report ready',
      reportId: report.id
    });
  } catch (error: any) {
    controllerMap.delete(jobId);
    if (controller.signal.aborted) {
      patchJob(jobId, {
        status: 'cancelled',
        step: 'cancelled',
        message: 'Research cancelled'
      });
      return;
    }
    const message = error?.message ?? 'Unexpected research failure';
    patchJob(jobId, {
      status: 'error',
      step: 'error',
      message,
      error: message
    });
  }
}

export const useResearchJobsStore = create<ResearchJobsState>((set) => ({
  jobs: [],
  startJob: (params) => {
    const jobId = nanoid('research-job-');
    const controller = new AbortController();
    controllerMap.set(jobId, controller);

    const now = new Date().toISOString();
    const job: ResearchJob = {
      id: jobId,
      params,
      status: 'running',
      step: 'planning',
      progress: 5,
      message: 'Planning research structure…',
      startedAt: now,
      updatedAt: now
    };

    set((state) => ({ jobs: [...state.jobs, job] }));

    void runResearchJob(jobId, params, controller);
    return jobId;
  },
  cancelJob: (jobId) => {
    const controller = controllerMap.get(jobId);
    if (controller) {
      controller.abort();
      controllerMap.delete(jobId);
    }
    patchJob(jobId, {
      status: 'cancelled',
      step: 'cancelled',
      message: 'Research cancelled'
    });
  },
  dismissJob: (jobId) => {
    controllerMap.delete(jobId);
    set((state) => ({ jobs: state.jobs.filter((job) => job.id !== jobId) }));
  },
  markNotified: (jobId) => {
    patchJob(jobId, { notified: true });
  }
}));
