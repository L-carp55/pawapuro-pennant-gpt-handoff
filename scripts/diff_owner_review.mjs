// オーナー査定シートの記入結果を読み、ずれの大きい順に並べて原因の手がかりを出す。
//
// 位置づけ: これは**検査用の物差し**（2026-08-04 オーナー確定）。オーナー値に合わせに行くための
// 較正スクリプトではない。出力するのは「どこがどれだけずれているか」と「原因を探る手がかり」だけで、
// configs へ書き戻すことは**しない**（合わせに行くことと診断することを混同しないため）。
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] ?? 2024);
const SHEET = path.join(ROOT, 'outputs', `owner_review_sheet_${SEASON}.md`);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));

// ランク→数値。rank_scale の閾値の中央を代表値にする（境界の下限そのものだと系統的に低く出るため）
const TH = cfg.rank_scale.thresholds; // [[rank, min], ...] 降順
function rankToValue(rank) {
  const i = TH.findIndex(([r]) => r === rank);
  if (i < 0) return null;
  const lo = TH[i][1];
  const hi = i === 0 ? 100 : TH[i - 1][1];
  return (lo + hi) / 2;
}
function parseCell(s, ability) {
  const t = (s ?? '').trim();
  if (!t || t === '—' || t === '-') return null;
  if (ability === '弾道') { const n = Number(t); return Number.isFinite(n) ? n : null; }
  const n = Number(t);
  if (Number.isFinite(n)) return n;
  const m = t.toUpperCase().match(/^[SABCDEFG]/);
  return m ? rankToValue(m[0]) : null;
}

const text = await readFile(SHEET, 'utf8');
const lines = text.split(/\r?\n/);

const players = [];
let cur = null;
for (const l of lines) {
  const h = l.match(/^### (.+?)（(.+?) (.+?)） (\d+)年 (\d+)打席 打率([.\d]+) (\d+)本 (\d+)盗塁/);
  if (h) { cur = { name: h[1], team: h[2], pos: h[3], pa: +h[5], avg: h[6], hr: +h[7], sb: +h[8], rows: {} }; players.push(cur); continue; }
  if (!cur) continue;
  const c = l.match(/^\|\s*(弾道|ミート|パワー|走力|肩力|守備力|捕球)\s*\|(.*?)\|(.*?)\|(.*?)\|\s*$/);
  if (c) {
    const ab = c[1];
    cur.rows[ab] = { mine: parseCell(c[2], ab), pawa: parseCell(c[3], ab), owner: parseCell(c[4], ab) };
  }
}

const filled = [];
for (const p of players) {
  for (const [ab, v] of Object.entries(p.rows)) {
    if (v.owner == null) continue;
    filled.push({
      player: p.name, team: p.team, pos: p.pos, pa: p.pa, avg: p.avg, hr: p.hr, sb: p.sb,
      ability: ab, mine: v.mine, pawa: v.pawa, owner: v.owner,
      diffMine: v.mine == null ? null : v.owner - v.mine,
      diffPawa: v.pawa == null ? null : v.owner - v.pawa,
    });
  }
}

if (!filled.length) {
  console.log(`記入がまだありません。${path.relative(ROOT, SHEET)} の「あなた」列を埋めてから再実行してください。`);
  process.exit(0);
}

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const ABILS = ['弾道', 'ミート', 'パワー', '走力', '肩力', '守備力', '捕球'];

console.log(`記入 ${filled.length}件 / ${new Set(filled.map(f => f.player)).size}選手\n`);

console.log('=== 能力別: 自作はあなたの評価からどれだけずれているか ===');
console.log('能力      n   平均ずれ  平均絶対ずれ  最大ずれ(選手)          パワプロの平均ずれ');
for (const ab of ABILS) {
  const g = filled.filter(f => f.ability === ab && f.diffMine != null);
  if (!g.length) continue;
  const d = g.map(f => f.diffMine);
  const worst = g.reduce((a, b) => Math.abs(b.diffMine) > Math.abs(a.diffMine) ? b : a);
  const gp = g.filter(f => f.diffPawa != null);
  const pawaMean = gp.length ? mean(gp.map(f => f.diffPawa)) : null;
  console.log(
    ab.padEnd(6) + String(g.length).padStart(4)
    + (mean(d) >= 0 ? '+' : '') + mean(d).toFixed(1).padStart(8)
    + mean(d.map(Math.abs)).toFixed(1).padStart(12)
    + `   ${worst.diffMine >= 0 ? '+' : ''}${worst.diffMine.toFixed(0)} (${worst.player})`.padEnd(24)
    + (pawaMean == null ? '' : `  ${pawaMean >= 0 ? '+' : ''}${pawaMean.toFixed(1)}`));
}

console.log('\n=== 診断: 自作とパワプロ、どちらがあなたに近いか ===');
for (const ab of ABILS) {
  const g = filled.filter(f => f.ability === ab && f.diffMine != null && f.diffPawa != null);
  if (!g.length) continue;
  const mAbs = mean(g.map(f => Math.abs(f.diffMine)));
  const pAbs = mean(g.map(f => Math.abs(f.diffPawa)));
  const verdict = Math.abs(mAbs - pAbs) < 1 ? '差なし'
    : mAbs < pAbs ? '★自作の方が近い' : 'パワプロの方が近い';
  console.log(`${ab.padEnd(6)} 自作のずれ ${mAbs.toFixed(1)} / パワプロのずれ ${pAbs.toFixed(1)}  → ${verdict}`);
}

console.log('\n=== ずれの大きい順（上位20件・原因を探る対象） ===');
const sorted = [...filled].filter(f => f.diffMine != null).sort((a, b) => Math.abs(b.diffMine) - Math.abs(a.diffMine));
console.log('選手           能力    自作  パワプロ  あなた  自作とのずれ  成績');
for (const f of sorted.slice(0, 20)) {
  console.log(
    f.player.padEnd(14) + f.ability.padEnd(7)
    + String(f.mine ?? '—').padStart(4)
    + String(f.pawa ?? '—').padStart(9)
    + String(f.owner).padStart(7)
    + `${f.diffMine >= 0 ? '+' : ''}${f.diffMine.toFixed(0)}`.padStart(13)
    + `   ${f.pa}打席 打率${f.avg} ${f.hr}本 ${f.sb}盗`);
}

// 系統的なずれ（全体的に高すぎ/低すぎ）か、順序のずれかを分ける
console.log('\n=== ずれの性質（目盛りのずれか、順序のずれか） ===');
for (const ab of ABILS) {
  const g = filled.filter(f => f.ability === ab && f.diffMine != null);
  if (g.length < 5) continue;
  const d = g.map(f => f.diffMine);
  const m = mean(d);
  const sd = Math.sqrt(mean(d.map(x => (x - m) ** 2)));
  const kind = Math.abs(m) > sd ? '**目盛りのずれ**（全体的に一方向）'
    : sd > Math.abs(m) * 2 ? '**順序のずれ**（選手ごとにバラバラ＝材料の問題）'
      : '混在';
  console.log(`${ab.padEnd(6)} 平均${m >= 0 ? '+' : ''}${m.toFixed(1)} ばらつき${sd.toFixed(1)} → ${kind}`);
}

const outPath = path.join(ROOT, 'outputs', 'derived', `owner_review_diff_${SEASON}.json`);
await writeFile(outPath, JSON.stringify({
  season: SEASON, filled_count: filled.length,
  _note: '検査用の物差しの結果。configsへ自動反映はしない（合わせに行くことと診断することを混同しないため）',
  records: filled,
}, null, 2), 'utf8');
console.log(`\n→ ${path.relative(ROOT, outPath)}`);
