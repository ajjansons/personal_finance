import { z } from 'zod';
import { callAi } from '@/ai/client';
import { nanoid } from '@/lib/repository/nanoid';
import { getRepository } from '@/lib/repository';
import type {
  ResearchReport,
  ReportSection,
  ReportSource,
  ResearchParams,
  SectionPlan,
  FetchedSource,
  ReportTable
} from './types';
import { fetchEDGARFilings } from './fetchers/edgar';
import { fetchCompanyIRPages } from './fetchers/irPages';
import { fetchPublicWebSources } from './fetchers/webSearch';
import { buildPlannerPrompt, buildSectionPrompt, extractJSON } from './prompts';

// Validation schemas
const sectionPlanSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      dataNeeds: z.array(z.string())
    })
  )
});

const sectionContentSchema = z.object({
  bodyMd: z.string(),
  bullets: z.array(z.string()).optional(),
  tables: z
    .array(
      z.object({
        caption: z.string().optional(),
        headers: z.array(z.string()),
        rows: z.array(z.array(z.string()))
      })
    )
    .optional()
});

export type ProgressCallback = (update: {
  step: 'planning' | 'fetching' | 'generating' | 'saving';
  progress: number;
  message: string;
  currentSection?: number;
  totalSections?: number;
}) => void;

/**
 * Main research report generation function
 */
export async function generateResearchReport(
  params: ResearchParams,
  onProgress?: ProgressCallback
): Promise<ResearchReport | null> {
  const { subjectId, holdingName, signal } = params;
  const repo = getRepository();

  try {
    console.info('[research] Starting report generation for:', holdingName);

    // Step 1: Plan the research sections with AI
    onProgress?.({ step: 'planning', progress: 10, message: 'Planning research structure...' });
    const sectionPlans = await planResearchSections(params, signal);
    if (!sectionPlans || sectionPlans.length === 0) {
      console.warn('[research] Failed to plan sections');
      return null;
    }

    console.info('[research] Planned', sectionPlans.length, 'sections');
    onProgress?.({ step: 'planning', progress: 20, message: `Planned ${sectionPlans.length} sections` });

    // Step 2: Fetch data sources in parallel
    onProgress?.({ step: 'fetching', progress: 30, message: 'Fetching data sources...' });
    const sources = await fetchDataSources(params, signal);
    console.info('[research] Fetched', sources.length, 'data sources');
    onProgress?.({ step: 'fetching', progress: 40, message: `Fetched ${sources.length} sources` });

    // Step 3: Generate each section with AI
    const sections: ReportSection[] = [];
    const progressPerSection = 50 / sectionPlans.length;

    for (let i = 0; i < sectionPlans.length; i++) {
      if (signal?.aborted) break;

      const plan = sectionPlans[i];
      console.info(`[research] Generating section ${i + 1}/${sectionPlans.length}: ${plan.title}`);

      onProgress?.({
        step: 'generating',
        progress: 40 + (i * progressPerSection),
        message: `Generating: ${plan.title}`,
        currentSection: i + 1,
        totalSections: sectionPlans.length
      });

      const section = await generateSection(plan, params, sources, i, signal);
      if (section) {
        sections.push(section);
      }
    }

    if (sections.length === 0) {
      console.warn('[research] No sections generated');
      return null;
    }

    // Step 4: Create report object
    onProgress?.({ step: 'saving', progress: 95, message: 'Finalizing report...' });
    const report: Omit<ResearchReport, 'id'> = {
      subjectType: params.subjectType,
      subjectKey: subjectId,
      subjectName: holdingName,
      createdAt: new Date().toISOString(),
      modelId: 'gpt-4o', // TODO: Get from model prefs
      status: 'completed',
      sections,
      sources: sources.map((s, idx) => ({
        id: nanoid('src-'),
        title: s.title,
        url: s.url,
        type: s.type,
        fetchedAt: new Date().toISOString(),
        excerpt: s.excerpt
      })),
      metadata: {
        holdingSymbol: params.holdingSymbol,
        holdingType: params.holdingType
      }
    };

    // Step 5: Save to repository
    const reportId = await repo.saveResearchReport(report);
    console.info('[research] Report saved with ID:', reportId);
    onProgress?.({ step: 'saving', progress: 100, message: 'Report complete!' });

    return { ...report, id: reportId };
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') {
      console.info('[research] Report generation aborted');
      return null;
    }
    console.error('[research] Report generation failed:', error);
    return null;
  }
}

