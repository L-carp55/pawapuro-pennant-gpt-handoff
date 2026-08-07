// Engine runtime config loader.
// JSON正本は分離したまま保ち、runtimeで必要な較正responseだけをhydrateする。
// player_runningを有効化したのにresponseが未較正/未読込の状態をフェイルファストする。

import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

function resolveInsideRoot(root, relativePath, label) {
  if (!relativePath || typeof relativePath !== 'string') throw new Error(`${label} path is required`);
  const base = path.resolve(root);
  const file = path.resolve(base, relativePath);
  if (!(file === base || file.startsWith(base + path.sep))) {
    throw new Error(`${label} must stay inside project root: ${relativePath}`);
  }
  return file;
}

export async function loadEngineConfig(root) {
  const cfg = await readJson(path.join(root, 'configs', 'engine.json'));
  const pr = cfg.player_running;
  if (!pr) return cfg;

  if (pr.physical_response_config) {
    pr.running_response = await readJson(resolveInsideRoot(root, pr.physical_response_config, 'physical_response_config'));
  }
  if (pr.event_response_config) {
    pr.event_responses = await readJson(resolveInsideRoot(root, pr.event_response_config, 'event_response_config'));
  }

  if (pr.enabled === true) {
    if (!pr.running_response?.calibrated) {
      throw new Error('player_running enabled but physical running response is not calibrated');
    }
    if (!pr.event_responses?.calibrated) {
      throw new Error('player_running enabled but running event responses are not calibrated');
    }
  }
  return cfg;
}
