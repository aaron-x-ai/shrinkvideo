#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const pkg = require('../package.json');
const { resolveBinaries, assertBinaries, fileExecutable, PRODUCT_ROOT } = require('../core/paths');
const { detectEncoders } = require('../core/encoders');
const {
  loadConfig,
  mergeCliCompressFlags,
  DEFAULT_CONFIG_PATH,
  expandHome,
} = require('../core/config');
const { compressOneVideo } = require('../core/compress-one');
const { resolveOutputPath } = require('../core/naming');
const { runInbox } = require('../core/run-inbox');
const { readHistory, formatHumanLine } = require('../core/history');
const {
  getSetupStatus,
  saveInboxSetup,
  runInteractiveSetup,
  SetupRequiredError,
  printFirstRunBriefing,
  printSetupCompleteRecap,
} = require('../core/setup');

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

  try {
    const { config, configPath } = loadConfig();
    const setup = getSetupStatus(config);
    payload.setup = setup;
    payload.setup_complete = setup.setup_complete;
    payload.setup_required = setup.setup_required;

    const inbox = config.inbox || {};
    payload.inbox = {
      enabled: inbox.enabled !== false,
      staging_dir: setup.resolved_staging_dir || inbox.staging_dir || null,
      output_dir: setup.resolved_output_dir || inbox.output_dir || null,
    };

    if (setup.setup_required) {
      payload.status = 'fail';
      payload.errors.push(
        'First-run setup required: run shrinkvideo setup or scripts/first_setup.sh'
      );
      for (const pe of setup.path_errors || []) {
        payload.errors.push(pe);
      }
    }

    if (inbox.enabled === false) {
      payload.warnings = payload.warnings || [];
      payload.warnings.push(
        'inbox.enabled is false; set enabled: true in config.yaml before run-inbox'
      );
    }
  } catch (err) {
    payload.warnings = payload.warnings || [];
    payload.warnings.push(`config: ${err.message}`);
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
  for (const w of payload.warnings || []) console.log('  warn:', w);
  if (payload.setup) {
    console.log('  setup_complete:', payload.setup.setup_complete);
    console.log('  setup_required:', payload.setup.setup_required);
  }
  if (payload.inbox) {
    console.log('  inbox.staging_dir:', payload.inbox.staging_dir || '(unset)');
    console.log('  inbox.output_dir:', payload.inbox.output_dir || '(unset)');
  }
}

