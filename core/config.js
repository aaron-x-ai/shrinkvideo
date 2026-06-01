'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('yaml');
const { PRODUCT_ROOT } = require('./paths');

const DEFAULT_CONFIG_PATH = path.join(
  os.homedir(),
  '.config',
  'shrinkvideo',
  'config.yaml'
);

function expandHome(p) {
  if (!p || typeof p !== 'string') return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function loadYamlFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return yaml.parse(raw) || {};
}

function loadConfig(configPath) {
  const resolved =
    configPath ||
    process.env.SHRINKVIDEO_CONFIG ||
    DEFAULT_CONFIG_PATH;

  const defaultsPath = path.join(PRODUCT_ROOT, 'config', 'config.default.yaml');
  let config = {};
  if (fs.existsSync(defaultsPath)) {
    config = loadYamlFile(defaultsPath);
  }
  if (fs.existsSync(resolved)) {
    const user = loadYamlFile(resolved);
    config = deepMerge(config, user);
  }

  if (config.advanced?.state_file) {
    config.advanced.state_file = expandHome(config.advanced.state_file);
  }
  if (config.advanced?.history_file) {
    config.advanced.history_file = expandHome(config.advanced.history_file);
  }
  if (config.inbox?.staging_dir) {
    config.inbox.staging_dir = expandHome(config.inbox.staging_dir);
  }
  if (config.inbox?.output_dir) {
    config.inbox.output_dir = expandHome(config.inbox.output_dir);
  }
  if (config.bin?.dir) {
    config.bin.dir = expandHome(config.bin.dir);
  }

  return { config, configPath: resolved };
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

function mergeCliCompressFlags(config, flags) {
  const d = config.defaults || {};
  return {
    codec: flags.codec ?? d.codec ?? 'auto',
    quality: flags.quality ?? d.quality ?? 'balanced',
    resolution: flags.resolution ?? d.resolution ?? null,
    suffix: d.suffix ?? '_shr',
    output_name_template:
      d.output_name_template ?? '{datetime}_{basename}_shr',
    overwrite: flags.overwrite ?? d.overwrite ?? false,
  };
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  loadConfig,
  mergeCliCompressFlags,
  expandHome,
};
