import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Button from './Button';

interface ChartModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function ChartModal({ open, onClose, title, children }: ChartModalProps) {
  const [isMounted, setIsMounted] = useState(open);
  const [isClosing, setIsClosing] = useState(false);
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Manage mount/unmount to allow exit animation
  useEffect(() => {
    if (open) {
      setIsMounted(true);
      setIsClosing(false);
    } else if (isMounted) {
      setIsClosing(true);
      const t = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open, isMounted]);

  // Lock body scroll and handle Escape while mounted (including during exit)
  useEffect(() => {
    if (!isMounted) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = prevOverflow || 'unset';
    };
  }, [isMounted, onClose]);

  // Focus the primary close button when opened
  useEffect(() => {
    if (open && closeBtnRef.current) {
      const t = setTimeout(() => closeBtnRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!isMounted) return null;

  const overlayClasses = 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-md ' + (isClosing ? 'animate-scale-out' : 'animate-scale-in');
  const cardClasses = 'absolute inset-2 sm:inset-6 lg:inset-10 glass-card flex flex-col';

  return createPortal(
    <div className={overlayClasses} onClick={onClose}>
      {/* Full screen modal taking up nearly entire viewport */}
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        className={cardClasses}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with large collapse button */}
        <div className='flex items-center justify-between p-6 border-b border-slate-700/30'>
          <h2 id={titleId} className='text-2xl font-bold gradient-text'>{title}</h2>
          <Button
            ref={closeBtnRef}
            variant='default'
            onClick={onClose}
            className='px-6 py-3 text-base'
            aria-label='Collapse chart'
            title='Collapse chart [Esc]'
          >
            <svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 9l6 6m0-6l-6 6M4 8h4V4m12 4h-4V4M4 16h4v4m12 0h-4v4' />
            </svg>
            Collapse Chart
          </Button>
        </div>

        {/* Chart content taking up remaining space */}
        <div className='flex-1 p-6'>
          <div className='w-full h-full'>
            {children}
          </div>
        </div>

        {/* Footer with additional close button */}
        <div className='p-6 border-t border-slate-700/30 flex justify-center'>
          <Button
            variant='ghost'
            onClick={onClose}
            className='px-8 py-3'
          >
            Close Expanded View
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ExpandToggleButtonProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ExpandToggleButton({ isExpanded, onToggle }: ExpandToggleButtonProps) {
  return (
    <Button
      variant='icon'
      size='sm'
      onClick={onToggle}
      className='absolute top-4 right-4 z-10 opacity-70 hover:opacity-100'
      aria-label={isExpanded ? 'Collapse chart' : 'Expand chart'}
      title={isExpanded ? 'Collapse chart' : 'Expand chart'}
    >
      {isExpanded ? (
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 9l6 6M15 9l-6 6M4 8h4V4M20 8h-4V4M4 16h4v4M20 16h-4v4' />
        </svg>
      ) : (
        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5' />
        </svg>
      )}
    </Button>
  );
}