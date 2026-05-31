#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const pkg = require('../package.json');

const app = new Command();

app
  .name('shrinkvideo')
  .description('ShrinkVideo — local video/image compression (CLI)')
  .version(pkg.version, '-V, --version', 'Show version');

app
  .command('doctor')
  .description('Check Node, ffmpeg paths, and environment (Phase 1+)')
  .option('--json', 'Print JSON to stdout')
  .action((opts) => {
    const payload = {
      status: 'pending',
      message: 'Phase 0 scaffold: core/ and ffmpeg checks not implemented yet.',
      version: pkg.version,
      node: process.version,
      shrinkvideo_bin_dir: process.env.SHRINKVIDEO_BIN_DIR || null,
    };
    if (opts.json) {
      console.log(JSON.stringify(payload));
    } else {
      console.log('[shrinkvideo] doctor (stub)');
      console.log('  version:', pkg.version);
      console.log('  node:', process.version);
      console.log('  SHRINKVIDEO_BIN_DIR:', payload.shrinkvideo_bin_dir || '(not set)');
      console.log('');
      console.log('Next: Phase 1 — implement core/ and ffmpeg detection.');
      console.log('Set SHRINKVIDEO_BIN_DIR to ../src_shrinkmaster/bin after download_ffmpeg_macos.sh');
    }
    process.exit(0);
  });

app
  .command('compress')
  .description('Compress one video file (Phase 2)')
  .requiredOption('-i, --input <path>', 'Input file (absolute path)')
  .option('-o, --output <path>', 'Output file')
  .option('--json', 'JSON result on stdout')
  .action(() => {
    console.error('[shrinkvideo] compress: not implemented (Phase 2)');
    process.exit(1);
  });

app.parse(process.argv);

if (!process.argv.slice(2).length) {
  app.help();
}