/**
 * Plan research sections using AI
 */
async function planResearchSections(
  params: ResearchParams,
  signal?: AbortSignal
): Promise<SectionPlan[]> {
  const prompt = buildPlannerPrompt(params);

  const result = await callAi({
    feature: 'research',
    system: 'You are an investment research analyst. Return only valid JSON.',
    messages: [{ role: 'user', content: prompt }],
    cacheTtlSec: 0, // Don't cache planning
    abortSignal: signal
  });

  if (!result.ok || !result.text) {
    return [];
  }

  const jsonText = extractJSON(result.text);
  if (!jsonText) {
    console.warn('[research] No JSON found in planner response');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonText);
    const validated = sectionPlanSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn('[research] Invalid section plan schema:', validated.error);
      return [];
    }

    return validated.data.sections;
  } catch (error) {
    console.warn('[research] Failed to parse section plan:', error);
    return [];
  }
}

/**
 * Fetch data sources from multiple providers
 */
async function fetchDataSources(
  params: ResearchParams,
  signal?: AbortSignal
): Promise<FetchedSource[]> {
  const { holdingSymbol, holdingName } = params;
  const sources: FetchedSource[] = [];

  // Run fetchers in parallel with timeout
  const fetchers = [];

  if (holdingSymbol) {
    // Only fetch EDGAR if we have a symbol
    fetchers.push(
      Promise.race([
        fetchEDGARFilings(holdingSymbol, 3, signal),
        new Promise<FetchedSource[]>((resolve) => setTimeout(() => resolve([]), 10000))
      ])
    );
  }

  // Always fetch IR pages and web sources
  fetchers.push(
    Promise.race([
      fetchCompanyIRPages(holdingSymbol || '', holdingName, 2, signal),
      new Promise<FetchedSource[]>((resolve) => setTimeout(() => resolve([]), 8000))
    ])
  );

  fetchers.push(
    Promise.race([
      fetchPublicWebSources(holdingSymbol || '', holdingName, 5, signal),
      new Promise<FetchedSource[]>((resolve) => setTimeout(() => resolve([]), 5000))
    ])
  );

  const results = await Promise.allSettled(fetchers);

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      sources.push(...result.value);
    }
  });

  return sources;
}

/**
 * Generate a single section with AI
 */
async function generateSection(
  plan: SectionPlan,
  params: ResearchParams,
  sources: FetchedSource[],
  order: number,
  signal?: AbortSignal
): Promise<ReportSection | null> {
  const prompt = buildSectionPrompt(plan.title, plan.description, params, sources);

  const result = await callAi({
    feature: 'research',
    system: 'You are an investment research analyst. Return only valid JSON with markdown content.',
    messages: [{ role: 'user', content: prompt }],
    cacheTtlSec: 5 * 60, // Cache for 5 minutes
    abortSignal: signal
  });

  if (!result.ok || !result.text) {
    return null;
  }

  const jsonText = extractJSON(result.text);
  if (!jsonText) {
    console.warn('[research] No JSON found in section response');
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText);
    const validated = sectionContentSchema.safeParse(parsed);

    if (!validated.success) {
      console.warn('[research] Invalid section content schema:', validated.error);
      return null;
    }

    const { bodyMd, bullets, tables } = validated.data;

    // Convert tables to our format
    const convertedTables: ReportTable[] | undefined = tables?.map((t) => ({
      id: nanoid('tbl-'),
      caption: t.caption,
      headers: t.headers,
      rows: t.rows
    }));

    return {
      id: nanoid('sec-'),
      title: plan.title,
      bodyMd,
      bullets,
      tables: convertedTables,
      order
    };
  } catch (error) {
    console.warn('[research] Failed to parse section content:', error);
    return null;
  }
}

/**
 * Get recent reports for a subject
 */
export async function getRecentReports(
  subjectKey: string,
  limit = 5
): Promise<ResearchReport[]> {
  const repo = getRepository();
  return repo.getResearchReports({ subjectKey, limit });
}

/**
 * Delete a research report
 */
export async function deleteReport(reportId: string): Promise<void> {
  const repo = getRepository();
  await repo.deleteResearchReport(reportId);
}