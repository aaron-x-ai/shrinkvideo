# Upstream: ShrinkMaster

| Field | Value |
|-------|--------|
| Repository | https://github.com/kellypeng/shrinkmaster |
| License | MIT |
| Tracked commit | `f699dd8` (shallow clone 2026-05-31) |
| Upstream version (package.json) | 0.3.0 |
| Local mirror path | `../src_shrinkmaster/` (sibling of this repo; not in GitHub shrinkvideo) |

## Sync policy

1. Do **not** develop product features inside `src_shrinkmaster/`.
2. When upstream fixes compression logic, cherry-pick or manually port changes into `shrinkvideo/core/`.
3. Update this file with the new commit hash and date after each sync.
4. UI files (`renderer.js`, `index.html`) sync only when adopting Phase 4 GUI.

## ffmpeg binaries

Upstream script: `src_shrinkmaster/download_ffmpeg_macos.sh`  
Produces `bin/ffmpeg` and `bin/ffprobe` (universal2, ~260MB, gitignored).

Development shortcut:

```bash
export SHRINKVIDEO_BIN_DIR="/path/to/aaronxai-shrinkvideo/src_shrinkmaster/bin"
```
