import { useState } from 'react';

/**
 * Horizontal bars for comparing a handful of named values (one series → one colour).
 * Bars are 16px thick with a 4px rounded end, square at the baseline; the value sits at the tip.
 * Hovering or focusing a row lifts the bar and shows its share of the total.
 */
export default function BarList({ items, color = '#0A7A4B', valueLabel = (v) => v, empty = 'No data yet.' }) {
  const [hover, setHover] = useState(null);
  if (!items.length || items.every((i) => !i.value)) {
    return <p className="rounded-md border border-dashed border-granite-200 px-4 py-6 text-sm text-granite-500">{empty}</p>;
  }
  const max = Math.max(...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => {
        const pct = max ? (item.value / max) * 100 : 0;
        return (
          <li key={item.label} tabIndex={0} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            className="grid grid-cols-[minmax(6rem,9rem)_1fr] items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-green-600"
            aria-label={`${item.label}: ${valueLabel(item.value)}`}>
            <span className="truncate text-sm text-granite-700" title={item.label}>{item.label}</span>
            <span className="flex items-center gap-2">
              <span className="relative h-4 flex-1">
                <span className="absolute inset-y-0 left-0 rounded-r transition-opacity"
                  style={{ width: `max(${pct}%, ${item.value ? 2 : 0}px)`, background: color, opacity: hover == null || hover === i ? 1 : 0.45 }} />
              </span>
              <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-granite-900">
                {valueLabel(item.value)}
                {hover === i && total > 0 && <span className="ml-1 font-normal text-granite-500">{Math.round((item.value / total) * 100)}%</span>}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
