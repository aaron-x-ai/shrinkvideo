'use strict';

const fs = require('fs');
const path = require('path');
const { PRODUCT_ROOT } = require('./paths');

function loadProductDefaults() {
  const p = path.join(PRODUCT_ROOT, 'config', 'config.default.yaml');
  if (!fs.existsSync(p)) {
    return {
      quality: 'balanced',
      resolution: '1920:-2',
      codec: 'auto',
      output_name_template: '{datetime}_{basename}_shr',
    };
  }
  try {
    const yaml = require('yaml');
    const all = yaml.parse(fs.readFileSync(p, 'utf8')) || {};
    return { ...(all.defaults || {}), ...(all.inbox || {}) };
  } catch {
    return {};
  }
}

const QUALITY_ZH = {
  best: '最佳画质（文件较大）',
  balanced: '平衡（推荐，默认）',
  smallest: '最小体积',
};

/**
 * Print first-run user guide (stdout). Not tied to easy-config.
 */
function printFirstRunBriefing(options = {}) {
  const d = { ...loadProductDefaults(), ...options };
  const quality = d.quality || 'balanced';
  const resolution = d.resolution || '1920:-2';
  const codec = d.codec || 'auto';
  const template = d.output_name_template || '{datetime}_{basename}_shr';
  const configPath =
    options.configPath || '~/.config/shrinkvideo/config.yaml';

  const lines = [
    '',
    '══════════════════════════════════════════════════════════════',
    '  ShrinkVideo — 首次使用说明',
    '══════════════════════════════════════════════════════════════',
    '',
    '【这是什么】',
    '  在本机用 ffmpeg 压缩视频，结果带 _shr 后缀，不上传云端。',
    '  通过飞书 / Hermes 发口令触发，不会自动监听文件夹。',
    '',
    '【工作流程】',
    '  1. 把待压缩原视频放进「素材目录」（中转，可一直放着）',
    '  2. 在飞书或 Hermes 说：开始视频压缩（或：开始压缩）',
    '  3. 程序扫描素材目录，逐个压缩',
    '  4. 成品写入「成品目录」；素材目录内原片默认保留',
    '  5. 再次压缩：若成品仍在且有效则跳过；删掉成品可重新压',
    '',
    '【两个目录（接下来要您确认）】',
    '  · 素材目录 — 只放待压缩的原视频（mp4 / mov / mkv 等）',
    '  · 成品目录 — 压缩后的文件输出位置，勿与素材目录相同',
    '',
    '【成品文件名】',
    `  模板：${template}`,
    '  · 能读到拍摄时间：20240531_143022_原名_shr.mov',
    '  · 读不到时间：原名_shr.mov',
    '',
    '【压缩品质（当前默认，可在配置里改）】',
    `  · 画质档位：${quality} — ${QUALITY_ZH[quality] || quality}`,
    `  · 分辨率：${resolution}（默认 1080p，宽 1920，高度按比例）`,
    `  · 编码器：${codec}（auto = 本机最佳，Mac 上多为 VideoToolbox 硬件加速）`,
    '',
    '【如何唤起压缩】',
    '  飞书 / Hermes 中对 Agent 说（任选）：',
    '    · 开始视频压缩',
    '    · 开始压缩',
    '    · 压缩视频 / shrinkvideo',
    '  Agent 会执行：bash ~/.hermes/skills/shrinkvideo/scripts/run_inbox.sh',
    '  长视频或多文件建议本机先跑：',
    '    caffeinate -i bash ~/.hermes/skills/shrinkvideo/scripts/run_inbox.sh',
    '',
    '【如何修改设置】',
    `  · 目录：再次运行 shrinkvideo setup 或 scripts/first_setup.sh`,
    `  · 画质 / 分辨率 / 编码等：编辑 ${configPath}`,
    '      修改 defaults.quality、defaults.resolution、defaults.codec 等',
    '  · 查看环境：shrinkvideo doctor --json',
    '  · 压缩记录：shrinkvideo history',
    '  · 可选图形改配置（非首次必需）：scripts/launch_config_ui.sh',
    '',
    '【其他说明】',
    '  · 仅处理视频，不处理图片',
    '  · 详细设计见 dev_docs/ShrinkVideo开发实践-Skill首次运行强制配置流程.md',
    '',
    '══════════════════════════════════════════════════════════════',
    '',
  ];

  const text = lines.join('\n');
  console.log(text);
  return text;
}

function printSetupCompleteRecap(status) {
  console.log('');
  console.log('── 配置已保存 ──');
  console.log('  素材目录:', status.resolved_staging_dir);
  console.log('  成品目录:', status.resolved_output_dir);
  console.log('');
  console.log('请把视频放入素材目录，然后在飞书/Hermes 说：开始视频压缩');
  console.log('');
}

module.exports = {
  printFirstRunBriefing,
  printSetupCompleteRecap,
  loadProductDefaults,
};
