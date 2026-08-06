// Sol仕様 09_QA_TESTS の回帰テストのうち、守備に関わるものを実装する。
//   Q4  エラーが守備力を下げない（Range入力が同じでEだけ変えたら、守備力不変・捕球のみ変化）
//   Q5  外野の逆補正（同じ現実Rangeで 走力高→推定守備力低 / 走力低→高）の単調性
//   Q6  内野では補正が外野より小さい
//   Q10 ゴールデングラブ列があっても結果が変わらない（仕様§9 REJECTED）
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fieldingRating, catchingRating, armRating,
  catcherAbilities, inferredInfieldArm, appraiseAllPositions,
} from '../src/ratings/fielding.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const norm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// --- Q4: 失策を変えても守備力は不変、捕球だけ動く ---
{
  const base = { pos: 'SS', inn: 900, rngr: 5.0, errr: 0.0, arm: null };
  const worseErr = { ...base, errr: -4.0 };
  const f1 = fieldingRating(base, 0, norm, cfg), f2 = fieldingRating(worseErr, 0, norm, cfg);
  const c1 = catchingRating(base, norm, cfg), c2 = catchingRating(worseErr, norm, cfg);
  check('Q4-a 失策悪化で守備力が変わらない', f1.rating === f2.rating, `${f1.rating.toFixed(2)} → ${f2.rating.toFixed(2)}`);
  check('Q4-b 失策悪化で捕球が下がる', c2.rating < c1.rating, `${c1.rating.toFixed(1)} → ${c2.rating.toFixed(1)}`);
}

// --- Q5: 外野は同じRangeなら走力が高いほど守備力が低く出る（単調減少） ---
{
  const speeds = [-2, -1, 0, 1, 2];
  for (const pos of ['LF', 'RF', 'CF']) {
    const fld = { pos, inn: 900, rngr: 4.0, errr: 0, arm: null };
    const vals = speeds.map(s => fieldingRating(fld, s, norm, cfg).rating);
    const monotone = vals.every((v, i) => i === 0 || v <= vals[i - 1] + 1e-9);
    const range = vals[0] - vals[vals.length - 1];
    check(`Q5 ${pos}: 走力が上がるほど守備力が下がる`, monotone,
      `走力z=-2→+2 で ${vals[0].toFixed(1)} → ${vals[vals.length - 1].toFixed(1)}（幅${range.toFixed(1)}）`);
  }
}

// --- Q6: 内野の補正幅は外野より小さい ---
{
  const width = pos => {
    const fld = { pos, inn: 900, rngr: 4.0, errr: 0, arm: null };
    return fieldingRating(fld, -2, norm, cfg).rating - fieldingRating(fld, 2, norm, cfg).rating;
  };
  const inf = ['1B', '2B', '3B', 'SS'].map(width);
  const out = ['LF', 'RF'].map(width); // CFは走力のばらつきが小さく識別力が落ちるため除外（configsに注記済み）
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  check('Q6 内野の走力補正は外野(LF/RF)より小さい', avg(inf) < avg(out),
    `内野平均${avg(inf).toFixed(2)} < 外野平均${avg(out).toFixed(2)}`);
  console.log(`      内訳: ${['1B', '2B', '3B', 'SS'].map((p, i) => p + '=' + inf[i].toFixed(1)).join(' ')} | ${['LF', 'RF'].map((p, i) => p + '=' + out[i].toFixed(1)).join(' ')} | CF=${width('CF').toFixed(1)}（識別力低）`);
}

// --- Q10: ゴールデングラブ列があっても結果が変わらない（仕様§9 REJECTED） ---
{
  const base = { pos: 'CF', inn: 1000, rngr: 6.0, errr: 1.0, arm: 2.0 };
  const withGG = { ...base, goldenGlove: true, ggCount: 5, allStar: true };
  const same = ['fielding', 'catching', 'arm'].every(k => {
    const fn = { fielding: fieldingRating, catching: catchingRating, arm: armRating }[k];
    const a = k === 'fielding' ? fn(base, 0.5, norm, cfg) : fn(base, norm, cfg);
    const b = k === 'fielding' ? fn(withGG, 0.5, norm, cfg) : fn(withGG, norm, cfg);
    return (a?.rating ?? null) === (b?.rating ?? null);
  });
  check('Q10 GG受賞歴を入力に足しても結果が変わらない', same, '仕様§9 REJECTED を構造的に保証');
}

