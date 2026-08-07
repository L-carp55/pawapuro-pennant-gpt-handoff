import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngineConfig } from '../src/engine/config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Current production config: hydrated but gate OFF.
const current = await loadEngineConfig(ROOT);
assert.equal(current.player_running.enabled, false);
assert.equal(current.player_running.running_response.calibrated, true);
assert.equal(current.player_running.event_responses.calibrated, false);

// Synthetic temp project: gate ON + uncalibrated event response must fail fast.
const tmp = await mkdtemp(path.join(os.tmpdir(), 'pawapuro-engine-config-'));
try {
  await mkdir(path.join(tmp, 'configs'), { recursive: true });
  const physical = JSON.parse(await readFile(path.join(ROOT, 'configs', 'baseball_running_response.json'), 'utf8'));
  const events = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_event_responses.json'), 'utf8'));
  const engine = {
    player_running: {
      enabled: true,
      physical_response_config: 'configs/baseball_running_response.json',
      event_response_config: 'configs/running_event_responses.json',
    },
  };
  await writeFile(path.join(tmp, 'configs', 'engine.json'), JSON.stringify(engine));
  await writeFile(path.join(tmp, 'configs', 'baseball_running_response.json'), JSON.stringify(physical));
  await writeFile(path.join(tmp, 'configs', 'running_event_responses.json'), JSON.stringify(events));
  await assert.rejects(() => loadEngineConfig(tmp), /event responses are not calibrated/);

  // Top-level event registryが較正済みならloaderはhydrateして通す。
  // 個々のevent calibrated=falseはresolver側でglobal fallbackできるため許容する。
  await writeFile(path.join(tmp, 'configs', 'running_event_responses.json'), JSON.stringify({ ...events, calibrated: true }));
  const hydrated = await loadEngineConfig(tmp);
  assert.equal(hydrated.player_running.enabled, true);
  assert.equal(hydrated.player_running.running_response.calibrated, true);
  assert.equal(hydrated.player_running.event_responses.calibrated, true);

  // project root外へのpath traversalは禁止。
  await writeFile(path.join(tmp, 'configs', 'engine.json'), JSON.stringify({
    player_running: { enabled: false, physical_response_config: '../outside.json' },
  }));
  await assert.rejects(() => loadEngineConfig(tmp), /must stay inside project root/);
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log('engine config loader: 9 checks passed');
