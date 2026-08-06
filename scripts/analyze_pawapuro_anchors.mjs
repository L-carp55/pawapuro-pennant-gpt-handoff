// パワプロの能力値を「正解」として、どの統計がそれと相関するかを実測する。
//
// なぜこの向きでやるか（2026-08-01 オーナー指摘）:
//   これまでCCが「これが脚力を測るはず」と**推測で材料を選んで**いた
//   （三塁打・内野安打・併殺回避・UBR・盗塁企図）。その推測が外れていたのが、
//   走力が実感と合わない原因だった。
//
//   オーナー指摘: 「パワプロの能力を数十人分見て、それらと実際のデータを照合し、
//   相関のあるものを見つけるほうがいい」。
//   例として、盗塁の企図率は**走力が高くても仕掛けないタイプがいる**ので脚力の証拠にならない
//   （CCの検証でも源田が72→70と下がり、効いていないことが確認された）。
//
//   正解を数十人分もらえば、どの統計が本当に効くかを**推測でなく実測で**決められる。
//
// 入力: outputs/pawapuro_anchor_sheet.md の「パワプロの走力／肩力」欄
// 出力: outputs/derived/pawapuro_anchor_analysis.json ＋ 画面
//
// 使い方: node scripts/analyze_pawapuro_anchors.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = path.join(ROOT, 'outputs', 'pawapuro_anchor_sheet.md');

/** ランク or 数値 → 100段階の代表値。ランクは帯の中央を採る */
const RANK_MID = { S: 95, A: 85, B: 75, C: 65, D: 55, E: 45, F: 30, G: 10 };
function toValue(cell) {
  const t = (cell ?? '').trim().toUpperCase().replace(/[～~]/g, '-');
  if (!t) return null;
  const n = Number(t);
  if (Number.isFinite(n) && n >= 1 && n <= 100) return { value: n, kind: '数値' };
  // 「S/A」「A-B」のような幅つき表記は両端の平均
  const ranks = [...t.matchAll(/[SABCDEFG]/g)].map(m => RANK_MID[m[0]]).filter(v => v != null);
  if (ranks.length) return { value: ranks.reduce((a, b) => a + b, 0) / ranks.length, kind: ranks.length > 1 ? 'ランク(幅)' : 'ランク' };
  return null;
}

if (!existsSync(SHEET)) { console.error(`記入シートが無い: ${path.relative(ROOT, SHEET)}`); process.exit(1); }

const filled = [];
for (const line of readFileSync(SHEET, 'utf8').split('\n')) {
  if (!/^\|\s*\d+\s*\|/.test(line)) continue;
  const c = line.split('|').map(s => s.trim());
  // | # | 選手 | 球団 | 位置 | 年 | 盗塁 | 自作 | パワ走力 | パワ肩力 |
  const speed = toValue(c[8]), arm = toValue(c[9]);
  if (!speed && !arm) continue;
  filled.push({ name: c[2].replace(/\s+/g, ''), season: Number(c[5]), speed, arm });
}

