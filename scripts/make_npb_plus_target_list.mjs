// NPB+ で撮ってもらう対象選手のリストを作る。
//
// なぜリストが要るか（2026-08-05）:
//   査定対象は **2024年・150打席以上・パワプロラベルあり の142人**。
//   一方 NPB+ が出すのは今（2026年）の在籍選手なので、
//   アプリを球団順に見ていくと対象でない選手（2026年の新加入）まで撮ることになる。
//   実際、最初に届いた広島8人のうち3人（モンテロ・ファビアン・名原）は2024年の名簿にいなかった。
//
// 並べ方:
//   1) 内野手と捕手を先に出す（肩力の順位がまったく当たっていない群＝実測が最も効く）
//   2) 次に外野手・DH（打球速度・打球角度が効く群。肩は今でも順位が当たっている）
//   球団は**2024年時点**のもの。移籍した選手はNPB+では別の球団にいるため、名前で探してもらう。
//
// 2026年に出ていない選手を落とす（2026-08-05 オーナー指示「今シーズンほとんど出ていない選手を除外して」）:
//   2026年の1球データ（npb_usage_2026、Nippon Baseball Data Repository / MIT）で打席数を見て除外する。
//   2024年の142人のうち **30人が2026年に1打席も立っていない**（オーナー談の末包・堂林・會澤を含む）。
//   打席が極端に少ない選手も、NPB+ に数字が出ない可能性が高いので既定で落とす（--min-pa で変更可）。
//
// 守備位置も2026年のものを併記する:
//   送球速度は守備位置で水準が全く違う（実測: 菊池涼介(二塁)109.0 vs 名原典彦(外野)147.1 km/h）。
//   2024年から位置が変わった選手が **32人** いる（坂倉将吾 捕→一、小園海斗 三→遊 など）。
//   これは較正時に位置ごとに揃えるために要る情報で、オーナーに申告してもらう必要はない。

import { DatabaseSync } from 'node:sqlite';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] ?? 2024);
const MIN_PA = Number(process.argv[3] ?? 150);
const MIN_PA_2026 = Number(process.argv[4] ?? 30); // 今季これ未満は NPB+ に数字が出ない見込みで落とす
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

// 外国人選手は名簿が「Ｎ．ソト」、1球データが「ソト」と表記が違う。
// 空白除去だけで突合すると一致せず「今季出場なし」と誤判定する
// （2026-08-05、実際に6人を誤って撮影対象から外していた: ソト249打席・レイエス356打席・
//   サンタナ306打席・ポランコ149打席・カリステ62打席・セデーニョ28打席）。
// 先頭の「英字1文字＋ピリオド」を落とした形でも引けるようにする。
const key = s => (s ?? '').replace(/[\s　]/g, '');
const keyAlt = s => key(s).replace(/^[A-ZＡ-Ｚ][．.]/, '');

const usage = new Map();
try {
  for (const r of db.prepare(`SELECT name, plate_appearances pa, primary_pos FROM npb_usage_2026`).all()) {
    usage.set(key(r.name), r);
    // 別形も引けるようにする（既にある正確な一致を上書きしない）
    const alt = keyAlt(r.name);
    if (alt !== key(r.name) && !usage.has(alt)) usage.set(alt, r);
  }
} catch {
  console.error('※ npb_usage_2026 がありません。先に node scripts/build_npb_2026_usage.mjs を実行すると、'
    + '今季出ていない選手を落とせます');
}

const all = db.prepare(`
  SELECT b.player_id, b.name, b.team, b.position, b.pa
  FROM v_batting b
  JOIN pawapuro_link pl ON pl.proeye_id = b.player_id
  WHERE b.season = ? AND b.pa >= ? AND b.position <> '投'
  ORDER BY b.team, b.pa DESC`).all(SEASON, MIN_PA);

const dropped = [];
const rows = [];
for (const r of all) {
  const u = usage.get(key(r.name)) ?? usage.get(keyAlt(r.name));
  if (usage.size && (!u || (u.pa ?? 0) < MIN_PA_2026)) {
    dropped.push({ name: r.name, pa2026: u?.pa ?? 0 });
    continue;
  }
  r.pos2026 = u?.primary_pos ?? null;
  r.pa2026 = u?.pa ?? null;
  rows.push(r);
}

// 既に取り込み済みの選手は「済」を付ける（重複して撮ってもらわない）
let done = new Set();
try {
  done = new Set(db.prepare(`SELECT name FROM npb_plus_measurement WHERE throw_speed_kmh IS NOT NULL`)
    .all().map(r => (r.name ?? '').replace(/[\s　]/g, '')));
} catch { /* テーブル未作成なら空 */ }

const INFIELD_C = ['捕', '一', '二', '三', '遊'];
const POSNAME = { '捕': '捕手', '一': '一塁', '二': '二塁', '三': '三塁', '遊': '遊撃', '外': '外野', '左': '左翼', '中': '中堅', '右': '右翼', '指': '指名打者', '打': '代打' };

const first = rows.filter(r => INFIELD_C.includes(r.position));
const second = rows.filter(r => !INFIELD_C.includes(r.position));

