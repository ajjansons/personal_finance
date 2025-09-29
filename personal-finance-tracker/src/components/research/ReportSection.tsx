import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReportSection as ReportSectionType } from '@/features/research/types';

type ReportSectionProps = {
  section: ReportSectionType;
};

export default function ReportSection({ section }: ReportSectionProps) {
  return (
    <section id={section.id} className="scroll-mt-8 space-y-4">
      <h2 className="text-2xl font-semibold text-slate-100 gradient-text">
        {section.title}
      </h2>

      {/* Markdown body */}
      <div className="prose prose-invert prose-slate max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Custom styling for markdown elements
            h3: ({ children, ...props }) => (
              <h3 className="text-xl font-semibold text-slate-200 mt-6 mb-3" {...props}>
                {children}
              </h3>
            ),
            h4: ({ children, ...props }) => (
              <h4 className="text-lg font-semibold text-slate-300 mt-4 mb-2" {...props}>
                {children}
              </h4>
            ),
            p: ({ children, ...props }) => (
              <p className="text-slate-300 leading-relaxed mb-4" {...props}>
                {children}
              </p>
            ),
            a: ({ children, href, ...props }) => (
              <a
                href={href}
                className="text-emerald-400 hover:text-emerald-300 underline"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            ),
            ul: ({ children, ...props }) => (
              <ul className="list-disc list-inside space-y-1 text-slate-300 mb-4" {...props}>
                {children}
              </ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="list-decimal list-inside space-y-1 text-slate-300 mb-4" {...props}>
                {children}
              </ol>
            ),
            code: ({ children, ...props }) => (
              <code
                className="bg-slate-800 text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote
                className="border-l-4 border-slate-600 pl-4 italic text-slate-400 my-4"
                {...props}
              >
                {children}
              </blockquote>
            )
          }}
        >
          {section.bodyMd}
        </ReactMarkdown>
      </div>

      {/* Key bullets */}
      {section.bullets && section.bullets.length > 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-slate-100 mb-3">Key Takeaways</h3>
          <ul className="space-y-2">
            {section.bullets.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-emerald-400 mt-1">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tables */}
      {section.tables && section.tables.length > 0 && (
        <div className="space-y-4">
          {section.tables.map((table) => (
            <div key={table.id} className="overflow-x-auto">
              {table.caption && (
                <div className="text-sm font-semibold text-slate-300 mb-2">{table.caption}</div>
              )}
              <table className="w-full border-collapse rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-800">
                    {table.headers.map((header, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-100 uppercase tracking-wider border-b border-slate-700"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={rowIdx % 2 === 0 ? 'bg-slate-900/40' : 'bg-slate-900/60'}
                    >
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-4 py-3 text-sm text-slate-300 border-b border-slate-700/50"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}