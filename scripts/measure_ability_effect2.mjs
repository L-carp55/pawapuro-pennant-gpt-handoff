// 得能の効果を、交絡を潰して測り直す（第2版）。
//
// 第1版（measure_ability_effect.mjs）の結果は全部プラスで、仕様05 §2の「得能が多い→基礎能力を下げる」
// と逆だった。ただしそのまま「仕様が間違い」と読むのは早い。少なくとも2つの交絡が残っている:
//
//  交絡A【指標の取り違え】 盗塁得能や内野安打○を**打率**で層別していた。これらは打率から来る能力ではないので、
//    層別になっていない。→ その得能が効く成績そのもの（盗塁数・内野安打率）で層別する。
//
//  交絡B【単年のブレ vs 複数年の評判】 得能は複数年の実績・評判で付くが、層別に使った打率は**単年**。
//    同じ単年打率でも、得能を持つ選手の方が「本当の実力」は高い（単年で沈んだだけ）可能性がある。
//    → 前後3年の打数加重平均で層別し直し、効果が縮む／反転するかを見る。縮めば交絡Bが説明。
//
// 結論の書き方: 効果が残った場合のみ「パワプロの実装ではこう扱われている」と言える。
// これは**パワプロの内部規則の観測**であって、自作査定の採否を決めるものではない（採否の物差しは
// configs/ratings.json special_abilities.base_reflection._judging_criterion）。

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
function tstat(a, b) {
  if (a.length < 3 || b.length < 3) return null;
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length;
  const d = Math.sqrt(va + vb);
  return d > 0 ? (mean(a) - mean(b)) / d : null;
}

const rows = db.prepare(`SELECT f.rowid, f.work, f.meet, f.power, f.speed,
    f.ranked_json, f.plus_json, f.minus_json, l.proeye_id
  FROM pawapuro_full f JOIN pawapuro_full_link l ON l.pawa_rowid = f.rowid`).all()
  .map(r => ({ ...r, ranked: JSON.parse(r.ranked_json), plus: JSON.parse(r.plus_json), minus: JSON.parse(r.minus_json) }));

const single = db.prepare(`SELECT ab, h, hr, so, sb, cs, b3, gdp FROM v_batting WHERE player_id=? AND season=? AND ab>=100`);
// 前後3年（当年含む）の打数加重平均＝「本当の実力」に近い量
const multi = db.prepare(`SELECT SUM(ab) ab, SUM(h) h, SUM(hr) hr, SUM(so) so, SUM(sb) sb, SUM(b3) b3
  FROM v_batting WHERE player_id=? AND season BETWEEN ? AND ? AND ab>0`);
// 内野安打（NF3、2005-2025）
const ihOf = db.prepare(`SELECT t.ih FROM nf3_team_bat t
  JOIN nf3_team_link l ON l.season=t.season AND l.name_norm=t.name_norm
  WHERE l.proeye_id=? AND t.season=?`);

const data = [];
for (const r of rows) {
  const y = Number(r.work);
  const s = single.get(r.proeye_id, y);
  if (!s) continue;
  const m = multi.get(r.proeye_id, y - 2, y + 2);
  let ih = null;
  try { ih = ihOf.get(r.proeye_id, y)?.ih ?? null; } catch { }
  data.push({
    ...r,
    avg1: s.h / s.ab, hr1: s.hr / s.ab, so1: s.so / s.ab, sb1: s.sb, b31: s.b3 / s.ab,
    avgM: m?.ab >= 300 ? m.h / m.ab : null,
    hrM: m?.ab >= 300 ? m.hr / m.ab : null,
    soM: m?.ab >= 300 ? m.so / m.ab : null,
    sbM: m?.ab >= 300 ? m.sb : null,
    ihRate: ih != null && s.ab > 0 ? ih / s.ab : null,
  });
}
console.log(`対象 ${data.length}人（パワプロ×実成績が揃う）\n`);

/**
 * @param stratKey 層別に使う成績（この値が同じ選手同士を比べる）
 */
