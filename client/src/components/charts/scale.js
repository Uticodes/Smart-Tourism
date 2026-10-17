/** A "nice" axis maximum and ticks: 0 / 5 / 10 / 15 rather than 0 / 4.3 / 8.6. */
export function niceTicks(max, count = 4) {
  if (max <= 0) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const step2 = step < 1 ? 1 : step; // counts are whole numbers
  const top = Math.ceil(max / step2) * step2;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step2) ticks.push(Math.round(v * 100) / 100);
  return { max: top, ticks };
}

export const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : String(n));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-17" → "17 Oct" */
export const shortDay = (key) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;
