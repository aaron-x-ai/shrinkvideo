'use strict';

const fs = require('fs');
const path = require('path');

const PRODUCT_ROOT = path.resolve(__dirname, '..');

function fileExecutable(p) {
  try {
    return fs.existsSync(p) && fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve ffmpeg/ffprobe paths.
 * Priority: SHRINKVIDEO_FFMPEG + SHRINKVIDEO_FFPROBE > SHRINKVIDEO_BIN_DIR > product bin/ > env from config
 */
function resolveBinaries(options = {}) {
  const binDirFromConfig = options.binDir || null;
  const candidates = [];

  if (process.env.SHRINKVIDEO_FFMPEG) {
    const ffmpeg = process.env.SHRINKVIDEO_FFMPEG;
    const ffprobe =
      process.env.SHRINKVIDEO_FFPROBE ||
      path.join(path.dirname(ffmpeg), 'ffprobe');
    return { ffmpeg, ffprobe, projectDir: PRODUCT_ROOT, source: 'env-ffmpeg' };
  }

  const binDirs = [
    process.env.SHRINKVIDEO_BIN_DIR,
    binDirFromConfig,
    path.join(PRODUCT_ROOT, 'bin'),
  ].filter(Boolean);

  for (const dir of binDirs) {
    const resolved = path.resolve(dir);
    candidates.push({
      ffmpeg: path.join(resolved, 'ffmpeg'),
      ffprobe: path.join(resolved, 'ffprobe'),
      projectDir: PRODUCT_ROOT,
      source: `bin-dir:${resolved}`,
    });
  }

  for (const c of candidates) {
    if (fileExecutable(c.ffmpeg) && fileExecutable(c.ffprobe)) {
      return c;
    }
  }

  const first = candidates[0] || {
    ffmpeg: path.join(PRODUCT_ROOT, 'bin', 'ffmpeg'),
    ffprobe: path.join(PRODUCT_ROOT, 'bin', 'ffprobe'),
    projectDir: PRODUCT_ROOT,
    source: 'default',
  };

  return first;
}

function assertBinaries(bin) {
  const missing = [];
  if (!fileExecutable(bin.ffmpeg)) missing.push(bin.ffmpeg);
  if (!fileExecutable(bin.ffprobe)) missing.push(bin.ffprobe);
  if (missing.length) {
    const err = new Error(
      `ffmpeg/ffprobe not found. Run: bash scripts/download_ffmpeg_macos.sh\nMissing: ${missing.join(', ')}`
    );
    err.code = 'ENOENT';
    err.missing = missing;
    throw err;
  }
}

module.exports = {
  PRODUCT_ROOT,
  resolveBinaries,
  assertBinaries,
  fileExecutable,
};