function cmp(label, ability, has, stratKey, binWidth, minPer = 5) {
  const g = data.filter(r => r[ability] != null && r[stratKey] != null);
  if (g.length < 30) { console.log(`  ${label}: 対象${g.length}人で不足`); return null; }
  const bins = new Map();
  for (const r of g) {
    const b = Math.round(r[stratKey] / binWidth);
    if (!bins.has(b)) bins.set(b, { yes: [], no: [] });
    (has(r) ? bins.get(b).yes : bins.get(b).no).push(r[ability]);
  }
  // 各層の差を、層の人数で重み付けして合成（層内比較のみを使う＝交絡を潰す）
  let wsum = 0, wdiff = 0, nY = 0, nN = 0, usedBins = 0;
  const yAll = [], nAll = [];
  for (const [, v] of bins) {
    if (v.yes.length < minPer || v.no.length < minPer) continue;
    const w = Math.min(v.yes.length, v.no.length);
    wdiff += (mean(v.yes) - mean(v.no)) * w; wsum += w;
    nY += v.yes.length; nN += v.no.length; usedBins++;
    yAll.push(...v.yes); nAll.push(...v.no);
  }
  if (!wsum) { console.log(`  ${label}: 比較できる層が無い`); return null; }
  const d = wdiff / wsum, t = tstat(yAll, nAll);
  console.log(`  ${label}: ${d >= 0 ? '+' : ''}${d.toFixed(1)}点 （${usedBins}層 / 持つ${nY}・持たない${nN}${t != null ? ` / t=${t.toFixed(2)}` : ''}）`);
  return d;
}

console.log('=== 交絡A対策: その得能が効く成績そのもので層別する ===');
console.log('（第1版は全部「打率」で層別していた＝盗塁や内野安打には層別になっていなかった）\n');
console.log('走力:');
cmp('盗塁得能（盗塁数で層別）', 'speed', r => '盗塁' in r.ranked, 'sb1', 5);
cmp('内野安打○（内野安打率で層別）', 'speed', r => r.plus.includes('内野安打○'), 'ihRate', 0.01);
console.log('パワー:');
cmp('パワーヒッター（本塁打率で層別）', 'power', r => r.plus.includes('パワーヒッター'), 'hr1', 0.005);
console.log('ミート:');
cmp('広角打法（打率で層別）', 'meet', r => r.plus.includes('広角打法'), 'avg1', 0.02);
cmp('三振赤（三振率で層別）', 'meet', r => r.minus.includes('三振'), 'so1', 0.02);

console.log('\n=== 交絡B対策: 単年 → 前後5年の加重平均で層別し直す ===');
console.log('（得能は複数年の評判で付くが、単年成績はブレる。同じ単年成績でも得能持ちは実力が上の可能性）\n');
console.log('ミート（広角打法）:');
const m1 = cmp('  単年打率で層別', 'meet', r => r.plus.includes('広角打法'), 'avg1', 0.02);
const m2 = cmp('  複数年打率で層別', 'meet', r => r.plus.includes('広角打法'), 'avgM', 0.02);
console.log('パワー（パワーヒッター）:');
const p1 = cmp('  単年本塁打率で層別', 'power', r => r.plus.includes('パワーヒッター'), 'hr1', 0.005);
const p2 = cmp('  複数年本塁打率で層別', 'power', r => r.plus.includes('パワーヒッター'), 'hrM', 0.005);
console.log('走力（盗塁得能）:');
const s1 = cmp('  単年盗塁で層別', 'speed', r => '盗塁' in r.ranked, 'sb1', 5);
const s2 = cmp('  複数年盗塁で層別', 'speed', r => '盗塁' in r.ranked, 'sbM', 10);

console.log('\n=== 判定 ===');
for (const [lab, a, b] of [['ミート/広角打法', m1, m2], ['パワー/パワーヒッター', p1, p2], ['走力/盗塁', s1, s2]]) {
  if (a == null || b == null) { console.log(`  ${lab}: 判定不能（層が足りない）`); continue; }
  const shrink = Math.abs(a) > 0 ? (1 - Math.abs(b) / Math.abs(a)) * 100 : 0;
  console.log(`  ${lab}: 単年${a >= 0 ? '+' : ''}${a.toFixed(1)} → 複数年${b >= 0 ? '+' : ''}${b.toFixed(1)}`
    + `（${shrink > 20 ? `**${shrink.toFixed(0)}%縮小＝交絡Bが効いていた**` : shrink < -20 ? '拡大' : 'ほぼ変わらず＝交絡Bでは説明できない'}）`);
}
db.close();
