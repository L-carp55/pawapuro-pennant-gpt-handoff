// 実選手の査定カードを仕様§2のスキーマで出力する。
// 使い方: node scripts/build_card.mjs 村上 2024        （指定年）
//         node scripts/build_card.mjs 村上 peak         （得点貢献が最大の年）
//         node scripts/build_card.mjs 村上 prime        （全盛期合成）
//
// 査定の中核は src/cards/pipeline.mjs（一括生成 build_cards_batch.mjs と共有）。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext } from '../src/cards/pipeline.mjs';
import { appraiseCardT90 } from '../src/cards/t90_pipeline_adapter.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = process.argv[2] ?? '村上';
const MODE = process.argv[3] ?? '2024';

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const scoutingLedger = loadLedger(JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8')));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const r = appraiseCardT90(makeContext(db, cfg), { name: NAME, mode: MODE, cfg, rv, runNorm, fldNorm, scoutingLedger });
if (r.error) { console.error(r.error); process.exit(1); }
const card = r.card;

await mkdir(path.join(ROOT, 'outputs', 'cards'), { recursive: true });
const label = card.card_type === 'prime_composite'
  ? `${card.seasons_used[0]}-${card.seasons_used.at(-1)}` : String(card.season_label);
const file = path.join(ROOT, 'outputs', 'cards', `${card.name_ja.replace(/ /g, '')}_${label}.json`);
await writeFile(file, JSON.stringify(card, null, 2), 'utf8');

const A = card.abilities;
const show = (v) => v == null ? '—' : (v.scale === '1-4' ? String(v.value) : `${v.rank}${v.value}${v.is_estimated ? '推' : ''}`);

console.log(`${card.name_ja}  [${card.card_type}]  ${card.season_label ?? card.seasons_used.join('-')}  ${card.team} ${card.primary_position}`);
console.log(`  基礎能力  ${Object.entries(A.基礎能力).map(([k, v]) => `${k} ${show(v)}`).join(' / ')}`);
console.log(`  独自      ${Object.entries(A.独自の基礎能力).map(([k, v]) => `${k} ${show(v)}`).join(' / ')}`);
console.log(`  得能      ${Object.entries(A.得能).map(([k, v]) => `${k} ${v == null ? '—' : (v.rank ?? v.color ?? '付与')}`).join(' / ')}`);
console.log(`  守備適性  ${A.守備適性.map(f => `${f.position}${f.grade}`).join(' ')}`);
if (A._fielding_by_position.length > 1) {
  console.log(`  位置別    ${A._fielding_by_position.map(f => `${f.position}(守${f.守備力 ?? '—'}/捕${f.捕球 ?? '—'})`).join(' ')}`);
}
console.log(`  信頼度: 総合${card.confidence.overall}（サンプル${card.confidence.sample} 出典${card.confidence.source_quality} 文脈${card.confidence.context_match} Prior${card.confidence.prior_quality} 校正${card.confidence.game_calibration}）`);
if (A.未査定.length) console.log(`  未査定: ${A.未査定.join(' / ')}`);
console.log(`\n→ ${path.relative(ROOT, file)}`);
db.close();
