'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const QUALITY_PRESETS = {
  best: { crf: 18 },
  balanced: { crf: 22 },
  smallest: { crf: 28 },
};

const PRESET_NAMES = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
];

const DEFAULT_PRESET_INDEX = 5;

function qualityToCrf(quality) {
  const q = QUALITY_PRESETS[quality] || QUALITY_PRESETS.balanced;
  return q.crf;
}

/**
 * Build ffmpeg argument list for video encode (from ShrinkMaster main.js).
 */
function buildVideoArgs(inputPath, outputPath, settings = {}) {
  const codec = settings.codec || 'libx265';
  const crf =
    settings.crf !== undefined
      ? settings.crf
      : qualityToCrf(settings.quality || 'balanced');
  const presetIndex =
    settings.presetIndex !== undefined
      ? settings.presetIndex
      : DEFAULT_PRESET_INDEX;
  const preset =
    settings.preset || PRESET_NAMES[presetIndex] || PRESET_NAMES[DEFAULT_PRESET_INDEX];
  const resolution = settings.resolution;

  const args = ['-y', '-i', inputPath, '-c:a', 'copy', '-c:v', codec];

  if (codec.includes('hevc') || codec === 'libx265') {
    args.push('-vtag', 'hvc1');
  }

  if (codec === 'libaom-av1') {
    args.push('-crf', String(crf));
    const cpuUsed = Math.max(0, 8 - presetIndex);
    args.push('-b:v', '0', '-cpu-used', String(cpuUsed));
  } else if (codec === 'libsvtav1') {
    args.push('-crf', String(crf));
    const svtPreset = Math.max(0, 12 - presetIndex);
    args.push('-preset', String(svtPreset));
  } else if (codec === 'hevc_videotoolbox') {
    const quality = Math.max(1, Math.min(100, 100 - crf * 2));
    args.push('-q:v', String(quality));
  } else if (codec.includes('nvenc')) {
    args.push('-cq', String(crf), '-b:v', '0');
    if (preset) args.push('-preset', preset);
  } else if (codec.includes('qsv')) {
    args.push('-global_quality', String(crf));
    if (preset) args.push('-preset', preset);
  } else if (codec.includes('amf')) {
    const qp = String(crf);
    args.push('-rc', 'cqp', '-qp_i', qp, '-qp_p', qp);
  } else {
    args.push('-crf', String(crf));
    if (preset) args.push('-preset', preset);
  }

  if (resolution) {
    args.push('-vf', `scale=${resolution}`);
  }

  args.push('-progress', 'pipe:1');
  args.push(outputPath);
  return args;
}

function runVideoJob(ffmpegPath, args, { signal, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let progressBuffer = '';
    let stderr = '';

    const onAbort = () => {
      proc.kill('SIGTERM');
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      progressBuffer += text;
      const lines = progressBuffer.split('\n');
      progressBuffer = lines.pop() || '';
      const progressData = {};
      for (const line of lines) {
        const eqIdx = line.indexOf('=');
        if (eqIdx !== -1) {
          progressData[line.substring(0, eqIdx).trim()] = line
            .substring(eqIdx + 1)
            .trim();
        }
      }
      if (onProgress && (progressData.out_time_us || progressData.progress)) {
        onProgress(progressData);
      }
    });

    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('error', (err) => reject(err));

    proc.on('close', (code) => {
      const elapsed_sec = (Date.now() - startTime) / 1000;
      if (signal?.aborted) {
        const err = new Error('Cancelled');
        err.cancelled = true;
        reject(err);
        return;
      }
      if (code === 0) {
        resolve({ code, elapsed_sec, stderr });
      } else {
        const err = new Error(`ffmpeg exited with code ${code}`);
        err.code = code;
        err.stderr = stderr;
        reject(err);
      }
    });
  });
}

function isOutputComplete(outputPath, inputSize, advanced = {}) {
  if (!fs.existsSync(outputPath)) return false;
  const minBytes = advanced.min_output_bytes ?? 65536;
  const minRatio = advanced.min_output_ratio ?? 0.01;
  const outSize = fs.statSync(outputPath).size;
  if (outSize < minBytes) return false;
  if (inputSize > 0 && outSize < inputSize * minRatio) return false;
  return true;
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

function buildOutputPath(inputPath, outputDir, suffix) {
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const suf = suffix || '_shr';
  return path.join(outputDir, `${base}${suf}${ext}`);
}

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.webm',
  '.m4v',
  '.ts',
  '.mts',
  '.flv',
  '.wmv',
]);

function parseGlobExtensions(glob) {
  const m = glob && glob.match(/\{([^}]+)\}/);
  if (m) {
    return m[1].split(',').map((e) => e.trim().replace(/^\*\.?/, '.').toLowerCase());
  }
  return [...VIDEO_EXTENSIONS].map((e) => e.slice(1));
}

function listInboxVideos(stagingDir, { glob, include_subdirs } = {}) {
  if (!fs.existsSync(stagingDir)) return [];
  const exts = new Set(
    parseGlobExtensions(glob).map((e) => (e.startsWith('.') ? e : `.${e}`).toLowerCase())
  );

  const files = [];
  const walk = (dir, depth) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (include_subdirs) walk(full, depth + 1);
        continue;
      }
      if (!ent.isFile()) continue;
      const ext = path.extname(ent.name).toLowerCase();
      if (exts.has(ext)) files.push(full);
    }
  };

  walk(stagingDir, 0);
  return files.sort();
}

module.exports = {
  QUALITY_PRESETS,
  PRESET_NAMES,
  qualityToCrf,
  buildVideoArgs,
  runVideoJob,
  isOutputComplete,
  safeUnlink,
  buildOutputPath,
  listInboxVideos,
  VIDEO_EXTENSIONS,
};
