'use strict';

const path = require('path');
const { readVideoDatetime } = require('./metadata');

const DEFAULT_OUTPUT_TEMPLATE = '{datetime}_{basename}_shr';

/**
 * Apply template. Placeholders: {datetime}, {basename}.
 * If datetime is null, omit {datetime} and adjacent separators.
 */
function applyOutputNameTemplate(template, { datetime, basename }) {
  let t = template || DEFAULT_OUTPUT_TEMPLATE;

  if (datetime) {
    return t.replace(/\{datetime\}/g, datetime).replace(/\{basename\}/g, basename);
  }

  t = t
    .replace(/\{datetime\}_/g, '')
    .replace(/_\{datetime\}/g, '')
    .replace(/\{datetime\}/g, '');
  t = t.replace(/\{basename\}/g, basename);
  return t.replace(/__+/g, '_').replace(/^[-_]+|[-_]+$/g, '');
}

function sanitizeFilenameStem(stem) {
  return stem.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim();
}

/**
 * Resolve output file path under outputDir.
 */
async function resolveOutputPath(inputPath, outputDir, options = {}) {
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);
  const template =
    options.output_name_template ||
    options.template ||
    (options.suffix != null
      ? `{basename}${options.suffix}`
      : DEFAULT_OUTPUT_TEMPLATE);

  let datetime = null;
  if (template.includes('{datetime}') && options.ffprobe) {
    datetime = readVideoDatetime(options.ffprobe, inputPath);
  }

  const stem = sanitizeFilenameStem(
    applyOutputNameTemplate(template, { datetime, basename })
  );
  if (!stem) {
    throw new Error('output name template produced empty filename');
  }

  return {
    outputPath: path.join(outputDir, `${stem}${ext}`),
    datetime,
    basename,
    stem,
  };
}

/** @deprecated use resolveOutputPath */
function buildOutputPath(inputPath, outputDir, suffix) {
  const ext = path.extname(inputPath);
  const base = path.basename(inputPath, ext);
  const suf = suffix || '_shr';
  return path.join(outputDir, `${base}${suf}${ext}`);
}

module.exports = {
  DEFAULT_OUTPUT_TEMPLATE,
  applyOutputNameTemplate,
  resolveOutputPath,
  buildOutputPath,
};
