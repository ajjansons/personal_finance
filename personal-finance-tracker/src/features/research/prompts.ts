import type { ResearchParams, FetchedSource } from './types';

export function buildPlannerPrompt(params: ResearchParams): string {
  const { subjectType, holdingName, holdingSymbol } = params;

  if (subjectType === 'holding') {
    return `You are an investment research analyst planning a comprehensive research report.

Subject: ${holdingName}${holdingSymbol ? ` (${holdingSymbol})` : ''}
Type: Company/Holding Research

Plan 4-6 research sections for this investment. Each section should cover a distinct aspect of the investment case.

Recommended sections:
1. Executive Summary - High-level overview of the company and investment thesis
2. Financial Health - Revenue, profitability, balance sheet strength, cash flow
3. Market Position & Competitive Advantage - Industry standing, moat, competitors
4. Growth Drivers & Opportunities - Expansion plans, new products, market trends
5. Risks & Challenges - Regulatory, competitive, operational, market risks
6. Valuation & Outlook - Price analysis, forward projections, recommendation

Return strict JSON with this schema:
{
  "sections": [
    {
      "title": "Section Title",
      "description": "Brief description of what this section covers",
      "dataNeeds": ["List of data points needed", "e.g., recent earnings", "market cap"]
    }
  ]
}

Focus on actionable investment insights. Be analytical and objective.`;
  }

  // Sector research
  return `You are an investment research analyst planning a sector analysis report.

Subject: ${holdingName} Sector
Type: Sector/Industry Research

Plan 4-6 research sections for this sector analysis.

Recommended sections:
1. Sector Overview - Market size, growth trends, key characteristics
2. Key Players & Market Share - Leading companies and competitive dynamics
3. Industry Trends & Drivers - Technology, regulation, consumer behavior
4. Investment Opportunities - Attractive sub-sectors and companies
5. Risks & Headwinds - Challenges facing the sector
6. Outlook & Recommendations - Forward view and investment strategy

Return strict JSON with the same schema as above.`;
}

export function buildSectionPrompt(
  sectionTitle: string,
  sectionDescription: string,
  params: ResearchParams,
  sources: FetchedSource[]
): string {
  const { holdingName, holdingSymbol, holdingType } = params;

  const sourcesText = sources.map((s, i) =>
    `Source ${i + 1}: ${s.title}
URL: ${s.url}
Type: ${s.type}
Content: ${s.content}
---`
  ).join('\n\n');

  return `You are writing the "${sectionTitle}" section of an investment research report.

**Subject Information:**
- Name: ${holdingName}
- Symbol: ${holdingSymbol || 'N/A'}
- Type: ${holdingType || 'N/A'}
- Section: ${sectionTitle}
- Objective: ${sectionDescription}

**Available Sources:**
${sourcesText || 'No specific sources available. Use general knowledge.'}

**Instructions:**
1. Write 2-4 analytical paragraphs covering the key aspects of ${sectionTitle}
2. Use markdown formatting for clarity
3. Be specific with numbers, dates, and facts when available
4. Cite sources using inline references like [Source 1] or [Source 2]
5. Extract 3-5 key bullet points as takeaways
6. If relevant, include a table with key metrics (optional)

**Important:**
- Focus on investment-relevant insights
- Be objective and balanced (show both positives and negatives)
- Avoid generic statements; be specific
- If data is unavailable, note it clearly

Return strict JSON with this schema:
{
  "bodyMd": "Markdown content for the section (2-4 paragraphs)",
  "bullets": ["Key takeaway 1", "Key takeaway 2", "..."],
  "tables": [
    {
      "caption": "Optional table title",
      "headers": ["Column 1", "Column 2"],
      "rows": [["Data 1", "Data 2"], ["Data 3", "Data 4"]]
    }
  ]
}

The tables array is optional. Only include if you have structured data worth presenting in table format.`;
}

export function extractJSON(text: string): string | null {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : null;
}