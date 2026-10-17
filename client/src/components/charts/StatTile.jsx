/** Label, one big number, and a line of context. Sentence-case label, no trailing colon. */
export default function StatTile({ label, value, sub, emphasis = false, className = '' }) {
  return (
    <div className={`rounded-lg border p-4 ${className} ${emphasis ? 'border-green-600 bg-green-50/60' : 'border-granite-200 bg-surface'}`}>
      <p className="text-sm font-semibold text-granite-700">{label}</p>
      <p className="mt-1 text-3xl font-bold leading-tight text-granite-900">{value}</p>
      {sub && <p className="mt-1 text-sm text-granite-700">{sub}</p>}
    </div>
  );
}
