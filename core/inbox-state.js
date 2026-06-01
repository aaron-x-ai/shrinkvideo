'use strict';

const fs = require('fs');
const path = require('path');

function loadState(stateFile) {
  if (!stateFile || !fs.existsSync(stateFile)) {
    return { version: 1, files: {} };
  }
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (!data.files) data.files = {};
    return data;
  } catch {
    return { version: 1, files: {} };
  }
}

function saveState(stateFile, state) {
  const dir = path.dirname(stateFile);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${stateFile}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, stateFile);
}

function getFileRecord(state, inputPath) {
  return state.files[inputPath] || null;
}

function setFileRecord(state, inputPath, record) {
  state.files[inputPath] = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  loadState,
  saveState,
  getFileRecord,
  setFileRecord,
};
