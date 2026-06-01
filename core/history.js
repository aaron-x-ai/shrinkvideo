'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function resolveHistoryPath(advanced = {}) {
  const raw =
    advanced.history_file ||
    path.join(os.homedir(), '.config', 'shrinkvideo', 'compress-history.jsonl');
  if (raw.startsWith('~/')) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return raw;
}

/**
 * Append one compression event (JSON Lines). Human-readable line goes to sibling .log
 */
function appendHistory(advanced, entry) {
  const jsonlPath = resolveHistoryPath(advanced);
  const dir = path.dirname(jsonlPath);
  fs.mkdirSync(dir, { recursive: true });

  const row = {
    ts: new Date().toISOString(),
    ...entry,
  };
  fs.appendFileSync(jsonlPath, `${JSON.stringify(row)}\n`, 'utf8');

  const logPath = jsonlPath.replace(/\.jsonl$/i, '.log');
  const human = formatHumanLine(row);
  fs.appendFileSync(logPath, `${human}\n`, 'utf8');

  return { jsonlPath, logPath };
}

function formatHumanLine(row) {
  const ts = row.ts.replace('T', ' ').replace(/\.\d{3}Z$/, 'Z');
  const name = path.basename(row.input || '?');
  const outName = row.output ? path.basename(row.output) : '—';
  const pct =
    row.saved_ratio != null
      ? `${(row.saved_ratio * 100).toFixed(1)}% saved`
      : '';
  const extra = row.message || row.error || '';
  return `[${ts}] ${row.status}\t${name} → ${outName}\t${pct}\t${extra}`.trim();
}

function readHistory(advanced, { tail = 20 } = {}) {
  const jsonlPath = resolveHistoryPath(advanced);
  if (!fs.existsSync(jsonlPath)) {
    return { path: jsonlPath, lines: [] };
  }
  const all = fs
    .readFileSync(jsonlPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  const n = Math.max(1, tail);
  return { path: jsonlPath, lines: all.slice(-n) };
}

module.exports = {
  resolveHistoryPath,
  appendHistory,
  formatHumanLine,
  readHistory,
};
