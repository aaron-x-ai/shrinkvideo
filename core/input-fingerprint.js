'use strict';

const fs = require('fs');

/**
 * Identify "same path, same file" vs "same filename, new copy".
 * Uses size + mtime (fast; good enough when user re-copies into staging).
 */
function statInputFingerprint(inputPath) {
  const st = fs.statSync(inputPath);
  return {
    input_bytes: st.size,
    input_mtime_ms: Math.floor(st.mtimeMs),
  };
}

function fingerprintMatches(record, fp) {
  if (!record) return false;
  const hasMeta =
    record.input_bytes != null || record.input_mtime_ms != null;
  if (!hasMeta) return false;

  if (record.input_bytes != null && record.input_bytes !== fp.input_bytes) {
    return false;
  }
  if (
    record.input_mtime_ms != null &&
    record.input_mtime_ms !== fp.input_mtime_ms
  ) {
    return false;
  }
  return true;
}

/** Prior successful encode was for a different bytes/mtime at this path. */
function sourceChangedSinceRecord(record, fp) {
  if (!record || record.status !== 'ok') return false;
  const hasMeta =
    record.input_bytes != null || record.input_mtime_ms != null;
  if (!hasMeta) return false;
  return !fingerprintMatches(record, fp);
}

/** No state: input copied/edited after the _shr was written. */
function inputNewerThanOutput(inputPath, outputPath, toleranceMs = 1000) {
  if (!fs.existsSync(outputPath)) return false;
  const inMs = fs.statSync(inputPath).mtimeMs;
  const outMs = fs.statSync(outputPath).mtimeMs;
  return inMs > outMs + toleranceMs;
}

module.exports = {
  statInputFingerprint,
  fingerprintMatches,
  sourceChangedSinceRecord,
  inputNewerThanOutput,
};
