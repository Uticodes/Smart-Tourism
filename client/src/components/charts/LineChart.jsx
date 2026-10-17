import { useMemo, useRef, useState } from 'react';
import useWidth from './useWidth.js';
import { compact, niceTicks, shortDay } from './scale.js';

const H = 220;            // plot height
const PAD = { top: 12, right: 16, bottom: 28, left: 36 };

/**
 * Multi-series line chart over days.
 * data: [{ day: 'YYYY-MM-DD', [series.key]: number }]; series: [{ key, label, color }]
 * 2px lines, one solid hairline grid, a crosshair that snaps to the nearest day and a tooltip
 * listing every series. Arrow keys move the crosshair when the chart has focus.
 */
export default function LineChart({ data, series }) {
  const [ref, width] = useWidth();
  const [index, setIndex] = useState(null);
  const svgRef = useRef(null);

  const plotW = width - PAD.left - PAD.right;
  const { max, ticks } = useMemo(() => niceTicks(Math.max(0, ...data.flatMap((d) => series.map((s) => d[s.key])))), [data, series]);
  const x = (i) => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v) => PAD.top + H - (v / max) * H;

  // Show at most ~6 date labels so they never collide.
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 90))));
  const xLabels = data.map((d, i) => i).filter((i) => i % labelEvery === 0 || i === data.length - 1)
    .filter((i, k, arr) => !(k === arr.length - 2 && arr[k + 1] - i < labelEvery * 0.6)); // drop the one crowding the last

  function pick(clientX) {
    const box = svgRef.current.getBoundingClientRect();
    const px = clientX - box.left - PAD.left;
    const i = Math.round((px / plotW) * (data.length - 1));
    setIndex(Math.min(data.length - 1, Math.max(0, i)));
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setIndex((i) => Math.min(data.length - 1, Math.max(0, (i ?? data.length - 1) + d)));
    } else if (e.key === 'Escape') setIndex(null);
  }

  const active = index == null ? null : data[index];
  const tipLeft = index == null ? 0 : x(index);
  const tipOnLeft = tipLeft > width * 0.6;

  return (
    <div ref={ref} className="relative">
      <svg ref={svgRef} width={width} height={H + PAD.top + PAD.bottom} role="img" tabIndex={0}
        aria-label={`Line chart, ${data.length} days. Use the left and right arrow keys to read each day.`}
        className="block touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-green-600"
        onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setIndex(null)} onPointerDown={(e) => pick(e.clientX)}
        onFocus={() => setIndex((i) => i ?? data.length - 1)} onBlur={() => setIndex(null)} onKeyDown={onKey}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={Math.round(y(t)) + 0.5} y2={Math.round(y(t)) + 0.5} stroke="#E6EBE8" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-granite-500 text-[11px] tabular-nums">{compact(t)}</text>
          </g>
        ))}
        {xLabels.map((i) => (
          <text key={i} x={x(i)} y={PAD.top + H + 18} textAnchor={i === 0 && data.length > 1 ? 'start' : i === data.length - 1 && data.length > 1 ? 'end' : 'middle'}
            className="fill-granite-500 text-[11px]">{shortDay(data[i].day)}</text>
        ))}

        {index != null && <line x1={x(index)} x2={x(index)} y1={PAD.top} y2={PAD.top + H} stroke="#78818A" strokeWidth="1" />}

        {series.map((s) => (
          <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
            points={data.map((d, i) => `${x(i)},${y(d[s.key])}`).join(' ')} />
        ))}

        {/* End dots (and the hovered day's dots), with a 2px ring in the surface colour. */}
        {series.map((s) => {
          const i = index ?? data.length - 1;
          return <circle key={s.key} cx={x(i)} cy={y(data[i][s.key])} r="4" fill={s.color} stroke="#FFFFFF" strokeWidth="2" />;
        })}
      </svg>

      {active && (
        <div role="status" className="pointer-events-none absolute top-1 z-10 min-w-40 rounded-md border border-granite-200 bg-surface px-3 py-2 text-sm shadow-md"
          style={tipOnLeft ? { right: width - tipLeft + 12 } : { left: tipLeft + 12 }}>
          <p className="text-granite-700">{shortDay(active.day)}</p>
          {series.map((s) => (
            <p key={s.key} className="mt-1 flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded-full" style={{ background: s.color }} />
              <span className="font-semibold tabular-nums text-granite-900">{active[s.key]}</span>
              <span className="text-granite-700">{s.label}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
