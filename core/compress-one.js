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
  buildOutputPath,
} = require('./video');
const { getFileRecord, setFileRecord, loadState, saveState } = require('./inbox-state');

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

  const inputSize = fs.statSync(input).size;
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

  const outputIncomplete =
    output && fs.existsSync(output) && !isOutputComplete(output, inputSize, adv);

  const needsRedo =
    outputIncomplete ||
    (record &&
      (record.status === 'failed' || record.status === 'running'));

  if (output && fs.existsSync(output)) {
    if (needsRedo) {
      safeUnlink(output);
    } else if (
      skipIfValid &&
      !overwrite &&
      isOutputComplete(output, inputSize, adv) &&
      record?.status === 'ok'
    ) {
      const outputSize = fs.statSync(output).size;
      return {
        status: 'skipped',
        input,
        output,
        input_bytes: inputSize,
        output_bytes: outputSize,
        saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
        codec: record.codec || codecId,
        message: 'Output exists and valid',
      };
    } else if (
      skipIfValid &&
      !overwrite &&
      isOutputComplete(output, inputSize, adv) &&
      !record
    ) {
      const outputSize = fs.statSync(output).size;
      if (state) {
        setFileRecord(state, input, {
          status: 'ok',
          output,
          codec: codecId,
        });
        if (stateFile) saveState(stateFile, state);
      }
      return {
        status: 'skipped',
        input,
        output,
        input_bytes: inputSize,
        output_bytes: outputSize,
        saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
        codec: codecId,
        message: 'Output exists and valid (no state)',
      };
    } else if (!overwrite && isOutputComplete(output, inputSize, adv)) {
      const outputSize = fs.statSync(output).size;
      return {
        status: 'skipped',
        input,
        output,
        input_bytes: inputSize,
        output_bytes: outputSize,
        saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
        codec: codecId,
        message: 'Output exists',
      };
    } else if (!overwrite && fs.existsSync(output)) {
      safeUnlink(output);
    }
  }

  if (!output) {
    throw new Error('output path required');
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });

  if (state) {
    setFileRecord(state, input, { status: 'running', output, codec: codecId });
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
        });
        if (stateFile) saveState(stateFile, state);
      }
      const err = new Error('Output file incomplete or too small');
      err.code = 'INCOMPLETE';
      throw err;
    }

    if (state) {
      setFileRecord(state, input, { status: 'ok', output, codec: codecId });
      if (stateFile) saveState(stateFile, state);
    }

    return {
      status: 'ok',
      input,
      output,
      input_bytes: inputSize,
      output_bytes: outputSize,
      saved_ratio: inputSize ? 1 - outputSize / inputSize : 0,
      elapsed_sec,
      codec: codecId,
    };
  } catch (err) {
    safeUnlink(output);
    if (state) {
      setFileRecord(state, input, {
        status: 'failed',
        output,
        error: err.message,
      });
      if (stateFile) saveState(stateFile, state);
    }
    throw err;
  }
}

module.exports = {
  compressOneVideo,
  buildOutputPath,
};
