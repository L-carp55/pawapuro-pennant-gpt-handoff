// 走力の指標構成を実データで検証する（Sol仕様 04 §1）。
// 仕様は「走力＝純粋な脚力。盗塁数・成功率そのものではない」とし、
// 補助指標として 三塁打率 / 内野安打率 / 併殺回避 / BsR・UBR / 追加進塁率 を挙げる。
//
// ここで確かめること:
//   1. これらの指標に共通因子（＝走力）が実在するか（相関構造）
//   2. 盗塁成功率が走力とどれだけ独立か（仕様の主張の検証）
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_PA = Number(process.argv[2] || 300);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const rows = db.prepare(`
  SELECT b.season, b.name, b.pa, b.ab, b.h, b.b3, b.hr, b.so, b.gdp, b.sb, b.cs,
         p.ubr, p.wsb, m.gb_pct
  FROM v_batting b
  JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
  JOIN v_bm_player p ON p.player_id=l.bm_id AND p.season=b.season AND p.farm=0
  LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
  WHERE b.pa>=? AND b.position<>'投' AND p.ubr IS NOT NULL`).all(MIN_PA);

console.log(`対象: ${rows.length}選手シーズン（${MIN_PA}打席以上）`);

const recs = rows.map(r => {
  const inplay = r.ab - r.so;
  const gbCount = m => inplay * ((r.gb_pct ?? 45) / 100);
  return {
    name: r.name, season: r.season,
    // 三塁打率: インプレー打球あたり（本塁打を除く）
    tripleRate: r.b3 / Math.max(1, inplay - r.hr),
    // 併殺回避: ゴロ打球あたりの併殺の少なさ（多いほど足が遅い→符号反転）
    gdpAvoid: -r.gdp / Math.max(1, gbCount()),
    // 走塁貢献: 打席あたりのUBR
    ubrRate: r.ubr / r.pa,
    // 盗塁（走力の指標ではなく、比較対象として保持）
    sbRate: (r.sb + r.cs) / r.pa,
    sbSuccess: (r.sb + r.cs) >= 5 ? r.sb / (r.sb + r.cs) : null,
    wsbRate: r.wsb / r.pa,
  };
});

const z = key => {
  const v = recs.map(r => r[key]).filter(x => x != null && Number.isFinite(x));
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
  return r => (r[key] == null || !Number.isFinite(r[key])) ? null : (r[key] - m) / sd;
};

const zf = {
  triple: z('tripleRate'), gdp: z('gdpAvoid'), ubr: z('ubrRate'),
  sbAttempt: z('sbRate'), wsb: z('wsbRate'),
};

function corr(a, b) {
  const pairs = recs.map(r => [zf[a](r), zf[b](r)]).filter(([x, y]) => x != null && y != null);
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n, my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return { r: sxy / Math.sqrt(sxx * syy), n };
}

console.log('\n=== 走力の候補指標どうしの相関 ===');
console.log('（共通因子＝走力が実在するなら、三塁打率・併殺回避・UBRは互いに正の相関を持つはず）\n');
const keys = ['triple', 'gdp', 'ubr', 'sbAttempt', 'wsb'];
const label = { triple: '三塁打率', gdp: '併殺回避', ubr: 'UBR/打席', sbAttempt: '盗塁企図率', wsb: 'wSB/打席' };
console.log('        ' + keys.map(k => label[k].padStart(10)).join(''));
for (const a of keys) {
  console.log(label[a].padEnd(9) + keys.map(b => (a === b ? '—' : corr(a, b).r.toFixed(3)).padStart(10)).join(''));
}

// 走力スコア: 純粋な脚力の候補3指標を合成（盗塁は入れない＝仕様§1.1）
const speedOf = r => {
  const parts = [zf.triple(r), zf.gdp(r), zf.ubr(r)].filter(x => x != null);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
};

console.log('\n=== 走力スコア上位・下位（盗塁を入れずに算出） ===');
const scored = recs.map(r => ({ ...r, speed: speedOf(r) })).filter(r => r.speed != null);
const show = r => `${r.name.replace(/　/g, ' ').padEnd(13)}${r.season}  走力z=${r.speed.toFixed(2).padStart(6)}  三塁打率${(r.tripleRate * 100).toFixed(2)}%  UBR/打席${(r.ubrRate * 1000).toFixed(2)}  盗塁企図${(r.sbRate * 100).toFixed(1)}%  成功率${r.sbSuccess != null ? (r.sbSuccess * 100).toFixed(0) + '%' : '—'}`;
for (const r of [...scored].sort((a, b) => b.speed - a.speed).slice(0, 6)) console.log('  ' + show(r));
console.log('  ...');
for (const r of [...scored].sort((a, b) => a.speed - b.speed).slice(0, 3)) console.log('  ' + show(r));

// 仕様§2の主張の検証: 走力と盗塁成功率は別物か
const withSb = scored.filter(r => r.sbSuccess != null);
const mS = withSb.reduce((a, r) => a + r.speed, 0) / withSb.length;
const mR = withSb.reduce((a, r) => a + r.sbSuccess, 0) / withSb.length;
let sxy = 0, sxx = 0, syy = 0;
for (const r of withSb) { sxy += (r.speed - mS) * (r.sbSuccess - mR); sxx += (r.speed - mS) ** 2; syy += (r.sbSuccess - mR) ** 2; }
console.log(`\n=== 仕様§2「走力と盗塁は別物」の検証 ===`);
console.log(`走力スコア と 盗塁成功率 の相関: r=${(sxy / Math.sqrt(sxx * syy)).toFixed(3)}  (n=${withSb.length}、企図5回以上)`);
console.log('→ 相関が低いほど、盗塁を走力から独立の得能として査定する仕様の妥当性が高い');

// 走力に対する盗塁の残差（＝盗塁得能の素）
const slope = sxy / sxx, icpt = mR - slope * mS;
const resid = withSb.map(r => ({ ...r, sbResid: r.sbSuccess - (icpt + slope * r.speed) }));
console.log('\n走力の割に盗塁が上手い/下手（＝盗塁得能）');
for (const r of [...resid].sort((a, b) => b.sbResid - a.sbResid).slice(0, 3))
  console.log(`  上手い: ${r.name.replace(/　/g, ' ').padEnd(13)}${r.season} 走力z=${r.speed.toFixed(2)} 成功率${(r.sbSuccess * 100).toFixed(0)}% 残差${(r.sbResid * 100).toFixed(1)}pt`);
for (const r of [...resid].sort((a, b) => a.sbResid - b.sbResid).slice(0, 3))
  console.log(`  下手  : ${r.name.replace(/　/g, ' ').padEnd(13)}${r.season} 走力z=${r.speed.toFixed(2)} 成功率${(r.sbSuccess * 100).toFixed(0)}% 残差${(r.sbResid * 100).toFixed(1)}pt`);

db.close();
