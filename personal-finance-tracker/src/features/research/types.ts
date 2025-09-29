export type ResearchReportStatus = 'generating' | 'completed' | 'failed';
export type ResearchSubjectType = 'holding' | 'sector';
export type SourceType = 'filing' | 'press_release' | 'ir_page' | 'news' | 'other';

export type ReportTable = {
  id: string;
  caption?: string;
  headers: string[];
  rows: string[][];
};

export type ReportSection = {
  id: string;
  title: string;
  bodyMd: string;
  bullets?: string[];
  tables?: ReportTable[];
  order: number;
};

export type ReportSource = {
  id: string;
  title: string;
  url: string;
  type: SourceType;
  fetchedAt: string;
  excerpt?: string;
};

export type ResearchReport = {
  id: string;
  subjectType: ResearchSubjectType;
  subjectKey: string;
  subjectName: string;
  createdAt: string;
  modelId: string;
  status: ResearchReportStatus;
  sections: ReportSection[];
  sources: ReportSource[];
  metadata?: {
    holdingSymbol?: string;
    holdingType?: string;
    sectorCategory?: string;
  };
};

export type ResearchParams = {
  subjectType: ResearchSubjectType;
  subjectId: string;
  holdingSymbol?: string;
  holdingName: string;
  holdingType?: string;
  signal?: AbortSignal;
};

export type SectionPlan = {
  title: string;
  description: string;
  dataNeeds: string[];
};

export type FetchedSource = {
  title: string;
  url: string;
  type: SourceType;
  content: string;
  excerpt?: string;
};