if (!filled.length) {
  console.log('まだ1件も記入されていない。');
  console.log(`${path.relative(ROOT, SHEET)} の「パワプロの走力／肩力」欄を埋めてから、もう一度実行する。`);
  process.exit(0);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

// --- 候補になる統計を全部集める（推測で絞らない） ---
const rows = db.prepare(`
  SELECT b.player_id, b.name, b.season, b.pa, b.ab, b.h, b.so, b.b2, b.b3, b.hr, b.gdp, b.sb, b.cs,
         bm.ubr, bm.wsb, m.gb_pct, m.ld_pct, m.offb_pct, m.iffb_pct, m.babip,
         t.ih, t.bats,
         f.rngr, f.arm AS fld_arm, f.inn AS fld_inn, f.pos AS fld_pos,
         pf.a AS assists, pf.g AS fld_g, pf.po AS putouts
  FROM v_batting b
  LEFT JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  LEFT JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
  LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  LEFT JOIN bm_fld f ON f.player_id=l.bm_id AND f.season=b.season AND f.farm=0 AND f.inn>=200
  LEFT JOIN v_fielding pf ON pf.player_id=b.player_id AND pf.season=b.season AND pf.g>=40
  WHERE b.pa>=300 AND b.position<>'投'`).all();

const byKey = new Map();
for (const r of rows) {
  const k = `${normName(r.name)}|${r.season}`;
  if (!byKey.has(k)) byKey.set(k, r);
}

/** 候補となる統計。ここは**絞らずに全部入れる**（何が効くかは実測で決める） */
const CANDIDATES = {
  三塁打割合: r => (r.b2 + r.b3) > 0 ? r.b3 / (r.b2 + r.b3) : null,
  三塁打率: r => r.b3 / Math.max(1, r.ab - r.so - r.hr),
  内野安打率: r => r.ih != null ? r.ih / Math.max(1, r.ab - r.so) : null,
  内野安打の割合: r => (r.ih != null && r.h > 0) ? r.ih / r.h : null,
  併殺回避: r => -r.gdp / Math.max(1, (r.ab - r.so) * ((r.gb_pct ?? 45) / 100)),
  UBR: r => r.ubr != null ? r.ubr / r.pa : null,
  盗塁企図率: r => (r.sb + r.cs) / r.pa,
  盗塁成功率: r => (r.sb + r.cs) >= 5 ? r.sb / (r.sb + r.cs) : null,
  盗塁数: r => r.sb,
  wSB: r => r.wsb != null ? r.wsb / r.pa : null,
  BABIP: r => r.babip,
  ゴロ率: r => r.gb_pct,
  守備範囲: r => (r.rngr != null && r.fld_inn) ? r.rngr / r.fld_inn * 1000 : null,
  // 肩の候補
  ARM: r => (r.fld_arm != null && r.fld_inn) ? r.fld_arm / r.fld_inn * 1000 : null,
  補殺率: r => (r.assists != null && r.fld_g) ? r.assists / r.fld_g : null,
  刺殺率: r => (r.putouts != null && r.fld_g) ? r.putouts / r.fld_g : null,
};

const cor = (xs, ys) => {
  const n = xs.length;
  if (n < 5) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return (sxx > 0 && syy > 0) ? sxy / Math.sqrt(sxx * syy) : null;
};

const matched = [], unmatched = [];
for (const f of filled) {
  const r = byKey.get(`${normName(f.name)}|${f.season}`);
  if (r) matched.push({ ...f, stats: r }); else unmatched.push(`${f.name} ${f.season}`);
}

const result = { measured_at: '2026-08-01', filled: filled.length, matched: matched.length, unmatched, targets: {} };

for (const target of ['speed', 'arm']) {
  const have = matched.filter(m => m[target]);
  if (have.length < 5) { result.targets[target] = { n: have.length, note: '5件未満のため相関を出さない' }; continue; }
  const y = have.map(m => m[target].value);
  const cors = {};
  for (const [name, f] of Object.entries(CANDIDATES)) {
    const pairs = have.map((m, i) => [f(m.stats), y[i]]).filter(([a]) => a != null && Number.isFinite(a));
    if (pairs.length < 5) continue;
    cors[name] = { r: cor(pairs.map(p => p[0]), pairs.map(p => p[1])), n: pairs.length };
  }
  result.targets[target] = {
    n: have.length,
    correlations: Object.fromEntries(Object.entries(cors).sort((a, b) => Math.abs(b[1].r ?? 0) - Math.abs(a[1].r ?? 0))),
  };
}

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'pawapuro_anchor_analysis.json'), JSON.stringify(result, null, 2), 'utf8');

console.log(`記入 ${filled.length}件 / データと突合できた ${matched.length}件`);
if (unmatched.length) console.log(`突合できなかった: ${unmatched.join(', ')}`);
for (const [target, v] of Object.entries(result.targets)) {
  const label = target === 'speed' ? '走力' : '肩力';
  console.log(`\n## ${label}（正解 ${v.n}件）`);
  if (v.note) { console.log(`  ${v.note}`); continue; }
  console.log('  統計                 相関    n');
  for (const [name, c] of Object.entries(v.correlations)) {
    if (c.r == null) continue;
    const bar = '#'.repeat(Math.round(Math.abs(c.r) * 20));
    console.log(`  ${name.padEnd(14)} ${(c.r >= 0 ? '+' : '') + c.r.toFixed(3)}  ${String(c.n).padStart(3)}  ${bar}`);
  }
}
console.log('\n相関の高いものを材料に採り、低いものは外す。重みは相関の大きさから決める。');
console.log('件数が少ないと相関は不安定なので、20件以上を目安にする。');
db.close();
