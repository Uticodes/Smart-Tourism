/**
 * Report-ready charts as SVG (and PNG via sharp), following one set of rules:
 * a single colour per chart (these are single-series), thin bars with a 4px rounded data-end,
 * hairline solid gridlines, values written at the bar tips in ink (never in the bar colour),
 * and target/benchmark lines dashed and labelled so they read as thresholds, not data.
 */
const INK = '#2B3036';
const INK2 = '#4A525B';
const MUTED = '#78818A';
const GRID = '#E6EBE8';
const BAR = '#0A7A4B';
const FONT = 'Helvetica, Arial, sans-serif';
const W = 800;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (x, y, s, { size = 13, fill = INK2, weight = 400, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

/** Bar from the baseline with a 4px rounded end on the far side only. */
function hbar(x, y, w, h, r = 4) {
  if (w <= 0) return '';
  if (w < r) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BAR}"/>`;
  return `<path d="M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z" fill="${BAR}"/>`;
}
function vbar(x, yBase, w, h, r = 4) {
  if (h <= 0) return '';
  if (h < r) return `<rect x="${x}" y="${yBase - h}" width="${w}" height="${h}" fill="${BAR}"/>`;
  return `<path d="M${x},${yBase} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${w - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z" fill="${BAR}"/>`;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * mag).find((m) => m >= v);
}
function ticks(max, n = 5, integer = false) {
  const step = integer ? Math.max(1, Math.ceil(niceMax(max / n))) : niceMax(max / n);
  const out = [];
  for (let t = 0; t <= max + 1e-9; t += step) out.push(Math.round(t * 1000) / 1000);
  return out;
}

const frame = (h, title, subtitle, body, note) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">
<rect width="${W}" height="${h}" fill="#FFFFFF"/>
${text(24, 34, title, { size: 19, fill: INK, weight: 700 })}
${subtitle ? text(24, 58, subtitle, { size: 13, fill: INK2 }) : ''}
${body}
${note ? text(24, h - 14, note, { size: 11, fill: MUTED }) : ''}
</svg>`;

/**
 * Horizontal bars. items: [{ label, value, display }]. ref: { value, label } draws a dashed threshold.
 */
function barChart({ title, subtitle, items, unit = '', max, ref, note, labelWidth = 200 }) {
  const top = 84, rowH = 40, barH = 18;
  const left = 24 + labelWidth, right = W - 120;
  const plotW = right - left;
  const integer = items.every((i) => Number.isInteger(i.value));
  const raw = Math.max(max ?? 0, ref?.value ?? 0, ...items.map((i) => i.value), integer ? 4 : 0);
  const xMax = integer ? Math.max(4, Math.ceil(niceMax(raw * 1.0001))) : niceMax(raw * 1.0001);
  const x = (v) => left + (v / xMax) * plotW;
  const h = top + items.length * rowH + 50 + (note ? 18 : 0);
  const axisY = top + items.length * rowH + 4;
  let body = '';
  for (const t of ticks(xMax, 5, integer)) {
    body += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 8}" y2="${axisY}" stroke="${GRID}" stroke-width="1"/>`;
    body += text(x(t), axisY + 18, `${t}${unit}`, { size: 11, fill: MUTED, anchor: 'middle' });
  }
  items.forEach((it, i) => {
    const y = top + i * rowH;
    body += text(24, y + barH / 2 + 5, it.label, { size: 13, fill: INK });
    body += hbar(left, y, x(it.value) - left, barH);
    body += text(x(it.value) + 8, y + barH / 2 + 5, it.display ?? `${it.value}${unit}`, { size: 13, fill: INK, weight: 700 });
  });
  if (ref) {
    body += `<line x1="${x(ref.value)}" x2="${x(ref.value)}" y1="${top - 14}" y2="${axisY}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    body += text(x(ref.value), top - 20, ref.label, { size: 12, fill: INK, weight: 700, anchor: 'middle' });
  }
  return frame(h, title, subtitle, body, note);
}

/**
 * Vertical columns. items: [{ label, value, display }]. refs: [{ at (index position, may be fractional), label }].
 */
function columnChart({ title, subtitle, items, refs = [], note, yLabel }) {
  const top = 96, plotH = 240, left = 64, right = W - 24;
  const plotW = right - left;
  const band = plotW / items.length;
  const colW = Math.min(48, band * 0.6);
  const yMax = Math.max(4, Math.ceil(niceMax(Math.max(1, ...items.map((i) => i.value)) * 1.1)));
  const base = top + plotH;
  const y = (v) => base - (v / yMax) * plotH;
  let body = '';
  for (const t of ticks(yMax, 4, true)) {
    body += `<line x1="${left}" x2="${right}" y1="${Math.round(y(t)) + 0.5}" y2="${Math.round(y(t)) + 0.5}" stroke="${GRID}" stroke-width="1"/>`;
    body += text(left - 8, y(t) + 4, t, { size: 11, fill: MUTED, anchor: 'end' });
  }
  if (yLabel) body += text(24, top - 14, yLabel, { size: 11, fill: MUTED });
  items.forEach((it, i) => {
    const cx = left + band * i + band / 2;
    body += vbar(cx - colW / 2, base, colW, base - y(it.value));
    if (it.value) body += text(cx, y(it.value) - 7, it.display ?? it.value, { size: 12, fill: INK, weight: 700, anchor: 'middle' });
    body += text(cx, base + 18, it.label, { size: 12, fill: INK2, anchor: 'middle' });
  });
  refs.forEach((r, k) => {
    const rx = left + band * r.at;
    body += `<line x1="${rx}" x2="${rx}" y1="${top - 4}" y2="${base}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    body += text(rx + (r.anchor === 'end' ? -6 : 6), top + 10 + k * 16, r.label, { size: 12, fill: INK, weight: 700, anchor: r.anchor || 'start' });
  });
  return frame(base + 52 + (note ? 10 : 0), title, subtitle, body, note);
}

async function save(svg, file) {
  const fs = require('fs');
  fs.writeFileSync(`${file}.svg`, svg);
  try {
    const sharp = require('sharp');
    await sharp(Buffer.from(svg), { density: 192 }).png().toFile(`${file}.png`);
  } catch (err) {
    console.warn(`  (PNG not written for ${file}: ${err.message})`);
  }
}

module.exports = { barChart, columnChart, save };
