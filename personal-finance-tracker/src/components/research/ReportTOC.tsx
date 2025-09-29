import type { ReportSection } from '@/features/research/types';

type ReportTOCProps = {
  sections: ReportSection[];
  activeSection?: string;
  onNavigate: (sectionId: string) => void;
};

export default function ReportTOC({ sections, activeSection, onNavigate }: ReportTOCProps) {
  return (
    <nav className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
        Table of Contents
      </h3>
      {sections.map((section, index) => (
        <button
          key={section.id}
          onClick={() => onNavigate(section.id)}
          className={[
            'block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
            activeSection === section.id
              ? 'bg-emerald-500/20 text-emerald-300 font-medium'
              : 'text-slate-300 hover:bg-slate-700/30 hover:text-slate-100'
          ].join(' ')}
        >
          <span className="text-slate-500 mr-2">{index + 1}.</span>
          {section.title}
        </button>
      ))}
    </nav>
  );
}