import { useState } from 'react';

/**
 * Card around every chart: title, one-line description, an optional legend,
 * and a "Show as table" switch: the accessible twin of the chart.
 */
export default function ChartCard({ title, description, legend, table, children, className = '' }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className={`rounded-lg border border-granite-200 bg-surface p-5 ${className}`}>
      <figcaption className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-lg">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-granite-700">{description}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}
            className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-granite-700 ring-1 ring-granite-200 hover:bg-granite-100">
            {asTable ? 'Show chart' : 'Show as table'}
          </button>
        )}
      </figcaption>
      {legend && !asTable && <div className="mt-3">{legend}</div>}
      <div className="mt-4">{asTable ? table : children}</div>
    </figure>
  );
}

/** Legend entries keyed by a short line in the series colour; the text stays in ink. */
export function LineLegend({ series }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-granite-700">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({ columns, rows }) {
  return (
    <div className="max-h-80 overflow-auto rounded-md ring-1 ring-granite-200">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-granite-100 text-granite-700">
          <tr>{columns.map((c) => <th key={c.key} className={`px-3 py-2 font-semibold ${c.numeric ? 'text-right' : ''}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-granite-100">
              {columns.map((c) => <td key={c.key} className={`px-3 py-1.5 ${c.numeric ? 'text-right tabular-nums' : ''}`}>{r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
