'use strict';

const fs = require('fs');
const path = require('path');
const { resolveBinaries, assertBinaries } = require('./paths');
const { detectEncoders, resolveCodecId } = require('./encoders');
const {
  buildVideoArgs,
  runVideoJob,
  isOutputComplete,
  safeUnlink,
} = require('./video');
const { resolveOutputPath } = require('./naming');
const { getFileRecord, setFileRecord, saveState } = require('./inbox-state');
const { appendHistory } = require('./history');
const {
  statInputFingerprint,
  fingerprintMatches,
  sourceChangedSinceRecord,
  inputNewerThanOutput,
} = require('./input-fingerprint');

function logHistory(advanced, entry) {
  try {
    appendHistory(advanced, entry);
  } catch {
    /* history must not break compress */
  }
}

function recordOkFields(input, fp, extra = {}) {
  return {
    status: 'ok',
    output: extra.output,
    codec: extra.codec,
    input_bytes: fp.input_bytes,
    input_mtime_ms: fp.input_mtime_ms,
    output_bytes: extra.output_bytes,
    saved_ratio: extra.saved_ratio,
    elapsed_sec: extra.elapsed_sec,
  };
}

async function compressOneVideo({
  inputPath,
  outputPath,
  settings,
  binaries,
  encoders,
  advanced,
  state,
  stateFile,
  skipIfValid = true,
}) {
  const input = path.resolve(inputPath);
  let output = outputPath ? path.resolve(outputPath) : null;

  if (!fs.existsSync(input)) {
    const err = new Error(`Input file not found: ${input}`);
    err.code = 'ENOENT';
    throw err;
  }

  const fp = statInputFingerprint(input);
  const inputSize = fp.input_bytes;
  const adv = advanced || {};

  if (!binaries) {
    binaries = resolveBinaries({ binDir: settings?.binDir });
    assertBinaries(binaries);
  }
  if (!encoders) {
    encoders = await detectEncoders(binaries.ffmpeg);
  }

  const codecId = resolveCodecId(settings.codec, encoders);
  const overwrite = settings.overwrite === true;

  const record = state ? getFileRecord(state, input) : null;

  const outputExists = output && fs.existsSync(output);
  const outputComplete =
    outputExists && isOutputComplete(output, inputSize, adv);
  const outputIncomplete = outputExists && !outputComplete;

  const changedSource = sourceChangedSinceRecord(record, fp);
  const newerInput =
    outputExists && inputNewerThanOutput(input, output);

  const recordOutputGone =
    record?.status === 'ok' &&
    record.output &&
    !fs.existsSync(record.output);
  const staleOkNoOutput =
    record?.status === 'ok' && !outputExists;

  const needsRedo =
    outputIncomplete ||
    changedSource ||
    newerInput ||
    recordOutputGone ||
    staleOkNoOutput ||
    (record && (record.status === 'failed' || record.status === 'running'));

  if (outputExists && needsRedo) {
    safeUnlink(output);
    output = path.resolve(outputPath);
  }

  const canSkip =
    skipIfValid &&
    !overwrite &&
    outputComplete &&
    !needsRedo &&
    fingerprintMatches(record, fp) &&
    record?.status === 'ok';

  if (canSkip) {
    const outputSize = fs.statSync(output).size;
    const skipped = {
      status: 'skipped',
      input,
      output,
      input_bytes: inputSize,
      output_bytes: outputSize,
      saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
      codec: record.codec || codecId,
      message: 'Output exists; source unchanged (size+mtime)',
    };
    logHistory(adv, skipped);
    return skipped;
  }

  if (
    skipIfValid &&
    !overwrite &&
    outputComplete &&
    !needsRedo &&
    !record
  ) {
    const outputSize = fs.statSync(output).size;
    if (state) {
      setFileRecord(
        state,
        input,
        recordOkFields(input, fp, {
          output,
          codec: codecId,
          output_bytes: outputSize,
          saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
        })
      );
      if (stateFile) saveState(stateFile, state);
    }
    const skipped = {
      status: 'skipped',
      input,
      output,
      input_bytes: inputSize,
      output_bytes: outputSize,
      saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
      codec: codecId,
      message: 'Output exists and valid (no prior state)',
    };
    logHistory(adv, skipped);
    return skipped;
  }

  if (!output) {
    throw new Error('output path required');
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });

  if (state) {
    setFileRecord(state, input, {
      status: 'running',
      output,
      codec: codecId,
      input_bytes: fp.input_bytes,
      input_mtime_ms: fp.input_mtime_ms,
    });
    if (stateFile) saveState(stateFile, state);
  }

  const encodeSettings = {
    codec: codecId,
    quality: settings.quality,
    resolution: settings.resolution,
    crf: settings.crf,
    preset: settings.preset,
    presetIndex: settings.presetIndex,
  };

  const args = buildVideoArgs(input, output, encodeSettings);
  const redoReason = changedSource
    ? 'source file changed (size/mtime)'
    : newerInput
      ? 'source newer than output'
      : null;

  try {
    const { elapsed_sec } = await runVideoJob(binaries.ffmpeg, args, {
      signal: settings.signal,
    });
    const outputSize = fs.existsSync(output) ? fs.statSync(output).size : 0;

    if (!isOutputComplete(output, inputSize, adv)) {
      safeUnlink(output);
      if (state) {
        setFileRecord(state, input, {
          status: 'failed',
          output,
          error: 'Output too small',
          input_bytes: fp.input_bytes,
          input_mtime_ms: fp.input_mtime_ms,
        });
        if (stateFile) saveState(stateFile, state);
      }
      const err = new Error('Output file incomplete or too small');
      err.code = 'INCOMPLETE';
      throw err;
    }

    const okPayload = {
      status: 'ok',
      input,
      output,
      input_bytes: inputSize,
      output_bytes: outputSize,
      saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
      elapsed_sec,
      codec: codecId,
      message: redoReason || undefined,
    };

    if (state) {
      setFileRecord(
        state,
        input,
        recordOkFields(input, fp, {
          output,
          codec: codecId,
          output_bytes: outputSize,
          saved_ratio: okPayload.saved_ratio,
          elapsed_sec,
        })
      );
      if (stateFile) saveState(stateFile, state);
    }

    logHistory(adv, okPayload);
    return okPayload;
  } catch (err) {
    safeUnlink(output);
    if (state) {
      setFileRecord(state, input, {
        status: 'failed',
        output,
        error: err.message,
        input_bytes: fp.input_bytes,
        input_mtime_ms: fp.input_mtime_ms,
      });
      if (stateFile) saveState(stateFile, state);
    }
    logHistory(adv, {
      status: 'failed',
      input,
      output,
      input_bytes: inputSize,
      error: err.message,
    });
    throw err;
  }
}

module.exports = {
  compressOneVideo,
  resolveOutputPath,
};
