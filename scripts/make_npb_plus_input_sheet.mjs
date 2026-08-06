// NPB+（NPB公認アプリ）の実測値をオーナーが手入力するためのシートを作る。
//
// なぜ手入力か（2026-08-05 オーナー提案「npb+のデータを使いましょうか。私が必要な情報を手入力で入れます」）:
//   NPB+ は選手ごとに「平均送球速度」「スプリント」「最速タイム（一塁到達）」を出しており、
//   これは仕様04 §1.2 が第1階層に置く直接計測そのもの。
//   ただし配信はアプリのみで、NPB公認＝自動取得はプロジェクト規約で禁じている
//   （CLAUDE.md「NPB公式は取得元にしない」）。**オーナーが自分で見て手で入れる**なら
//   自動巡回にあたらず、成果物も公開しない個人用ゲームに閉じる。
//
// なぜ内野手と捕手を先にやるか（2026-08-05 実測）:
//   肩力の誤差を守備位置別に分解したところ、内野手だけ順位がまったく当たっていなかった（相関0.029）。
//   内野手には送球の実測が公開されておらず「守れる位置からの推定」しか無いため。
//   捕手は系統ずれが最大（-23）。外野手は実測（ARM）があり順位は0.34〜0.46で当たっている。
//   ＝**この2群に入力が効き、外野手への入力は費用対効果が低い**。
//
// 使い方:
//   node scripts/make_npb_plus_input_sheet.mjs [年] [最低打席]
//   → outputs/npb_plus_input_2024.md が出る。オーナーが埋めたら
//     node scripts/parse_npb_plus_input.mjs で取り込む。

import { DatabaseSync } from 'node:sqlite';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] ?? 2024);
const MIN_PA = Number(process.argv[3] ?? 150);

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

// 対象＝内野手と捕手（実測が効く群）。守備位置はプロEYE球の粗い区分
const rows = db.prepare(`
  SELECT b.player_id, b.name, b.team, b.position, b.pa
  FROM v_batting b
  WHERE b.season = ? AND b.pa >= ? AND b.position IN ('捕','一','二','三','遊')
  ORDER BY b.team, b.position, b.pa DESC`).all(SEASON, MIN_PA);

const byTeam = new Map();
for (const r of rows) {
  if (!byTeam.has(r.team)) byTeam.set(r.team, []);
  byTeam.get(r.team).push(r);
}

const md = [
  '---',
  'status: draft',
  `created: 2026-08-05`,
  'kind: npb_plus_input_sheet',
  `season: ${SEASON}`,
  '---',
  '',
  `# NPB+ 実測値の入力シート（${SEASON}年・${MIN_PA}打席以上の内野手と捕手／${rows.length}人）`,
  '',
  '## お願いすること',
  '',
  'NPB+アプリの選手ページを開いて、**「守備」の「送球速度（平均）」の数字だけ**を空欄に書き写してください。',
  '',
  '- 数字だけで結構です（`125.7` のように）。単位は書かなくて大丈夫です',
  '- **チーム単位で完結します。** 1球団だけでも、途中でやめても、入った分から使えます',
  '- その選手に数字が出ていなければ空欄のままにしてください。**0 とは書かないでください**（「無い」と「0」は別扱いにしています）',
  '- アプリで年度を選べるなら**2024年**に合わせてください。選べない・今季しか出ないなら**今季のままで結構です**',
  '  （こちらで「2年ずれた実測」として扱います。肩の強さは打撃成績ほど年で動かないので、ずれたままでも使えます）',
  '',
  '## なぜこの人たちなのか',
  '',
  `内野手と捕手だけをお願いしています。理由は${SEASON}年の査定を実際に測った結果です。`,
  '',
  '- **内野手は肩の順位がまったく当たっていません**（順位の一致 0.029＝当てずっぽうと同じ）。',
  '  内野手の送球は公開されているデータがどこにも無く、「その位置を守れるなら肩はこれくらい」という',
  '  推定しかできていないためです。ここに実測が入ると、推定が実測に置き換わります',
  '- **捕手は自作が23点も低く出ています**（7つの能力・全守備位置の中で最大のずれ）',
  '- 外野手は送球の実測が公開されていて順位も当たっている（0.34〜0.46）ので、**お願いしていません**',
  '',
  '右の2列（瞬間最高速度・一塁到達）は同じ画面に出ている数字です。**余裕がある時だけで結構です**',
  '（走力は今でも順位がよく当たっているので、急ぎではありません）。',
  '',
  '## 入力欄',
  '',
];

const POSNAME = { '捕': '捕手', '一': '一塁', '二': '二塁', '三': '三塁', '遊': '遊撃' };

for (const [team, players] of byTeam) {
  md.push(`### ${team}（${players.length}人）`, '');
  // 列は3つとも残すが、必須は送球速度だけ。右2列は同じ画面に出ている数字なので、
  // 余裕がある時だけ埋めてもらう（走力は既に順位が当たっているので急がない）
  md.push('| 選手 | 守備 | 打席 | **送球速度（平均）** | 瞬間最高速度 | 最速タイム（一塁到達） |');
  md.push('|---|---|---:|---|---|---|');
  for (const p of players) {
    md.push(`| ${p.name.replace(/　/g, ' ')} | ${POSNAME[p.position] ?? p.position} | ${p.pa} |  |  |  |`);
  }
  md.push('');
}

md.push(
  '---',
  '',
  '## 入力後にすること',
  '',
  'このファイルを保存したら、こちらで次を実行して取り込みます。',
  '',
  '```bash',
  'node scripts/parse_npb_plus_input.mjs',
  '```',
  '',
  '取り込み時に、入った人数・単位の判定・既存の査定との食い違いの大きい選手を報告します。',
  '',
  '## この数字の扱い',
  '',
  '- 出典は「NPB+アプリ（オーナー手入力）」として記録し、統計から出した値と**同じ欄に混ぜません**',
  '- 統計値も消さずに両方残し、食い違いの大きさを記録します（既存のスカウティング台帳と同じ規律）',
  '- 個人用のゲームに閉じて使い、公開しません',
  '',
);

await mkdir(path.join(ROOT, 'outputs'), { recursive: true });
const out = path.join(ROOT, 'outputs', `npb_plus_input_${SEASON}.md`);
await writeFile(out, md.join('\n'), 'utf8');
console.log(`${rows.length}人分の入力シートを書き出し: ${path.relative(ROOT, out)}`);
const posCount = {};
for (const r of rows) posCount[POSNAME[r.position] ?? r.position] = (posCount[POSNAME[r.position] ?? r.position] ?? 0) + 1;
console.log('内訳:', Object.entries(posCount).map(([k, v]) => `${k} ${v}人`).join(' / '));
db.close();
