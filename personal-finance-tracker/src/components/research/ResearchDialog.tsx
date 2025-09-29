import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { generateResearchReport } from '@/features/research/researchEngine';
import type { ResearchParams } from '@/features/research/types';

type ResearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: ResearchParams | null;
};

type GenerationStep = 'planning' | 'fetching' | 'generating' | 'saving' | 'complete' | 'error';

export default function ResearchDialog({ open, onOpenChange, params }: ResearchDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<GenerationStep>('planning');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [currentSection, setCurrentSection] = useState(0);
  const [totalSections, setTotalSections] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    if (!open || !params) return;

    // Reset state
    setStep('planning');
    setProgress(0);
    setMessage('');
    setCurrentSection(0);
    setTotalSections(0);
    setError(null);
    setReportId(null);

    const controller = new AbortController();
    setAbortController(controller);

    // Start generation
    (async () => {
      try {
        const report = await generateResearchReport(
          { ...params, signal: controller.signal },
          (update) => {
            setStep(update.step);
            setProgress(update.progress);
            setMessage(update.message);
            if (update.currentSection !== undefined) {
              setCurrentSection(update.currentSection);
            }
            if (update.totalSections !== undefined) {
              setTotalSections(update.totalSections);
            }
          }
        );

        if (!report) {
          throw new Error('Failed to generate report');
        }

        setStep('complete');
        setProgress(100);
        setMessage('Report complete!');
        setReportId(report.id);
      } catch (err) {
        if (controller.signal.aborted) {
          return; // User cancelled, don't show error
        }
        setStep('error');
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }
    })();

    return () => {
      controller.abort();
    };
  }, [open, params]);

  const handleCancel = () => {
    abortController?.abort();
    onOpenChange(false);
  };

  const handleViewReport = () => {
    if (reportId) {
      navigate(`/research/${reportId}`);
      onOpenChange(false);
    }
  };

  const getStepMessage = () => {
    if (message) return message;

    switch (step) {
      case 'planning':
        return 'Planning research sections...';
      case 'fetching':
        return 'Fetching data sources...';
      case 'generating':
        return currentSection > 0
          ? `Generating section ${currentSection}/${totalSections}...`
          : 'Generating sections...';
      case 'saving':
        return 'Saving report...';
      case 'complete':
        return 'Report generated successfully!';
      case 'error':
        return 'Generation failed';
      default:
        return 'Processing...';
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && step !== 'complete') {
          handleCancel();
        } else {
          onOpenChange(next);
        }
      }}
      title={params ? `Research Report: ${params.holdingName}` : 'Research Report'}
    >
      <div className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{getStepMessage()}</span>
            <span className="text-slate-400 font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={[
                'h-full transition-all duration-500',
                step === 'error' ? 'bg-red-500' : step === 'complete' ? 'bg-emerald-500' : 'bg-blue-500'
              ].join(' ')}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Details */}
        <div className="space-y-3 text-sm">
          <StepIndicator label="Planning sections" completed={progress > 20} active={step === 'planning'} />
          <StepIndicator label="Fetching data sources" completed={progress > 40} active={step === 'fetching'} />
          <StepIndicator
            label="Generating sections"
            completed={progress >= 90}
            active={step === 'generating'}
            detail={step === 'generating' && totalSections > 0 ? `${currentSection}/${totalSections} sections` : undefined}
          />
          <StepIndicator label="Saving report" completed={progress === 100} active={step === 'saving'} />
        </div>

        {/* Time Warning */}
        {step !== 'complete' && step !== 'error' && (
          <div className="text-xs text-slate-400 text-center">
            This may take 2-4 minutes depending on report complexity
          </div>
        )}

        {/* Error Message */}
        {step === 'error' && error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
            <p className="font-semibold mb-1">Error</p>
            <p>{error}</p>
          </div>
        )}

        {/* Success Message */}
        {step === 'complete' && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300 text-sm">
            <p>Your research report has been generated and saved. Click "View Report" to open it.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          {step === 'complete' ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleViewReport}>View Report</Button>
            </>
          ) : step === 'error' ? (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          ) : (
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

type StepIndicatorProps = {
  label: string;
  completed: boolean;
  active: boolean;
  detail?: string;
};

function StepIndicator({ label, completed, active, detail }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center border-2',
          completed
            ? 'bg-emerald-500 border-emerald-500'
            : active
            ? 'border-blue-500 bg-blue-500/20'
            : 'border-slate-600 bg-slate-800'
        ].join(' ')}
      >
        {completed ? (
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : active ? (
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
        ) : null}
      </div>
      <div className="flex-1">
        <div className={active || completed ? 'text-slate-200' : 'text-slate-500'}>{label}</div>
        {detail && <div className="text-xs text-slate-400">{detail}</div>}
      </div>
    </div>
  );
}