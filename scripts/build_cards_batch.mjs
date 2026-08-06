// オーナー確定の検証題材を一括査定する（Sol仕様 02 §3.3／06 §1／07 §3）。
//
// 2026-08-06 安全停止:
//   自動 peak / prime は、総合得点への走守未接続・能力ごとの年度混在が解消するまで停止する。
//   この一括CLIは明示年度を受け取る用途ではないため、現在は実行を拒否する。
//
// 使い方（修理後に再開予定）: node scripts/build_cards_batch.mjs carp|wbc|all [peak|prime]
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUP = process.argv[2] ?? 'all';
const MODE = process.argv[3] ?? 'peak';

if (MODE === 'peak' || MODE === 'prime') {
  console.error(
    `一括${MODE}生成は一時停止中です。\n`
    + '理由: peakの総合得点に走塁・守備が未接続、primeは能力ごとの参照期間と環境補正が未統一。\n'
    + '個別カードは node scripts/build_card.mjs <選手名> <4桁年度> で生成してください。'
  );
  process.exit(2);
}
console.error(`未対応の一括生成モード: ${MODE}`);
process.exit(2);

// 以下は安全停止解除後に再利用する実装。到達しないが、復旧時の差分を小さくするため保持する。
const CARP = ['田中　広輔', '菊池　涼介', '丸　佳浩', '鈴木　誠也', '新井　貴浩', '松山　竜平',
  'エルドレッド', '安部　友裕', '會澤　翼', '石原　慶幸', '西川　龍馬', '野間　峻祥', 'バティスタ'];
const WBC = ['小林　誠司', '大野　奨太', '炭谷　銀仁朗', '松田　宣浩', '菊池　涼介', '坂本　勇人',
  '中田　翔', '山田　哲人', '田中　広輔', '内川　聖一', '青木　宣親', '平田　良介',
  '筒香　嘉智', '秋山　翔吾', '鈴木　誠也'];

// カープ群は黄金期のカード。他球団時代の年を選ばないよう年度を限る（選定表 card_selection_carp.md と同じ）
const RANGE = { carp: [2014, 2020], wbc: null };

const groups = GROUP === 'carp' ? { carp: CARP } : GROUP === 'wbc' ? { wbc: WBC } : { carp: CARP, wbc: WBC };

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const scoutingLedger = loadLedger(JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8')));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const ctx = makeContext(db, cfg);

const outDir = path.join(ROOT, 'outputs', 'cards');
await mkdir(outDir, { recursive: true });

const rows = [];
for (const [g, names] of Object.entries(groups)) {
  for (const name of names) {
    // DBは登録名を全角スペース区切りで持つ。空白を落とすと一致しない
    const r = appraiseCard(ctx, { name, mode: MODE, cfg, rv, runNorm, fldNorm, seasonRange: RANGE[g], scoutingLedger });
    if (r.error) { rows.push({ group: g, name, error: r.error }); continue; }
    const c = r.card;
    const label = c.card_type === 'prime_composite'
      ? `${c.seasons_used[0]}-${c.seasons_used.at(-1)}` : String(c.season_label);
    const file = path.join(outDir, `${c.name_ja.replace(/ /g, '')}_${label}.json`);
    await writeFile(file, JSON.stringify(c, null, 2), 'utf8');
    const A = c.abilities; const B = A.基礎能力;
    rows.push({
      group: g, name: c.name_ja, season: label, team: c.team, pos: c.primary_position,
      traj: B.弾道?.value ?? null, meet: B.ミート, power: B.パワー, speed: B.走力,
      arm: B.肩力, fld: B.守備力, catch_: B.捕球,
      k: A.独自の基礎能力.三振のしにくさ, eye: A.独自の基礎能力.選球眼,
      ab: A.得能,
      conf: c.confidence.overall,
      file: path.relative(ROOT, file),
    });
  }
}

const ok = rows.filter(r => !r.error);
const ng = rows.filter(r => r.error);

const md = [
  '---', 'status: draft', 'created: 2026-08-01', '---', '',
  `# 査定カード一括生成 — ${GROUP === 'all' ? 'カープ黄金期13人＋WBC2017野手15人' : GROUP}（${MODE === 'prime' ? '全盛期合成' : 'ピーク単年'}）`, '',
  '> 年度は**得点貢献による機械選定**（2026-08-01 オーナー裁定）。',
  '> 肩力の「推」は守備位置からの推定値（内野手はARMが公開されていないため）。', '',
  '| 群 | 選手 | 年 | 位置 | 弾道 | ミート | パワー | 走力 | 肩力 | 守備力 | 捕球 | 三振耐性 | 選球眼 | チャンス | 対左 | 盗塁 | 走塁 | けが | 信頼度 |',
  '|---|---|---:|---|---:|---|---|---|---|---|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|',
  ...ok.map(r => { const g=v=>v==null?'—':v.rank+Math.round(v.value); const k=v=>v==null?'—':v.rank;
    return `| ${r.group} | ${r.name} | ${r.season} | ${r.pos} | ${r.traj ?? '—'} | ${g(r.meet)} | ${g(r.power)} | ${g(r.speed)} | ${g(r.arm)} | ${g(r.fld)} | ${g(r.catch_)} | ${g(r.k)} | ${g(r.eye)} | ${k(r.ab.チャンス)} | ${k(r.ab.対左)} | ${k(r.ab.盗塁)} | ${k(r.ab.走塁)} | ${k(r.ab.けがしにくさ)} | ${r.conf} |`; }),
  '',
  ...(ng.length ? ['## 査定できなかった選手', '', ...ng.map(r => `- ${r.name}（${r.group}）: ${r.error}`), ''] : []),
  '## 注意', '',
  '- 走力・盗塁・守備はNPB Basementのある2020年以降のみ。それ以前の年を選んだ選手は「—」になる',
  '- 対左右・得点圏の分割（NF3）は2023-2025のみ。それ以前を選んだ選手は文脈Tier Cで、チャンス・対左は未査定',
  '- 分割のある年は、チャンス・対左の差分ぶんを調整台帳で基礎ミート・パワーから差し引いている（仕様05 §2、2026-08-04）',
].join('\n');

const mdPath = path.join(ROOT, 'outputs', `cards_batch_${GROUP}_${MODE}.md`);
await writeFile(mdPath, md, 'utf8');

console.log(`生成 ${ok.length}件 / 失敗 ${ng.length}件`);
for (const r of ok) { const g=v=>v==null?'—':v.rank+Math.round(v.value);
  console.log(`  ${r.name.padEnd(8)} ${r.season} 弾${r.traj ?? '—'} ミ${g(r.meet)} パ${g(r.power)} 走${g(r.speed)} 肩${g(r.arm)} 守${g(r.fld)} 捕${g(r.catch_)}  信頼度${r.conf}`); }
for (const r of ng) console.log(`  ✗ ${r.name}: ${r.error}`);
console.log(`\n→ ${path.relative(ROOT, mdPath)}`);
db.close();
