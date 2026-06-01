'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { expandHome } = require('./config');
const {
  printFirstRunBriefing,
  printSetupCompleteRecap,
} = require('./first-run-briefing');

const PLACEHOLDER = '__UNCONFIGURED__';

class SetupRequiredError extends Error {
  constructor(details = {}) {
    super(
      '首次使用须确认素材（中转）目录与成品（输出）目录。请运行: shrinkvideo setup'
    );
    this.name = 'SetupRequiredError';
    this.code = 'SETUP_REQUIRED';
    this.details = details;
  }

  toJSON() {
    return {
      status: 'fail',
      code: this.code,
      message: this.message,
      ...this.details,
    };
  }
}

function isPathConfigured(value) {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s || s === PLACEHOLDER) return false;
  return true;
}

function validateDirectoryPaths(stagingDir, outputDir) {
  const errors = [];
  const staging = expandHome(stagingDir);
  const output = expandHome(outputDir);

  if (!isPathConfigured(stagingDir)) {
    errors.push('staging_dir is not set');
  }
  if (!isPathConfigured(outputDir)) {
    errors.push('output_dir is not set');
  }
  if (errors.length) {
    return { ok: false, errors, staging: staging || null, output: output || null };
  }

  if (path.resolve(staging) === path.resolve(output)) {
    errors.push('staging_dir and output_dir must be different directories');
  }

  try {
    fs.mkdirSync(staging, { recursive: true });
    fs.mkdirSync(output, { recursive: true });
  } catch (err) {
    errors.push(`cannot create directories: ${err.message}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    staging,
    output,
  };
}

function getSetupStatus(config) {
  const inbox = config.inbox || {};
  const paths = validateDirectoryPaths(
    inbox.staging_dir,
    inbox.output_dir
  );
  const setupComplete = inbox.setup_complete === true;

  return {
    setup_complete: setupComplete,
    setup_required: !setupComplete || !paths.ok,
    setup_confirmed_at: inbox.setup_confirmed_at || null,
    staging_dir: inbox.staging_dir || null,
    output_dir: inbox.output_dir || null,
    paths_valid: paths.ok,
    path_errors: paths.errors,
    resolved_staging_dir: paths.staging,
    resolved_output_dir: paths.output,
  };
}

function assertInboxSetup(config) {
  const status = getSetupStatus(config);
  if (!status.setup_complete || !status.paths_valid) {
    throw new SetupRequiredError({
      setup_complete: status.setup_complete,
      setup_required: true,
      staging_dir: status.staging_dir,
      output_dir: status.output_dir,
      path_errors: status.path_errors,
      next_command: 'shrinkvideo setup',
      next_script:
        'bash ~/.hermes/skills/shrinkvideo/scripts/first_setup.sh',
    });
  }
  return status;
}

function loadYamlFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return yaml.parse(fs.readFileSync(filePath, 'utf8')) || {};
}

function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      typeof out[k] === 'object' &&
      out[k] &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function saveInboxSetup(configPath, { staging_dir, output_dir, markComplete }) {
  const paths = validateDirectoryPaths(staging_dir, output_dir);
  if (!paths.ok) {
    const err = new Error(paths.errors.join('; '));
    err.code = 'EINVAL';
    err.path_errors = paths.errors;
    throw err;
  }

  const existing = loadYamlFile(configPath);
  const inboxPatch = {
    staging_dir,
    output_dir,
  };
  if (markComplete) {
    inboxPatch.setup_complete = true;
    inboxPatch.setup_confirmed_at = new Date().toISOString();
  }
  const merged = deepMerge(existing, { inbox: inboxPatch });

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const tmp = `${configPath}.tmp`;
  fs.writeFileSync(tmp, yaml.stringify(merged), 'utf8');
  fs.renameSync(tmp, configPath);

  return getSetupStatus(merged);
}

async function runInteractiveSetup(configPath, defaults = {}, options = {}) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q) =>
    new Promise((resolve) => rl.question(q, (a) => resolve(a)));

  try {
    if (options.briefing !== false) {
      printFirstRunBriefing({ configPath });
      if (!options.nonInteractive) {
        await ask('阅读完毕后按 Enter 继续配置素材目录与成品目录… ');
        console.log('');
      }
    }

    const stagingPrompt = defaults.staging
      ? `素材目录（中转） [${defaults.staging}]: `
      : '素材目录（中转，绝对路径）: ';
    const outputPrompt = defaults.output
      ? `成品目录（输出） [${defaults.output}]: `
      : '成品目录（输出，绝对路径）: ';

    let staging = (await ask(stagingPrompt)).trim();
    let output = (await ask(outputPrompt)).trim();
    if (!staging && defaults.staging) staging = defaults.staging;
    if (!output && defaults.output) output = defaults.output;

    const status = saveInboxSetup(configPath, {
      staging_dir: staging,
      output_dir: output,
      markComplete: true,
    });

    printSetupCompleteRecap(status);

    return status;
  } finally {
    rl.close();
  }
}

module.exports = {
  PLACEHOLDER,
  SetupRequiredError,
  isPathConfigured,
  validateDirectoryPaths,
  getSetupStatus,
  assertInboxSetup,
  saveInboxSetup,
  runInteractiveSetup,
  printFirstRunBriefing,
  printSetupCompleteRecap,
};
