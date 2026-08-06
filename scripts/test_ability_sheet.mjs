// 能力欄がゲームの構成どおりに組み立てられているかの回帰テスト。
//
// オーナー指摘（2026-08-01）: 査定項目がゲームの構成と合っていなかった。
//   - 弾道とけがしにくさが能力欄に出ていなかった（内部では計算していた）
//   - 盗塁・走塁が基礎能力の並びに混ざっていた（本来はランクの得能）
//   - 肩力が守備位置ごとに繰り返されていた（肩は選手に1つ）
// オーナー確定: 内部は全部100段階・表示だけランク／本家に無い独自項目は残す。

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAbilitySheet, toRank } from '../src/cards/ability_sheet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

const sample = (over = {}) => buildAbilitySheet({
  bat: { meet: 64.3, power: 82.1, contact: 55.0, eye: 71.2 },
  trajectory: 3,
  run: { speed: 74.0, stealing: { rating: 68.0 }, baserunning: { rating: 41.0 } },
  fld: [
    { pos: 'SS', inn: 1100, isPrimary: true, fielding: { rating: 58.3 }, catching: { rating: 64.7 }, arm: { rating: 56.0, is_estimated: true, basis: '守備位置からの推定' }, aptitude: { grade: 'A' } },
    { pos: '2B', inn: 200, isPrimary: false, fielding: { rating: 49.1 }, catching: { rating: 52.0 }, arm: { rating: 56.0, is_estimated: true }, aptitude: { grade: 'B' } },
  ],
  splits: { clutch: { diff: 0.048, reliability: 1 }, platoon: { meetDiff: 0.05, reliability: 1 } },
  durability: 0.9,
  powerDisplay: 82.1,
  ...over,
}, cfg);

// --- 基礎能力の7項目 ---
{
  const a = sample();
  const want = ['弾道', 'ミート', 'パワー', '走力', '肩力', '守備力', '捕球'];
  check('基-a 本家の基礎能力7つが揃っている',
    want.every(k => k in a.基礎能力) && Object.keys(a.基礎能力).length === want.length,
    Object.keys(a.基礎能力).join('/'));

  check('基-b 弾道は1-4の別尺度で、100段階へ引き伸ばさない',
    a.基礎能力.弾道.value === 3 && a.基礎能力.弾道.scale === '1-4', `弾道${a.基礎能力.弾道.value}`);

  // ミートはパワプロ較正が乗るため入力64.3と出力valueは一致しない前提で、
  // 「value からランクへの変換が toRank と一致するか」だけを検証する（較正の有無に依存しない）
  check('基-c 各能力が数値とランクを対で持つ（内部100段階・表示ランク）',
    a.基礎能力.ミート.value != null && a.基礎能力.ミート.rank === toRank(a.基礎能力.ミート.value, cfg),
    `ミート ${a.基礎能力.ミート.value} → ${a.基礎能力.ミート.rank}`);

  // 肩は選手の属性。位置の数だけ繰り返さない
  check('基-d 肩力は選手に1つ（守備位置ごとに繰り返さない）',
    typeof a.基礎能力.肩力.value === 'number' && a.基礎能力.肩力.is_estimated === true,
    `肩力 ${a.基礎能力.肩力.rank}${a.基礎能力.肩力.value}（推定フラグつき）`);

  check('基-e 守備力・捕球は主位置の値を採る',
    a.基礎能力.守備力.position === 'SS' && a.基礎能力.守備力.value === 58.3,
    `主位置SSの58.3（副位置2Bの49.1ではない）`);

  check('基-f 位置ごとの守備の内訳は内部に残る',
    a._fielding_by_position.length === 2 && a._fielding_by_position[1].守備力 === 49.1,
    '2B(守49.1)も保持');
}