function section(title, why, list) {
  const md = [`## ${title}（${list.length}人）`, '', why, ''];
  const byTeam = new Map();
  for (const r of list) {
    if (!byTeam.has(r.team)) byTeam.set(r.team, []);
    byTeam.get(r.team).push(r);
  }
  for (const [team, players] of byTeam) {
    const remaining = players.filter(p => !done.has(key(p.name)));
    md.push(`### ${team}（${players.length}人・未取得 ${remaining.length}人）`, '');
    for (const p of players) {
      // 2026年に守備位置が変わっている選手は、いま守っている位置を添える（探すときの手がかり）
      const moved = p.pos2026 && p.pos2026 !== p.position
        ? `　※今は**${POSNAME[p.pos2026] ?? p.pos2026}**` : '';
      const mark = done.has(key(p.name)) ? '~~' : '- [ ] ';
      const tail = done.has(key(p.name)) ? '~~ ✅取得済み' : moved;
      md.push(`${mark}${p.name.replace(/　/g, ' ')}（${POSNAME[p.position] ?? p.position}）${tail}`);
    }
    md.push('');
  }
  return md;
}

const total = rows.length;
const doneCount = rows.filter(r => done.has(key(r.name))).length;

const md = [
  '---', 'status: draft', 'created: 2026-08-05', 'kind: npb_plus_target_list', `season: ${SEASON}`, '---', '',
  `# NPB+ で撮っていただきたい選手（${total}人・うち取得済み ${doneCount}人）`, '',
  '## お願いすること', '',
  '各選手のNPB+のページを、**打撃の上の方が見える1枚**と、**スプリントと守備まで見える1枚**の計2枚撮ってください。',
  '（矢野雅哉選手で送っていただいたのと同じ2枚です）', '',
  '- **球団は2024年当時のものです。** 移籍している選手はNPB+では別の球団にいるので、名前で探してください',
  '- **見つからない選手は飛ばして結構です**',
  '- ✅が付いている選手は取得済みなので**撮らなくて大丈夫です**',
  '- 守備位置が今年変わっている選手には「※今は◯◯」と添えました（探すときの手がかりです。'
  + 'こちらの計算でも使うので、申告していただく必要はありません）', '',
  '## 今季出ていない選手は落としました', '',
  `2026年の試合データで打席数を調べ、**今季${MIN_PA_2026}打席未満の${dropped.length}人を外しました**`,
  '（末包・堂林・會澤の各選手も、実際に今季0打席でしたので外れています）。', '',
  '## 順番（2026-08-05に入れ替えました）', '',
  '**外野手・指名打者を先にお願いします。** 打撃の数字が効くと分かったためです。',
  '',
  '当初は内野手と捕手を優先していました（肩の査定が一番悪かったため）。'
  + 'ところが45人分の実測が集まった時点で測ったところ、**送球速度は肩の強さを表していませんでした**。',
  '',
  '| 材料 → 能力 | 40人での一致度 |',
  '|---|---:|',
  '| ハードヒット率 → パワー | **0.76** |',
  '| スイング速度 → パワー | **0.75** |',
  '| 瞬間最高速度 → 走力 | 0.68 |',
  '| 一塁到達 → 走力 | 0.62 |',
  '| **送球速度 → 肩力** | **0.17** |',
  '',
  '送球速度の位置別中央値は 右翼138.9／三塁129.3／捕手128.1／遊撃127.5／二塁117.0／一塁111.9 と、'
  + '**送球する距離の順にきれいに並びました**。つまりこの数字が測っているのは肩の強さではなく、'
  + '「その位置でどれくらいの距離を投げるか」です。位置ごとに揃えても関係は出ませんでした（-0.09）。',
  '',
  '一方、打撃の数字は今の査定とはまったく別の経路で、パワーと弾道の材料になります。',
  'そちらを先に集めます。肩力は別の方法を探します。', '',
  '---', '',
  ...section('第1弾: 外野手・指名打者',
    '**ここが最優先です。** ハードヒット率とスイング速度が、パワーの材料として有望と実測で分かりました'
    + '（一致度0.76・0.75）。今のパワー査定は本塁打の数からの逆算だけで、**打球そのものの計測を持っていません**。'
    + '打球角度は弾道の材料になります。',
    second),
  '---', '',
  ...section('第2弾: 内野手と捕手（残り）',
    'こちらは急ぎません。打撃の数字は同じように使えますが、当初の狙いだった肩力には'
    + '送球速度が効かないと分かったためです。余裕がある時で結構です。',
    first),
];

await mkdir(path.join(ROOT, 'outputs'), { recursive: true });
const out = path.join(ROOT, 'outputs', `npb_plus_target_list_${SEASON}.md`);
await writeFile(out, md.join('\n'), 'utf8');
console.log(`対象 ${total}人（内野・捕手 ${first.length} / 外野・指名 ${second.length}）、取得済み ${doneCount}人、今季不出場で除外 ${dropped.length}人`);
console.log(`書き出し: ${path.relative(ROOT, out)}`);
db.close();
