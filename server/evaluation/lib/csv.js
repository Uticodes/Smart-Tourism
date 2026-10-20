/** Minimal CSV reader/writer (quoted fields, commas and newlines inside quotes). Enough for Google Forms and our own exports. */
function parse(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((v) => v.trim() !== ''));
  const [header = [], ...body] = nonEmpty;
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
function stringify(header, rows) {
  return [header.map(cell).join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))].join('\n') + '\n';
}

module.exports = { parse, stringify };