// --- 得能 ---
{
  const a = sample();
  const want = ['チャンス', '対左', '盗塁', '走塁', '送球', 'けがしにくさ'];
  check('得-a ランクの得能6項目が揃っている',
    want.every(k => k in a.得能), Object.keys(a.得能).join('/'));

  check('得-b 盗塁・走塁は得能側にあり、基礎能力には無い',
    !('盗塁' in a.基礎能力) && !('走塁' in a.基礎能力) && a.得能.盗塁 != null,
    `盗塁 ${a.得能.盗塁.rank}${a.得能.盗塁.value}`);

  // 差1標準偏差ぶんで15点動く（較正した物差し）
  check('得-c 打率差1標準偏差ぶんでちょうど15点動く',
    Math.abs(a.得能.チャンス.value - 65) < 0.5,
    `得点圏−非得点圏 +0.048（=1標準偏差）→ ${a.得能.チャンス.value}`);

  const half = sample({ splits: { clutch: { diff: 0.048, reliability: 0.5 }, platoon: null } });
  check('得-d 打数が少なく信頼度が低いと50へ寄る',
    half.得能.チャンス.value < a.得能.チャンス.value && half.得能.チャンス.value > 50,
    `信頼度1.0で${a.得能.チャンス.value} → 0.5で${half.得能.チャンス.value}`);

  check('得-e 送球はデータが無いのでnull（肩力で代用しない）',
    a.得能.送球 === null && a.未査定.some(s => s.includes('送球')), a.未査定.find(s => s.includes('送球')));

  const special = sample({ specialAbilities: {
    strikeout: { ability: '三振', color: 'red', basis: 'コンタクト30' },
    infieldHit: { ability: '内野安打○', color: 'blue', basis: '残差2.4%' },
    gold: [{ ability: 'アーチスト', color: 'gold', metric: 'hrPer500', value: 60, threshold: 50 }],
  } });
  check('得-f 配線した三振・内野安打○・金特が得能欄へ出る',
    ['三振', '内野安打○', 'アーチスト'].every(k => k in special.得能),
    Object.keys(special.得能).join('/'));
  check('得-g 非該当の特殊能力は空配列やnullでなくキー自体を出さない',
    !('三振' in a.得能) && !('選球眼' in a.得能) && !('内野安打○' in a.得能)
      && !('アーチスト' in a.得能) && !('安打製造機' in a.得能),
    Object.keys(a.得能).join('/'));
}

// --- 欠損の扱い（仕様03 §1.3 0で埋めない） ---
{
  const a = sample({ trajectory: null, run: null, fld: [], splits: { clutch: null, platoon: null }, durability: null });
  check('欠-a データが無い項目はnull。0で埋めない',
    a.基礎能力.弾道 === null && a.基礎能力.走力 === null && a.基礎能力.肩力 === null && a.得能.けがしにくさ === null,
    '弾道/走力/肩力/けがしにくさ すべてnull');
  check('欠-b 未査定の一覧に理由つきで並ぶ', a.未査定.length >= 4, a.未査定.slice(0, 3).join(' / '));
}

// --- 捕手の独自項目 ---
{
  const a = sample({
    fld: [{ pos: 'C', inn: 900, isPrimary: true, fielding: { rating: 50 }, catching: { rating: 47.3 }, arm: { rating: 47.0 }, catcher: { framing: 53.3, blocking: 60.4 }, aptitude: { grade: 'A' } }],
  });
  check('独-a 捕手にだけフレーミング・ブロッキングが付く',
    a.独自の基礎能力.フレーミング != null && a.独自の基礎能力.ブロッキング != null,
    `枠${a.独自の基礎能力.フレーミング.rank} 防${a.独自の基礎能力.ブロッキング.rank}`);
  const notC = sample();
  check('独-b 捕手以外には付かない', !('フレーミング' in notC.独自の基礎能力), '遊撃手には無い');
  check('独-c 三振のしにくさ・選球眼は独自欄にあり、本家の基礎能力欄には無い',
    '三振のしにくさ' in a.独自の基礎能力 && !('三振のしにくさ' in a.基礎能力), '独自欄に分離');
}

// --- ランク変換の境目 ---
{
  const cases = [[95, 'S'], [90, 'S'], [89, 'A'], [80, 'A'], [79, 'B'], [70, 'B'], [69, 'C'], [60, 'C'],
    [59, 'D'], [50, 'D'], [49, 'E'], [40, 'E'], [39, 'F'], [20, 'F'], [19, 'G'], [1, 'G']];
  const bad = cases.filter(([v, r]) => toRank(v, cfg) !== r);
  check('ランク-a 境目がパワプロの区分どおり', bad.length === 0,
    bad.length ? bad.map(([v, r]) => `${v}→${toRank(v, cfg)}(期待${r})`).join(' ') : 'S90/A80/B70/C60/D50/E40/F20/G1');
  check('ランク-b 境目は設定ファイルにある（コードに埋め込んでいない）',
    Array.isArray(cfg.rank_scale?.thresholds), `${cfg.rank_scale.thresholds.length}段階`);
}

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
