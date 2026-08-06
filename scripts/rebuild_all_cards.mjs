// outputs/cards/ にある全カードを、いまの実装で作り直す。
//
// なぜ要るか（2026-08-01）:
//   カードは build_card.mjs（単発）と build_cards_batch.mjs（検証題材28枚）の両方から作られる。
//   単発で作ったカードはバッチの対象外なので、実装を変えても古いまま残る。
//   実際、鈴木誠也2017が古い版のまま残り、それを読んだ確認表が
//   「2017年だけ肩がD55で2021年のA88と食い違う」という**存在しない不具合**を示した。
//   フォルダ全体を一度に作り直せる経路を用意して、古い版が混ざる状態をなくす。
//
// 使い方: node scripts/rebuild_all_cards.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const scoutingLedger = loadLedger(JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8')));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const ctx = makeContext(db, cfg);

const dir = path.join(ROOT, 'outputs', 'cards');
const files = (await readdir(dir)).filter(f => f.endsWith('.json'));

let ok = 0; const failed = [];
for (const f of files) {
  const card = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
  // カードは自分がどの選手・どの年かを持っているので、そこから作り直す
  const mode = card.card_type === 'prime_composite' ? 'prime' : String(card.season_label);
  const r = appraiseCard(ctx, { playerId: card.player_id, mode, cfg, rv, runNorm, fldNorm, scoutingLedger });
  if (r.error) { failed.push(`${f}: ${r.error}`); continue; }
  await writeFile(path.join(dir, f), JSON.stringify(r.card, null, 2), 'utf8');
  ok++;
}

console.log(`作り直し ${ok}件 / 失敗 ${failed.length}件`);
for (const m of failed) console.log('  ✗ ' + m);
db.close();
