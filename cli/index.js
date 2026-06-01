#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const pkg = require('../package.json');
const { resolveBinaries, assertBinaries, fileExecutable, PRODUCT_ROOT } = require('../core/paths');
const { detectEncoders } = require('../core/encoders');
const { loadConfig, mergeCliCompressFlags, DEFAULT_CONFIG_PATH } = require('../core/config');
const { compressOneVideo, buildOutputPath } = require('../core/compress-one');
const { runInbox } = require('../core/run-inbox');

const app = new Command();

app
  .name('shrinkvideo')
  .description('ShrinkVideo — local video compression (CLI)')
  .version(pkg.version, '-V, --version', 'Show version');

async function runDoctor(opts) {
  const payload = {
    status: 'fail',
    version: pkg.version,
    node: process.version,
    product_root: PRODUCT_ROOT,
    shrinkvideo_bin_dir: process.env.SHRINKVIDEO_BIN_DIR || null,
    ffmpeg: null,
    ffprobe: null,
    encoders: null,
    errors: [],
  };

  const nodeMajor = Number((process.versions.node || '0').split('.')[0]);
  if (nodeMajor < 20) {
    payload.errors.push('Node.js 20+ required');
  }

  let binaries;
  try {
    binaries = resolveBinaries();
    assertBinaries(binaries);
    payload.ffmpeg = binaries.ffmpeg;
    payload.ffprobe = binaries.ffprobe;
    payload.bin_source = binaries.source;
  } catch (err) {
    payload.errors.push(err.message);
    emitDoctor(payload, opts);
    process.exit(1);
  }

  try {
    payload.encoders = await detectEncoders(binaries.ffmpeg);
    payload.status = 'ok';
  } catch (err) {
    payload.errors.push(err.message);
  }

  emitDoctor(payload, opts);
  process.exit(payload.status === 'ok' ? 0 : 1);
}

function emitDoctor(payload, opts) {
  if (opts.json) {
    console.log(JSON.stringify(payload));
    return;
  }
  console.log('[shrinkvideo] doctor');
  console.log('  version:', payload.version);
  console.log('  node:', payload.node);
  console.log('  status:', payload.status);
  if (payload.ffmpeg) {
    console.log('  ffmpeg:', payload.ffmpeg);
    console.log('  ffprobe:', payload.ffprobe);
  }
  if (payload.encoders?.bestH265) {
    console.log('  best HEVC:', payload.encoders.bestH265.id);
  }
  for (const e of payload.errors) console.log('  error:', e);
}

app
  .command('doctor')
  .description('Check Node, ffmpeg paths, and encoders')
  .option('--json', 'Print JSON to stdout')
  .action(runDoctor);

app
  .command('encoders')
  .description('Detect best HEVC/AV1 encoders')
  .option('--json', 'Print JSON to stdout')
  .action(async (opts) => {
    try {
      const binaries = resolveBinaries();
      assertBinaries(binaries);
      const encoders = await detectEncoders(binaries.ffmpeg);
      if (opts.json) console.log(JSON.stringify(encoders));
      else {
        console.log('bestH265:', encoders.bestH265);
        console.log('bestAv1:', encoders.bestAv1);
      }
      process.exit(0);
    } catch (err) {
      if (opts.json) console.log(JSON.stringify({ error: err.message }));
      else console.error(err.message);
      process.exit(1);
    }
  });

app
  .command('compress')
  .description('Compress one video file')
  .requiredOption('-i, --input <path>', 'Input file (absolute path)')
  .option('-o, --output <path>', 'Output file')
  .option('--codec <codec>', 'Codec: auto|h265|av1|libx265|hevc_videotoolbox|...')
  .option('--quality <q>', 'best|balanced|smallest')
  .option('--resolution <scale>', 'e.g. 1920:-2')
  .option('--json', 'JSON result on stdout')
  .option('--config <path>', 'Config YAML path')
  .action(async (opts) => {
    try {
      const { config } = loadConfig(opts.config);
      const flags = mergeCliCompressFlags(config, opts);
      const input = path.resolve(opts.input);
      const output = opts.output
        ? path.resolve(opts.output)
        : buildOutputPath(
            input,
            path.dirname(input),
            flags.suffix
          );

      const advanced = config.advanced || {};
      const stateFile = advanced.state_file;
      const { loadState, saveState } = require('../core/inbox-state');
      const state = stateFile ? loadState(stateFile) : null;

      const result = await compressOneVideo({
        inputPath: input,
        outputPath: output,
        settings: {
          codec: opts.codec || flags.codec,
          quality: flags.quality,
          resolution: flags.resolution,
          overwrite: flags.overwrite,
        },
        advanced,
        state,
        stateFile,
      });

      const out = { ...result, status: result.status === 'skipped' ? 'ok' : result.status };
      if (opts.json) console.log(JSON.stringify(out));
      else {
        console.log(
          `[shrinkvideo] ${out.status} ${out.input} → ${out.output} (${(out.saved_ratio * 100).toFixed(1)}% saved)`
        );
      }
      process.exit(0);
    } catch (err) {
      if (opts.json) {
        console.log(
          JSON.stringify({ status: 'fail', error: err.message, cancelled: !!err.cancelled })
        );
      } else {
        console.error('[shrinkvideo] compress failed:', err.message);
      }
      process.exit(err.cancelled ? 3 : 2);
    }
  });

app
  .command('run-inbox')
  .description('Scan staging_dir and compress to output_dir')
  .option('--config <path>', 'Config path', DEFAULT_CONFIG_PATH)
  .option('--dry-run', 'List files only')
  .option('--continue-on-error', 'Continue on single file failure', true)
  .option('--no-continue-on-error', 'Stop on first failure')
  .option('--json-lines', 'One JSON object per line; final line is summary')
  .action(async (opts) => {
    const abort = new AbortController();
    const onSig = () => abort.abort();
    process.on('SIGINT', onSig);

    try {
      const { config } = loadConfig(opts.config);
      const continueOnError = opts.continueOnError !== false;
      const { results, summary } = await runInbox({
        config,
        dryRun: opts.dryRun,
        continueOnError,
        signal: abort.signal,
      });

      if (opts.jsonLines) {
        for (const r of results) console.log(JSON.stringify(r));
        console.log(JSON.stringify(summary));
      } else {
        for (const r of results) {
          console.log(`${r.status}\t${r.input || ''}\t${r.error || ''}`);
        }
        console.log(
          `summary: processed=${summary.processed} ok=${summary.ok} fail=${summary.fail}`
        );
      }

      process.removeListener('SIGINT', onSig);
      if (summary.fail > 0 && summary.ok === 0 && summary.skipped === 0) {
        process.exit(2);
      }
      if (summary.fail > 0) process.exit(4);
      process.exit(0);
    } catch (err) {
      process.removeListener('SIGINT', onSig);
      if (opts.jsonLines) {
        console.log(JSON.stringify({ status: 'fail', error: err.message }));
      } else {
        console.error('[shrinkvideo] run-inbox:', err.message);
      }
      process.exit(err.code === 'INBOX_DISABLED' ? 1 : 1);
    }
  });

app.parse(process.argv);

if (!process.argv.slice(2).length) {
  app.help();
}
