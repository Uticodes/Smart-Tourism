const fs = require('fs');
const path = require('path');
const env = require('../config/env');

/**
 * Append-only JSON-lines log for events that leave no database row.
 * Used for duplicate warnings (Section 3.2.6 pilot: "the number caught as duplicates"):
 * when the warning stops a report, nothing is saved in Site_Reports, so the catch is recorded here.
 * Logging never breaks a request.
 */
function file(name) {
  return path.join(env.eventLogDir, `${name}.jsonl`);
}

function append(name, event) {
  try {
    fs.mkdirSync(env.eventLogDir, { recursive: true });
    fs.appendFileSync(file(name), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
  } catch (err) {
    console.error(`[event-log] could not write ${name}:`, err.message);
  }
}

/** Events since a date (or all of them). Malformed lines are skipped. */
function read(name, since = null) {
  let text = '';
  try {
    text = fs.readFileSync(file(name), 'utf8');
  } catch {
    return [];
  }
  return text.split('\n').filter(Boolean).flatMap((line) => {
    try {
      const e = JSON.parse(line);
      return !since || new Date(e.at) >= since ? [e] : [];
    } catch {
      return [];
    }
  });
}

module.exports = { append, read };
