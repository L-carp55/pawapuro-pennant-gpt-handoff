// 総合ピーク候補へ年度別UBR/守備得点が正しく届くことをDBで検証する。
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeasonRunFieldContributions } from '../src/cards/season_contributions.mjs';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

// 牧は2021年以降の現代選手。少なくとも2023/2024の走守得点が揃うはず。
const row = db.prepare(`SELECT player_id FROM v_batting WHERE season=2023 AND name LIKE '%牧%秀悟%' LIMIT 1`).get();
assert.ok(row?.player_id, '牧秀悟を解決できない');
const m = loadSeasonRunFieldContributions(db, row.player_id);
for (const y of [2023, 2024]) {
  const x = m.get(y);
  assert.ok(x, `${y} contributionなし`);
  assert.ok(Number.isFinite(x.runRuns), `${y} UBRなし`);
  assert.ok(Number.isFinite(x.fldRuns), `${y} field runsなし`);
  assert.ok(x.fieldingDetail?.complete, `${y} fielding detail incomplete`);
}

// 2019年以前にはNPB Basement走守が無い。0で埋めない。
const seiya = db.prepare(`SELECT player_id FROM v_batting WHERE season=2018 AND name LIKE '%鈴木%誠也%' LIMIT 1`).get();
assert.ok(seiya?.player_id);
const sm = loadSeasonRunFieldContributions(db, seiya.player_id);
assert.equal(sm.get(2018)?.runRuns ?? null, null);
assert.equal(sm.get(2018)?.fldRuns ?? null, null);

// pipelineに配線された後は、2020+だけで候補が完結する現代選手のinternal peakが計算できる。
const modernPeak = appraiseCard(ctx, { playerId: row.player_id, mode: 'peak', cfg, rv, runNorm, fldNorm });
assert.ok(!modernPeak.error, modernPeak.error);
assert.equal(modernPeak.card.card_type, 'peak_single_year');
assert.ok(modernPeak.meta?.targetSeason >= 2021);

// 歴史年を含む全キャリアは比較可能な走守が無いので、total peakを黙って打撃だけで選ばない。
let historicalStopped = false;
try {
  const x = appraiseCard(ctx, { playerId: seiya.player_id, mode: 'peak', cfg, rv, runNorm, fldNorm });
  historicalStopped = !!x.error;
} catch (e) {
  historicalStopped = /総合ピーク選定を停止/.test(String(e?.message));
}
assert.equal(historicalStopped, true);

console.log('peak component wiring: 14 checks passed');
db.close();
