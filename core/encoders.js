'use strict';

const os = require('os');
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const H265_CANDIDATES = [
  { id: 'hevc_videotoolbox', label: 'Apple VideoToolbox (M-Series)' },
  { id: 'hevc_nvenc', label: 'NVIDIA NVENC (GeForce RTX/GTX)' },
  { id: 'hevc_qsv', label: 'Intel Quick Sync (QSV)' },
  { id: 'hevc_amf', label: 'AMD AMF (Radeon/Ryzen)' },
];

const AV1_CANDIDATES = [
  { id: 'av1_nvenc', label: 'NVIDIA NVENC (RTX 4000+)' },
  { id: 'av1_qsv', label: 'Intel Quick Sync (Arc/Core Ultra)' },
  { id: 'av1_amf', label: 'AMD AMF (RX 7000/Ryzen 7040+)' },
  {
    id: 'libsvtav1',
    checkId: 'libsvtav1',
    hw: false,
    label: 'SVT-AV1 (Fast CPU)',
  },
];

function getCpuInfo() {
  const cpus = os.cpus();
  return cpus.length > 0 ? cpus[0].model : 'Unknown CPU';
}

async function testEncoder(ffmpegPath, encoder) {
  const nullOut = process.platform === 'win32' ? 'NUL' : '/dev/null';
  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-v',
        'error',
        '-f',
        'lavfi',
        '-i',
        'color=black:s=256x256:d=0.1',
        '-c:v',
        encoder,
        '-f',
        'null',
        nullOut,
      ],
      { timeout: 30000 }
    );
    return true;
  } catch {
    return false;
  }
}

async function detectEncoders(ffmpegPath) {
  const platform = process.platform;
  const cpuModel = getCpuInfo();

  let bestH265 = {
    id: 'libx265',
    label: 'Universal CPU (libx265)',
    hw: false,
  };
  let bestAv1 = {
    id: 'libaom-av1',
    label: 'Universal CPU (libaom-av1) - VERY SLOW',
    hw: false,
  };

  try {
    const encodersOut = execFileSync(ffmpegPath, ['-encoders']).toString();

    for (const c of H265_CANDIDATES) {
      if (encodersOut.includes(c.id) && (await testEncoder(ffmpegPath, c.id))) {
        bestH265 = { id: c.id, label: c.label, hw: true };
        break;
      }
    }

    for (const c of AV1_CANDIDATES) {
      const checkId = c.checkId || c.id;
      if (!encodersOut.includes(checkId)) continue;
      if (c.hw === false) {
        bestAv1 = { id: checkId, label: c.label, hw: false };
        break;
      }
      if (await testEncoder(ffmpegPath, c.id)) {
        bestAv1 = { id: c.id, label: c.label, hw: true };
        break;
      }
    }
  } catch (err) {
    return {
      platform,
      cpuModel,
      bestH265,
      bestAv1,
      error: err.message,
    };
  }

  return { platform, cpuModel, bestH265, bestAv1 };
}

function resolveCodecId(codecSetting, encoders) {
  const c = (codecSetting || 'auto').toLowerCase();
  if (c === 'auto') return encoders.bestH265.id;
  if (c === 'h265' || c === 'hevc') return encoders.bestH265.id;
  if (c === 'av1') return encoders.bestAv1.id;
  return codecSetting;
}

module.exports = {
  detectEncoders,
  testEncoder,
  resolveCodecId,
  getCpuInfo,
};
