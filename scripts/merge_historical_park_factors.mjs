// Web収集した2006-2022年の球場係数を、自前の実測(2023-2025)と同じ目盛りへ揃えて取り込む。
//
// 出典: NF3（プロ野球 ヌルデータ置き場）年度別球場データ。Codexが収集（2026-08-05）。
//   収集ファイル: outputs/derived/web_collected_measurements.json（全488件・出典URL全件あり）
//
// なぜ必要か:
//   球場補正は2026-08-05に接続したが、自前の実測が **2023-2025年しか無い**。
//   それ以前の年は補正が効かず、甲子園のような極端な球場の打者が不利なままだった。
//   Web収集で2006-2022年（12球場×17年）が埋まる。
//
// ★なぜそのまま使えないか（測り方が違う）:
//   収集値（一般的なパークファクター）= その球場での本塁打数 ÷ 他球場での本塁打数（チーム単位）
//   自前の実測                        = 同一打者内の比（その選手がその球場で打った率 ÷ 同じ選手の他球場での率）
//   自前の方は打者の顔ぶれを揃えているぶん球場の効果が純粋に出て、**幅が広くなる**。
//   実測: 2022年の収集値と2023-25年の実測で、12球場の順位は r=0.882 と一致するが、
//         幅（標準偏差）は 0.228 vs 0.401 で **1.76倍** 違う。
//   そのまま混ぜると、2022年以前だけ補正が弱い状態になる。
//
// 揃え方:
//   収集値を「リーグ平均1.0からの離れ具合」とみなし、幅の比だけを掛ける。
//     揃えた値 = 1.0 + (収集値 - 1.0) × (実測の幅 ÷ 収集の幅)
//   順位は変えない。中心も動かさない。
//
// ★この接続に入っている仮定（成果物に必ず残すこと）:
//   比較に使った2022年（収集）と2023-25年（実測）は **年が重なっていない**。
//   「球場の性質は1年で大きく変わらない」という仮定に依存する。
//   実際、ベルーナドーム（1.07→0.80）と楽天モバイル（1.01→0.74）は大きく動いており、
//   この2球場では仮定が成り立っていない可能性がある。12球場中2球場。
//
// 使い方: node scripts/merge_historical_park_factors.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const web = (() => {
  const j = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'web_collected_measurements.json'), 'utf8'));
  return Array.isArray(j) ? j : (j.records ?? []);
})();
const own = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'park_factors.json'), 'utf8'));

// 収集値は同じ年・同じ球場に複数条件（全試合対象／同一リーグ）がある。全試合対象を採る
// （自前の実測も相手を選ばず全打席から作っているため、条件を揃える）
const parkRows = web.filter(r => r.category === 'park' && /全試合対象|ALL/.test(r.context ?? ''));

/** 表記ゆれを吸収して自前の球場名へ寄せる */
const alias = (name) => {
  const n = String(name ?? '');
  const own_ = Object.keys(own.hr.parks);
  return own_.find(k => k === n)
    ?? own_.find(k => k.replace('ドーム', '') === n.replace('ドーム', ''))
    ?? (n.includes('PayPay') ? own_.find(k => k.includes('PayPay')) : null)
    ?? (n.includes('ナゴヤ') ? own_.find(k => k.includes('バンテリン')) : null)
    ?? n;
};

const sd = a => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };

// 幅の比を、直近年（収集の最終年）と自前の実測が対応する球場から求める
const lastSeason = Math.max(...parkRows.map(r => r.season).filter(Number.isFinite));
const pairs = [];
for (const r of parkRows.filter(r => r.season === lastSeason)) {
  const key = alias(r.player);
  const mine = own.hr.parks[key]?.factor;
  if (mine != null) pairs.push({ park: key, web: r.value, mine });
}
if (pairs.length < 6) {
  console.error(`対応が取れた球場が ${pairs.length} しかない。揃えられない`);
  process.exit(1);
}
const ratio = sd(pairs.map(p => p.mine)) / sd(pairs.map(p => p.web));

function corr(a, b) {
  const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let nu = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; nu += x * y; da += x * x; db += y * y; }
  return nu / Math.sqrt(da * db);
}
const rankAgreement = corr(pairs.map(p => p.web), pairs.map(p => p.mine));

// 年×球場で揃えた係数を作る
const bySeason = {};
for (const r of parkRows) {
  const key = alias(r.player);
  const scaled = 1.0 + (r.value - 1.0) * ratio;
  (bySeason[r.season] ??= {})[key] = {
    factor: scaled,
    _raw: r.value,
    source_url: r.source_url,
    source_name: r.source_name ?? 'NF3',
  };
}

own.historical = {
  _comment: 'Web収集した2006-2022年の球場係数を、自前の実測(2023-2025)と同じ目盛りへ揃えたもの',
  _source: 'NF3 年度別球場データ（Codexが2026-08-05に収集。出典URLは各値に保持）',
  _why_scaled:
    '収集値は一般的なパークファクター（チーム単位の比）、自前の実測は同一打者内の比。'
    + `後者の方が幅が広い（標準偏差 ${sd(pairs.map(p => p.mine)).toFixed(3)} vs ${sd(pairs.map(p => p.web)).toFixed(3)}）。`
    + 'そのまま混ぜると2022年以前だけ補正が弱くなるため、幅の比だけを掛けて揃えた。順位・中心は変えない',
  _scaling: { ratio, formula: '揃えた値 = 1.0 + (収集値 - 1.0) × ratio' },
  _agreement: {
    compared_seasons: { web: lastSeason, own: '2023-2025' },
    parks: pairs.length,
    rank_correlation: rankAgreement,
  },
  _assumption:
    '★比較に使った年が重なっていない（収集2022 vs 実測2023-25）。'
    + '「球場の性質は1年で大きく変わらない」という仮定に依存する。'
    + `実際、${pairs.filter(p => Math.abs(p.web - p.mine) > 0.2).map(p => p.park).join('・')} は`
    + `0.2以上動いており、この球場では仮定が成り立っていない可能性がある（${pairs.length}球場中`
    + `${pairs.filter(p => Math.abs(p.web - p.mine) > 0.2).length}球場）`,
  _status: '★暫定。年が重なるデータが手に入れば揃え方を測り直すこと',
  bySeason,
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'park_factors.json'),
  JSON.stringify(own, null, 2), 'utf8');

const years = Object.keys(bySeason).map(Number).sort();
console.log(`球場係数を ${years[0]}〜${years.at(-1)}年へ拡張（${parkRows.length}件）`);
console.log(`  目盛りを揃える比: ${ratio.toFixed(3)}倍（${lastSeason}年の収集値 と 2023-25の実測、${pairs.length}球場で算出）`);
console.log(`  順位の一致: r=${rankAgreement.toFixed(3)}`);
const moved = pairs.filter(p => Math.abs(p.web - p.mine) > 0.2);
if (moved.length) {
  console.log(`  ★仮定が疑わしい球場（0.2以上動いた）: ${moved.map(p => `${p.park}(${p.web}→${p.mine.toFixed(2)})`).join(' / ')}`);
}
console.log('\n揃えた後の例（2022年）:');
for (const [k, v] of Object.entries(bySeason[lastSeason] ?? {}).sort((a, b) => b[1].factor - a[1].factor).slice(0, 6)) {
  console.log(`  ${k.padEnd(14)} 収集${String(v._raw).padStart(5)} → 揃えた後 ${v.factor.toFixed(2)}`);
}