// --- 追加: 出場量は能力に自動加点しない（仕様§8）が、信頼度としては効く ---
{
  const short = { pos: '2B', inn: 200, rngr: 2.0, errr: 0, arm: null };
  const long = { pos: '2B', inn: 1200, rngr: 12.0, errr: 0, arm: null }; // 同じ per1000
  const a = fieldingRating(short, 0, norm, cfg), b = fieldingRating(long, 0, norm, cfg);
  check('§8 同じ守備効率なら、出場量が多い方が中立から離れる（信頼度として作用）',
    Math.abs(b.rating - 50) > Math.abs(a.rating - 50),
    `200イニング=${a.rating.toFixed(1)} / 1200イニング=${b.rating.toFixed(1)}（信頼度 ${a.reliability.toFixed(2)}→${b.reliability.toFixed(2)}）`);
}

// --- §4.3 内野手の肩（守備位置からの推定・下限保証）2026-08-01 オーナー裁定 ---
{
  const rows = p => p.map(([pos, inn]) => ({ pos, inn, rngr: 1.0, errr: 0, arm: null }));

  const ss = inferredInfieldArm(rows([['SS', 900]]), norm, cfg);
  const fb = inferredInfieldArm(rows([['1B', 900]]), norm, cfg);
  check('§4.3-d 遊撃を守る選手の推定肩力は一塁専任より高い', ss.rating > fb.rating,
    `SS=${ss.rating.toFixed(1)} > 1B=${fb.rating.toFixed(1)}`);

  // 下限の証拠: 一塁を主に守っていても遊撃を規定以上守っていれば遊撃水準を下回らない
  const util = inferredInfieldArm(rows([['1B', 800], ['SS', 150]]), norm, cfg);
  check('§4.3-e 主に一塁でも遊撃を規定イニング守れば肩の下限が遊撃水準になる',
    util.z === ss.z, `${util.basis} → z=${util.z.toFixed(3)}（SSと同じ）`);

  // 規定イニング未満の位置は下限の証拠にしない
  const brief = inferredInfieldArm(rows([['1B', 800], ['SS', 20]]), norm, cfg);
  check('§4.3-f わずかな遊撃起用は下限の証拠にならない', brief.z === fb.z,
    `SS20イニングでは z=${brief.z.toFixed(3)}（1Bのまま）`);

  // 実測ARMがある選手には推定を当てない（実測が優先）
  const measured = appraiseAllPositions(
    [{ pos: 'RF', inn: 900, rngr: 3, errr: 0, arm: 4.0 }, { pos: '1B', inn: 300, rngr: 1, errr: 0, arm: null }],
    0, norm, cfg);
  check('§4.3-g 外野で肩を実測できる選手には推定値を使わない',
    measured.every(r => !r.arm?.is_estimated),
    `RF=実測${measured[0].arm.rating.toFixed(1)} / 1B=${measured[1].arm ? '実測' + measured[1].arm.rating.toFixed(1) : 'null'}`);

  // 推定値には必ず推定フラグが立つ（仕様03 §1.3 欠損・推定の区別）
  const inferred = appraiseAllPositions(rows([['SS', 900], ['2B', 200]]), 0, norm, cfg);
  check('§4.3-h 推定した肩力には is_estimated が立つ',
    inferred.every(r => r.arm?.is_estimated === true), inferred[0].arm.basis);

  // 失策を悪化させても推定肩力は動かない（§4.3 総失策を肩へ入れない）
  const dirty = rows([['SS', 900]]).map(r => ({ ...r, errr: -8.0 }));
  check('§4.3-i 失策を悪化させても推定肩力が動かない',
    inferredInfieldArm(dirty, norm, cfg).rating === ss.rating, `${ss.rating.toFixed(2)} で不変`);
}

