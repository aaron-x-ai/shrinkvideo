'use strict';

const fs = require('fs');
const path = require('path');
const { resolveBinaries, assertBinaries } = require('./paths');
const { detectEncoders } = require('./encoders');
const { loadState, saveState } = require('./inbox-state');
const { listInboxVideos, buildOutputPath } = require('./video');
const { compressOneVideo } = require('./compress-one');

async function runInbox({
  config,
  dryRun = false,
  continueOnError = true,
  signal,
}) {
  const inbox = config.inbox || {};
  if (!inbox.enabled) {
    const err = new Error('inbox.enabled is false');
    err.code = 'INBOX_DISABLED';
    throw err;
  }

  const stagingDir = inbox.staging_dir;
  const outputDir = inbox.output_dir;
  if (!stagingDir || !outputDir) {
    const err = new Error('inbox.staging_dir and inbox.output_dir are required');
    err.code = 'EINVAL';
    throw err;
  }

  fs.mkdirSync(stagingDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const binaries = resolveBinaries({ binDir: config.bin?.dir });
  assertBinaries(binaries);

  const encoders = await detectEncoders(binaries.ffmpeg);
  const defaults = config.defaults || {};
  const advanced = config.advanced || {};
  const stateFile = advanced.state_file;
  const state = stateFile ? loadState(stateFile) : null;

  const inputs = listInboxVideos(stagingDir, {
    glob: inbox.glob,
    include_subdirs: inbox.include_subdirs,
  });

  const settings = {
    codec: defaults.codec,
    quality: defaults.quality,
    resolution: defaults.resolution,
    suffix: defaults.suffix,
    overwrite: defaults.overwrite,
    signal,
  };

  const results = [];
  let ok = 0;
  let fail = 0;
  let skipped = 0;
  let totalInput = 0;
  let totalOutput = 0;

  for (const inputPath of inputs) {
    const outputPath = buildOutputPath(inputPath, outputDir, settings.suffix);

    if (dryRun) {
      results.push({
        status: 'dry-run',
        kind: 'file',
        input: inputPath,
        output: outputPath,
      });
      continue;
    }

    const lineBase = { kind: 'file', input: inputPath, output: outputPath };

    try {
      const result = await compressOneVideo({
        inputPath,
        outputPath,
        settings,
        binaries,
        encoders,
        advanced,
        state,
        stateFile,
        skipIfValid: !settings.overwrite,
      });

      if (result.status === 'skipped') skipped += 1;
      else ok += 1;

      totalInput += result.input_bytes;
      totalOutput += result.output_bytes;

      results.push({
        ...lineBase,
        status: result.status === 'skipped' ? 'skipped' : 'ok',
        input_bytes: result.input_bytes,
        output_bytes: result.output_bytes,
        saved_ratio: result.saved_ratio,
        elapsed_sec: result.elapsed_sec,
        codec: result.codec,
        message: result.message,
      });

      if (result.status === 'ok') {
        applyAfterSuccess(inputPath, stagingDir, inbox);
      }
    } catch (err) {
      fail += 1;
      results.push({
        ...lineBase,
        status: 'fail',
        error: err.message,
      });
      if (!continueOnError && (inbox.continue_on_error === false)) {
        break;
      }
    }
  }

  const processed = dryRun ? inputs.length : ok + fail + skipped;
  const total_saved_ratio =
    totalInput > 0 ? 1 - totalOutput / totalInput : 0;

  const summary = {
    status: fail > 0 ? 'partial' : 'ok',
    kind: 'summary',
    processed,
    ok,
    fail,
    skipped,
    staging_dir: stagingDir,
    output_dir: outputDir,
    total_saved_ratio: Math.round(total_saved_ratio * 1000) / 1000,
  };

  if (fail > 0 && ok === 0 && skipped === 0) summary.status = 'fail';

  return { results, summary, encoders };
}

function applyAfterSuccess(inputPath, stagingDir, inbox) {
  const mode = inbox.after_success || 'keep';
  if (mode === 'keep') return;

  if (mode === 'archive') {
    const sub = inbox.archive_subdir || '.processed';
    const destDir = path.join(stagingDir, sub);
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, path.basename(inputPath));
    fs.renameSync(inputPath, dest);
    return;
  }

  if (mode === 'delete') {
    fs.unlinkSync(inputPath);
  }
}

module.exports = { runInbox };