app
  .command('setup')
  .description('First-run: confirm staging (素材) and output (成品) directories')
  .option('--status', 'Print setup status and exit')
  .option('-s, --staging <path>', '素材/中转目录')
  .option('-o, --output <path>', '成品/输出目录')
  .option('--confirm', 'Validate paths and set setup_complete')
  .option('--welcome', 'Print first-run guide only (no directory prompts)')
  .option('--no-briefing', 'Skip first-run guide text')
  .option('--json', 'JSON on stdout')
  .option('--config <path>', 'Config path')
  .action(async (opts) => {
    const { config, configPath } = loadConfig(opts.config);

    if (opts.welcome) {
      if (!opts.json) printFirstRunBriefing({ configPath });
      else {
        console.log(
          JSON.stringify({
            status: 'ok',
            kind: 'welcome',
            message: 'See stdout without --json for full guide',
          })
        );
      }
      process.exit(0);
    }

    if (opts.status) {
      const setup = getSetupStatus(config);
      if (opts.json) {
        console.log(JSON.stringify(setup));
      } else {
        console.log('[shrinkvideo] setup status');
        console.log('  setup_complete:', setup.setup_complete);
        console.log('  setup_required:', setup.setup_required);
        console.log('  staging_dir:', setup.resolved_staging_dir || '(unset)');
        console.log('  output_dir:', setup.resolved_output_dir || '(unset)');
        if (setup.path_errors?.length) {
          for (const e of setup.path_errors) console.log('  error:', e);
        }
      }
      process.exit(setup.setup_required ? 1 : 0);
    }

    try {
      const wasRequired = getSetupStatus(config).setup_required;

      if (opts.staging && opts.output) {
        if (wasRequired && !opts.noBriefing && !opts.json) {
          printFirstRunBriefing({ configPath });
        }
        const markComplete = opts.confirm === true;
        const status = saveInboxSetup(configPath, {
          staging_dir: opts.staging,
          output_dir: opts.output,
          markComplete,
        });
        if (!markComplete) {
          if (opts.json) console.log(JSON.stringify({ ...status, saved: true, confirmed: false }));
          else {
            console.log('[shrinkvideo] paths saved; run with --confirm to finish setup');
          }
          process.exit(0);
        }
        if (opts.json) console.log(JSON.stringify(status));
        else if (!opts.noBriefing) printSetupCompleteRecap(status);
        process.exit(0);
      }

      if (opts.confirm) {
        if (wasRequired && !opts.noBriefing && !opts.json) {
          printFirstRunBriefing({ configPath });
        }
        const inbox = config.inbox || {};
        const status = saveInboxSetup(configPath, {
          staging_dir: inbox.staging_dir,
          output_dir: inbox.output_dir,
          markComplete: true,
        });
        if (opts.json) console.log(JSON.stringify(status));
        else if (!opts.noBriefing) printSetupCompleteRecap(status);
        process.exit(0);
      }

      const inbox = config.inbox || {};
      const status = await runInteractiveSetup(
        configPath,
        {
          staging: inbox.staging_dir || '',
          output: inbox.output_dir || '',
        },
        { briefing: !opts.noBriefing }
      );
      if (opts.json) console.log(JSON.stringify(status));
      process.exit(0);
    } catch (err) {
      if (opts.json) {
        console.log(JSON.stringify({ status: 'fail', error: err.message, code: err.code }));
      } else {
        console.error('[shrinkvideo] setup failed:', err.message);
      }
      process.exit(1);
    }
  });

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
      let output;
      let capture_datetime;
      if (opts.output) {
        output = path.resolve(opts.output);
      } else {
        const binaries = resolveBinaries({ binDir: config.bin?.dir });
        assertBinaries(binaries);
        const resolved = await resolveOutputPath(input, path.dirname(input), {
          ffprobe: binaries.ffprobe,
          output_name_template: flags.output_name_template,
          suffix: flags.suffix,
        });
        output = resolved.outputPath;
        capture_datetime = resolved.datetime;
      }

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

      const out = {
        ...result,
        status: result.status === 'skipped' ? 'ok' : result.status,
        capture_datetime: capture_datetime ?? result.capture_datetime,
      };
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
  .command('history')
  .description('Show recent compression history (human-readable)')
  .option('--tail <n>', 'Number of lines', '20')
  .option('--json-lines', 'Print raw JSONL rows')
  .option('--config <path>', 'Config path')
  .action((opts) => {
    const { config } = loadConfig(opts.config);
    const { path: histPath, lines } = readHistory(config.advanced || {}, {
      tail: parseInt(opts.tail, 10) || 20,
    });
    if (lines.length === 0) {
      console.log(`[shrinkvideo] no history yet (${histPath})`);
      process.exit(0);
    }
    if (opts.jsonLines) {
      for (const row of lines) console.log(JSON.stringify(row));
    } else {
      console.log(`[shrinkvideo] history (last ${lines.length}): ${histPath}`);
      for (const row of lines) console.log(formatHumanLine(row));
    }
    process.exit(0);
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
        if (err instanceof SetupRequiredError) {
          console.log(JSON.stringify(err.toJSON()));
        } else {
          console.log(JSON.stringify({ status: 'fail', error: err.message, code: err.code }));
        }
      } else {
        console.error('[shrinkvideo] run-inbox:', err.message);
        if (err instanceof SetupRequiredError) {
          console.error('  → run: shrinkvideo setup');
          console.error('  → or:  bash ~/.hermes/skills/shrinkvideo/scripts/first_setup.sh');
          console.error('  → read: shrinkvideo setup --welcome');
        }
      }
      process.exit(1);
    }
  });

app.parse(process.argv);

if (!process.argv.slice(2).length) {
  app.help();
}