// --- §12 サブポジ適性は別管理で、能力値へ加点しない ---
{
  const rows = [
    { pos: 'SS', inn: 900, rngr: 5, errr: 0, arm: null },
    { pos: '2B', inn: 200, rngr: 1, errr: 0, arm: null },
    { pos: '3B', inn: 60, rngr: 0.4, errr: 0, arm: null },
    { pos: 'LF', inn: 10, rngr: 0.1, errr: 0, arm: 0.1 },
  ];
  const r = appraiseAllPositions(rows, 0, norm, cfg);
  const g = Object.fromEntries(r.map(x => [x.pos, x.aptitude.grade]));
  check('§12-a 適性は主位置A・常時併用B・時々C・わずかD に分かれる',
    g.SS === 'A' && g['2B'] === 'B' && g['3B'] === 'C' && g.LF === 'D',
    `SS=${g.SS} 2B=${g['2B']} 3B=${g['3B']} LF=${g.LF}`);

  // 適性は守備力そのものとは別物（同じ守備効率でも適性が違いうる）
  const same = [
    { pos: '2B', inn: 900, rngr: 5, errr: 0, arm: null },
    { pos: 'SS', inn: 200, rngr: 1.111, errr: 0, arm: null },
  ];
  const r2 = appraiseAllPositions(same, 0, norm, cfg);
  check('§12-b 適性の等級は守備力の高低で決まらない（起用イニングで決まる）',
    r2[0].aptitude.grade === 'A' && r2[1].aptitude.grade === 'B',
    `守備力 2B=${r2[0].fielding.rating.toFixed(1)} / SS=${r2[1].fielding.rating.toFixed(1)} でも適性は 2B=A・SS=B`);

  // §8 適性が上がっても能力値は動かない
  const short = appraiseAllPositions([{ pos: 'SS', inn: 60, rngr: 0.333, errr: 0, arm: null }], 0, norm, cfg);
  check('§12-c 適性等級は能力値へ加点されない',
    short[0].aptitude.grade === 'A' && short[0].fielding.rating < r[0].fielding.rating,
    `60イニング(適性A)=${short[0].fielding.rating.toFixed(1)} < 900イニング=${r[0].fielding.rating.toFixed(1)}`);
}

// --- 02 §12 捕手の専用回帰テスト（チェックリストで「未作成」だった項目） ---
{
  const c = { pos: 'C', inn: 900, rngr: null, errr: 0, arm: 3.0, framing: 8.0, blocking: 1.0 };
  const a = catcherAbilities(c, norm, cfg);
  check('§12捕-a 捕手にフレーミング・ブロッキングが査定される',
    a?.framing != null && a?.blocking != null,
    `枠=${a?.framing?.toFixed(1)} 防=${a?.blocking?.toFixed(1)}`);

  const good = catcherAbilities({ ...c, framing: 15.0 }, norm, cfg);
  const bad = catcherAbilities({ ...c, framing: -15.0 }, norm, cfg);
  check('§12捕-b フレーミングが良いほど枠の評価が高い', good.framing > bad.framing,
    `${bad.framing.toFixed(1)} → ${good.framing.toFixed(1)}`);
  check('§12捕-c フレーミングを変えてもブロッキングは動かない',
    good.blocking === bad.blocking, `両方とも${good.blocking.toFixed(1)}`);

  const sameFraming = catcherAbilities({ ...c, blocking: 6.0 }, norm, cfg);
  check('§12捕-d ブロッキングを変えてもフレーミングは動かない',
    sameFraming.framing === a.framing, `両方とも${a.framing.toFixed(1)}`);

  // §10「過去の0.55/0.30/0.15はREJECTED」＝未校正の合成値を返さない
  check('§12捕-e 未校正の合成（肩0.55+送球0.30+守備0.15）を返さない',
    !('composite' in a) && !('caught_stealing_rating' in a) && /PROVISIONAL/.test(a._note ?? ''),
    '合成せず成分のまま返す');

  check('§12捕-f 捕手以外にフレーミング・ブロッキングを付けない',
    catcherAbilities({ ...c, pos: 'SS' }, norm, cfg) === null, 'SS→null');

  // 失策を悪化させても盗塁阻止側の成分は動かない（§10.1 捕球は盗塁阻止と別）
  const errWorse = catcherAbilities({ ...c, errr: -6.0 }, norm, cfg);
  check('§12捕-g 失策を悪化させても枠・防は動かない',
    errWorse.framing === a.framing && errWorse.blocking === a.blocking,
    '捕球（失策）と盗塁阻止系を分離');

  // 出場量は信頼度としてのみ効く（§8）
  const shortC = catcherAbilities({ ...c, inn: 150 }, norm, cfg);
  check('§12捕-h 出場量が少ないと中立へ寄る（信頼度として作用）',
    Math.abs(shortC.framing - 50) < Math.abs(a.framing - 50),
    `150イニング=${shortC.framing.toFixed(1)} / 900イニング=${a.framing.toFixed(1)}`);
}

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
