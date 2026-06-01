'use strict';

const { execFileSync } = require('child_process');

const DATETIME_TAG_KEYS = [
  'creation_time',
  'com.apple.quicktime.creationdate',
  'com.apple.quicktime.creationdate.local',
  'date',
  'DATE',
  'creation_date',
];

/**
 * Format Date as 20240531_143022 (local timezone).
 */
function formatDatetimeLocal(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}_${h}${min}${s}`;
}

function parseTagToDate(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // QuickTime sometimes: 2024-05-31T14:30:22+0800
  const normalized = trimmed.replace(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})([+-]\d{2})(\d{2})$/,
    '$1$2:$3'
  );

  const ms = Date.parse(normalized);
  if (!Number.isNaN(ms)) return new Date(ms);

  // 2024:05:31 14:30:22 (some ffmpeg tags)
  const alt = trimmed.replace(
    /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/,
    '$1-$2-$3T$4:$5:$6'
  );
  const ms2 = Date.parse(alt);
  if (!Number.isNaN(ms2)) return new Date(ms2);

  return null;
}

function collectTagsFromProbeJson(data) {
  const tags = {};
  if (data?.format?.tags) Object.assign(tags, data.format.tags);
  const streams = data?.streams || [];
  for (const s of streams) {
    if (s.codec_type === 'video' && s.tags) {
      Object.assign(tags, s.tags);
      break;
    }
  }
  return tags;
}

function pickDatetimeFromTags(tags) {
  for (const key of DATETIME_TAG_KEYS) {
    if (tags[key]) {
      const d = parseTagToDate(tags[key]);
      if (d) return formatDatetimeLocal(d);
    }
  }
  for (const [key, val] of Object.entries(tags)) {
    if (/creation|date/i.test(key)) {
      const d = parseTagToDate(val);
      if (d) return formatDatetimeLocal(d);
    }
  }
  return null;
}

/**
 * Read shooting/creation time via ffprobe. Returns e.g. 20240531_143022 or null.
 */
function readVideoDatetime(ffprobePath, inputPath) {
  try {
    const raw = execFileSync(
      ffprobePath,
      [
        '-v',
        'quiet',
        '-show_entries',
        'format_tags:stream_tags',
        '-select_streams',
        'v:0',
        '-of',
        'json',
        inputPath,
      ],
      { encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024 }
    );
    const data = JSON.parse(raw);
    const tags = collectTagsFromProbeJson(data);
    return pickDatetimeFromTags(tags);
  } catch {
    return null;
  }
}

module.exports = {
  formatDatetimeLocal,
  readVideoDatetime,
  DATETIME_TAG_KEYS,
};
