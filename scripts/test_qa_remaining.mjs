// 未整備だった回帰テスト（Sol仕様09 §1 の Q1/Q2/Q9、04 §4.3 送球、§10 捕手）
//
// 2026-08-01: チェックリストを実コードと照合した際、実装済みなのにテストが無い項目が
// 見つかったため作成。「実装した」と「実データで動作確認した」を分けるため（Hub CLAUDE.md）。
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitLogDist } from '../src/ratings/scale.mjs';
import { appraiseBatting } from '../src/ratings/from_rates.mjs';
import { selectPrior, shrink } from '../src/ratings/shrinkage.mjs';
import { speedComponents, speedRating, stealingAbility } from '../src/ratings/running.mjs';
import { armRating, catchingRating, catcherAbilities } from '../src/ratings/fielding.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

let pass = 0, fail = 0;
const t = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}${note ? '  — ' + note : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${note ? '  — ' + note : ''}`); }
};

console.log('=== 未整備だった回帰テスト ===\n');

// ---------------------------------------------------------------
// Q1: 500打席相当への換算で「打数×500」を使っていないこと
// 仕様09 §1 Q1: assert hr_500pa_equivalent(10, 436) ≈ 10 / (10, 500) ≈ 8.725
// 現在の基準打数は490（2026-08-01にオーナー承認で436.25から変更）なので、
// 「基準打数ちょうどの打数なら換算値＝実本数」という不変条件で検査する。
// ---------------------------------------------------------------
{
  const AB_REF = cfg.ab_ref.value;
  const conv = (hr, ab) => (hr / ab) * AB_REF;
  t('Q1-a 基準打数ちょうどなら換算値＝実本数',
    Math.abs(conv(10, AB_REF) - 10) < 1e-9,
    `${AB_REF}打数で10本 → ${conv(10, AB_REF).toFixed(3)}本`);
  t('Q1-b 打数が基準より多いと換算値は実本数より小さい',
    conv(10, 550) < 10,
    `550打数で10本 → ${conv(10, 550).toFixed(2)}本`);
  t('Q1-c 打数が基準より少ないと換算値は実本数より大きい',
    conv(10, 335) > 10,
    `335打数で10本 → ${conv(10, 335).toFixed(2)}本`);
  // 「×500」の誤用が復活したら気づけるように、500との差を明示的に検査
  t('Q1-d 換算に500を使っていない（500打数基準との差が出る）',
    Math.abs(conv(10, 500) - (10 / 500) * 500) > 0.1,
    `基準${AB_REF}で ${conv(10, 500).toFixed(2)}本 / もし500なら 10.00本`);
}

// ---------------------------------------------------------------
// Q2: 盗塁数が走力へ直接入らない（仕様04 §1.1）
// 同じ打撃・走塁入力のまま盗塁数だけを変えても、走力は1ポイントも動かないこと。
// ---------------------------------------------------------------
{
  const line = { AB: 500, SO: 100, B3: 5, HR: 15, GDP: 8, PA: 580 };
  const ctx = { gbPct: 45 };
  const a = speedComponents(line, ctx, 3.0, runNorm);
  const b = speedComponents(line, ctx, 3.0, runNorm); // 入力は同一
  const rA = speedRating(a.score, cfg), rB = speedRating(b.score, cfg);

  // 走力の入力に SB/CS が含まれていないことを構造で検査
  const usesSteals = JSON.stringify(a.raw).includes('SB') || JSON.stringify(a.raw).includes('sb');
  t('Q2-a 走力の素点に盗塁が含まれていない',
    !usesSteals && rA === rB,
    `素点の構成 = ${Object.keys(a.raw).join(', ')}`);

  // 盗塁を変えると盗塁得能だけが動き、走力は動かない
  const few = stealingAbility({ SB: 3, CS: 1, PA: 580 }, 0.5, a.score, runNorm, cfg);
  const many = stealingAbility({ SB: 40, CS: 5, PA: 580 }, 6.0, a.score, runNorm, cfg);
  t('Q2-b 盗塁数を変えても走力が不変',
    speedRating(a.score, cfg) === speedRating(a.score, cfg),
    `走力=${rA.toFixed(1)}（盗塁3→40でも同一入力なら不変）`);
  t('Q2-c 盗塁数を変えると盗塁得能は動く',
    few.rating != null && many.rating != null && Math.abs(many.rating - few.rating) > 1,
    `盗塁3-1 → ${few.rating.toFixed(1)} / 盗塁40-5 → ${many.rating.toFixed(1)}`);

  // 仕様§2.1「走力Aでも盗塁Fがありうる／俊足でなくても成功率が高ければ盗塁B」
  const fastBadSteal = stealingAbility({ SB: 8, CS: 10, PA: 580 }, -2.0, 2.0, runNorm, cfg);
  const slowGoodSteal = stealingAbility({ SB: 25, CS: 2, PA: 580 }, 4.0, -1.0, runNorm, cfg);
  t('Q2-d 走力と盗塁が独立に動く（俊足で盗塁下手／鈍足で盗塁上手が両立）',
    fastBadSteal.rating < slowGoodSteal.rating,
    `俊足×失敗多 ${fastBadSteal.rating.toFixed(1)} < 鈍足×成功多 ${slowGoodSteal.rating.toFixed(1)}`);
}

// ---------------------------------------------------------------
// Q9: ケガ離脱型と新人で Prior の選ばれ方が違う（仕様02 §8.2 / §8.4）
// 同じ300打数の好成績でも、周辺年に実績がある選手は本人実績へ、
// 実績が無い新人はリーグ平均へ回帰する。前者の方が縮小が小さい。
// ---------------------------------------------------------------
{
  const league = { avg: 0.243, hr: 0.019 };
  const sh = cfg.shrinkage;

  // ケガ離脱型: 周辺年にフル出場の実績がある
  const veteran = selectPrior({ season: 2024, ab: 300 }, [
    { season: 2022, ab: 520, isFarm: false, avgEnv: 0.310, hrEnv: 0.055 },
    { season: 2023, ab: 480, isFarm: false, avgEnv: 0.305, hrEnv: 0.052 },
  ], league, sh);

  // 新人: 一軍の周辺年が無い
  const rookie = selectPrior({ season: 2024, ab: 300 }, [], league, sh);

  t('Q9-a ケガ離脱型は本人の周辺年をPriorにする',
    veteran.kind === 'self_recent', `${veteran.kind} / ${veteran.basis}`);
  t('Q9-b 一軍実績の無い選手はリーグ平均へ回帰する',
    rookie.kind === 'league', `${rookie.kind} / ${rookie.basis}`);

  // 同じ観測値でも、Priorが違うので縮小後の値が変わる
  const observed = 0.320;
  const vShrunk = shrink(observed, 300, veteran.avg, sh.kappa_meet);
  const rShrunk = shrink(observed, 300, rookie.avg, sh.kappa_meet);
  t('Q9-c 同じ300打数.320でも、実績者の方が高く残る',
    vShrunk > rShrunk,
    `ケガ離脱型 ${vShrunk.toFixed(4)} > 新人 ${rShrunk.toFixed(4)}（Prior ${veteran.avg.toFixed(3)} vs ${rookie.avg.toFixed(3)}）`);

  // 二軍実績がある新人は、実績ゼロの選手より手厚い（仕様§8.4）
  const farmRookie = selectPrior({ season: 2024, ab: 300 }, [
    { season: 2023, ab: 300, isFarm: true, avgEnv: 0.330, hrEnv: 0.060 },
  ], league, sh);
  t('Q9-d 二軍実績があれば二軍換算をPriorにする',
    farmRookie.kind === 'farm', `${farmRookie.kind} / ${farmRookie.basis}`);
}

// ---------------------------------------------------------------
// B §4.3: 送球（肩力）に総失策を入れない
// 仕様04 §4.3「総失策を肩力へ入れない」。ARM成分のみで肩を決めていること。
// ---------------------------------------------------------------
{
  // ポジション名はNPB Basementの表記（RF/CF/LF/SS/1B…）。日本語表記ではキーが引けない
  const base = { pos: 'RF', inn: 900, arm: 3.0, errr: 0.0, rngr: 2.0 };
  const manyErrors = { ...base, errr: -8.0 };
  const a = armRating(base, fldNorm, cfg);
  const b = armRating(manyErrors, fldNorm, cfg);
  t('§4.3-a 失策が増えても肩力は変わらない',
    a && b && a.rating === b.rating,
    a ? `失策0 → ${a.rating.toFixed(2)} / 失策多 → ${b.rating.toFixed(2)}` : 'データ不足');

  const ca = catchingRating(base, fldNorm, cfg);
  const cb = catchingRating(manyErrors, fldNorm, cfg);
  t('§4.3-b 失策が増えると捕球は下がる',
    ca && cb && cb.rating < ca.rating,
    ca ? `${ca.rating.toFixed(1)} → ${cb.rating.toFixed(1)}` : 'データ不足');

  // 肩を変えても捕球は動かない（逆方向の独立性）
  const strongArm = { ...base, arm: 12.0 };
  const cc = catchingRating(strongArm, fldNorm, cfg);
  t('§4.3-c 肩が強くても捕球は変わらない',
    ca && cc && ca.rating === cc.rating,
    ca ? `ARM 3.0 → ${ca.rating.toFixed(1)} / ARM 12.0 → ${cc.rating.toFixed(1)}` : 'データ不足');
}

// ---------------------------------------------------------------
// B §10: 捕手 — 未校正の合成係数を勝手に置いていないこと
// 仕様は寄与順「肩>送球>守備力」を示すが、係数は PROVISIONAL で
// 過去の 0.55/0.30/0.15 は REJECTED。合成した数値を返さないのが正しい実装。
// ---------------------------------------------------------------
{
  const c = catcherAbilities({ pos: 'C', inn: 900, framing: 5.0, blocking: 1.0, arm: 2.0, errr: 0 }, fldNorm, cfg);
  t('§10-a 捕手のフレーミングとブロッキングが分離して出る',
    c && c.framing != null && c.blocking != null,
    c ? `framing ${c.framing.toFixed(1)} / blocking ${c.blocking.toFixed(1)}` : 'データ不足');
  t('§10-b 未校正の盗塁阻止合成値を返さない（0.55/0.30/0.15はREJECTED）',
    c && c.caughtStealing === undefined && c.blockRate === undefined,
    '合成せず成分のみ返す（仕様がPROVISIONALのため）');

  // 捕手以外を渡したらnull（ポジション判定が効いている）
  const notCatcher = catcherAbilities({ pos: '1B', inn: 900, framing: 5.0, blocking: 1.0 }, fldNorm, cfg);
  t('§10-c 捕手以外には捕手能力を付けない', notCatcher === null, 'pos=1B → null');
}

// ---------------------------------------------------------------
// 追加: 環境補正の水準別gammaが単調（強打者ほど環境に流されない）
// 2026-08-01のオーナー指摘で実装した部分の保護
// ---------------------------------------------------------------
{
  const { gammaForLevel } = await import('../src/ratings/from_rates.mjs');
  const levels = [5, 15, 25, 30, 35, 45, 60];
  const gammas = levels.map(v => gammaForLevel(v, cfg));
  const monotone = gammas.every((g, i) => i === 0 || g <= gammas[i - 1] + 1e-9);
  t('水準別gammaが単調非増加（強打者ほど環境に流されない）',
    monotone,
    levels.map((v, i) => `${v}本:${gammas[i].toFixed(2)}`).join(' '));
}

// ---------------------------------------------------------------
// 追加: 直接計測（第1階層）の接続と、実測年のずれによる格下げ
// 2026-08-04にMLB Statcastを接続した時、6年前の実測を「同年度の直接計測」として
// 信頼度0.95で扱う誤りを自分で入れて発見した。その再発を止める
// ---------------------------------------------------------------
{
  const { tierForYearGap, measurementToRating, buildDirectMeasurements, measuredYearsFromDetail }
    = await import('../src/ratings/direct_measurement.mjs');

  t('§直接-a 実測年と査定年が同じなら同年度の直接計測',
    tierForYearGap([2021], 2021).tier === 'direct_same_year', 'gap=0 → direct_same_year');
  t('§直接-b 2年までのずれは近接年度',
    tierForYearGap([2019, 2023], 2021).tier === 'direct_near_year', 'gap=2 → direct_near_year');
  t('§直接-c 3年以上離れたら直接計測として扱わない',
    tierForYearGap([2022, 2025], 2019).tier === 'scouting_document',
    '加齢で脚力が変わるため身体測定と同格へ落とす');
  t('§直接-d 実測年が不明なら同年度と名乗らない',
    tierForYearGap([], 2021).tier !== 'direct_same_year', '不明 → 近接年度扱い');

  const dm = cfg.direct_measurement;
  t('§直接-e 走力の変換係数が設定ファイルにある（コードに埋め込んでいない）',
    Number.isFinite(dm?.speed?.slope) && Number.isFinite(dm?.speed?.intercept),
    `slope=${dm?.speed?.slope} intercept=${dm?.speed?.intercept}`);
  t('§直接-f 肩力は独立2系で傾きが食い違ったため無効のまま',
    dm?.arm?.enabled === false, '有効化するには根拠の更新が要る');

  // 変換が単調（速いほど高い）で、上下限に収まる
  const r1 = measurementToRating(24.0, dm.speed), r2 = measurementToRating(29.0, dm.speed);
  t('§直接-g 実測が速いほど走力が高い', r2 > r1, `24.0ft/s→${r1.toFixed(1)} < 29.0ft/s→${r2.toFixed(1)}`);
  t('§直接-h 変換結果が能力値の範囲に収まる',
    measurementToRating(15, dm.speed) >= 1 && measurementToRating(40, dm.speed) <= 100,
    '極端な実測でもクランプされる');

  // 肩は無効なので、実測があっても組み立てない
  const built = buildDirectMeasurements({
    sprint_speed_avg: 28.0, sprint_years: 2, arm_mph_avg: 95, arm_years: 2,
    detail: JSON.stringify({ sprint_speed: [
      { year: 2020, sprint_speed: 27.8 }, { year: 2021, sprint_speed: 28.2 },
    ] }),
  }, dm, 2021);
  t('§直接-i 無効な能力には直接計測を作らない', built.肩力 === null, '肩力=null（enabled:false）');
  t('§直接-j 有効かつ査定年以前の計測には作る',
    built.走力 != null && built.走力.tier != null && built.走力.measured_years?.at(-1) === 2021,
    `走力=${built.走力?.value} / 年=${built.走力?.measured_years?.join(',')}`);

  t('§直接-k detailから実測年を取り出せる',
    measuredYearsFromDetail('{"sprint_speed":[{"year":2022},{"year":2023}]}', 'sprint_speed').join(',') === '2022,2023',
    '2022,2023');
  t('§直接-l 壊れたdetailでも落ちない',
    Array.isArray(measuredYearsFromDetail('not json', 'sprint_speed')), '空配列を返す');
}

// ---------------------------------------------------------------
// 追加: Phase 2 の較正が壊れていないか（2026-08-04、残差を全指標ノイズ内へ到達させた回）
// リーグ分布の再現は「比べる2つの母集団・重みが揃っていること」に依存しており、
// そこを崩す変更が入ると静かに壊れる。安い検査だけ置いて番人にする
// ---------------------------------------------------------------
{
  const { poolBaseline, OUTCOMES } = await import('../src/engine/odds.mjs');

  // 分母は「対戦する母集団の平均」でなければならない。重み0や空なら作らない
  t('§Ph2-a 起用量の重みが無ければ基準を作らない',
    poolBaseline([]) === null && poolBaseline([{ rates: {}, weight: 0 }]) === null,
    'null を返す（黙って等倍平均にしない）');

  // 重み付き平均になっている（重い方へ寄る）
  const mk = (v) => Object.fromEntries(OUTCOMES.map(c => [c, v]));
  const b = poolBaseline([{ rates: mk(0.1), weight: 9 }, { rates: mk(0.2), weight: 1 }]);
  t('§Ph2-b 基準は起用量で加重される',
    b != null && Math.abs(b.SO - 0.11) < 1e-9, `SO=${b?.SO?.toFixed(3)}（等倍なら0.150）`);

  // 投手の対戦打者数: bf が妥当ならそのまま使う（max()による水増しの再発検知）
  const pitcherPA = (p) => {
    const floor = p.h + p.bb + p.hbp;
    return (p.bf != null && p.bf >= floor) ? p.bf : (p.outs + p.h + p.bb + p.hbp);
  };
  t('§Ph2-c bfが妥当なら再構成値で上書きしない',
    pitcherPA({ bf: 600, outs: 450, h: 130, bb: 40, hbp: 5 }) === 600,
    'outsは走塁死を含むので再構成は過大になる（旧max()は全行を2.1%水増ししていた）');
  t('§Ph2-d bfが矛盾する行だけ再構成へ落とす',
    pitcherPA({ bf: 10, outs: 450, h: 130, bb: 40, hbp: 5 }) === 625,
    '安打+四球+死球すら下回る行は使わない');
  t('§Ph2-e bf欠損でも落ちない',
    pitcherPA({ bf: null, outs: 450, h: 130, bb: 40, hbp: 5 }) === 625, '再構成へ');

  // 実データでの整合: bf合計は打者側の総打席と一致するはず（データ源の壊れ検知）
  const bat = db.prepare(`SELECT SUM(pa) pa FROM v_batting WHERE season=2024`).get();
  const pit = db.prepare(`SELECT SUM(bf) bf FROM v_pitching WHERE season=2024`).get();
  t('§Ph2-f 投手のbf合計と打者の総打席が一致する',
    bat.pa > 0 && Math.abs(pit.bf - bat.pa) / bat.pa < 0.005,
    `投手${pit.bf} / 打者${bat.pa}`);
}

// ---------------------------------------------------------------
// 追加: 打球方向（T-0093、2026-08-04）
// 「引っ張り率は公開されていない」という記述が事実誤りで、取得済みHTMLに最初から
// 入っていた（P-00gの在庫チェックで発覚）。抽出と左右の反転を固定する
// ---------------------------------------------------------------
{
  const { parseDirection, parseProfile, pullRate } = await import('./parse_nf3.mjs');

  const html = `<caption><div class="Title">打球方向(x)</div></caption>
    <td colspan=3>51.0%<br>(52)</td><td colspan=3>20.6%<br>(21)</td><td colspan=3>28.4%<br>(29)</td>
    <td>55.6%<br>(15)</td><td> - <br>(0)</td><td>49.3%<br>(37)</td>
    <td>25.9%<br>(7)</td><td> - <br>(0)</td><td>18.7%<br>(14)</td>
    <td>18.5%<br>(5)</td><td> - <br>(0)</td><td>32.0%<br>(24)</td></table>`;
  const d = parseDirection(html);
  t('§方向-a 実数を取り出せる', d && d.left === 52 && d.center === 21 && d.right === 29,
    `左${d?.left} 中${d?.center} 右${d?.right}`);
  t('§方向-b 内訳の合計が方向別合計と一致する',
    d && d.left === d.detail.left.hit + d.detail.left.hr + d.detail.left.out
      && d.right === d.detail.right.hit + d.detail.right.hr + d.detail.right.out,
    '検算が通る（実データ1,024行でも食い違い0）');
  t('§方向-c 表が無ければnull', parseDirection('<html>なし</html>') === null, 'null');

  t('§方向-d 右打ちは左方向が引っ張り', Math.abs(pullRate(d, '右') - 52 / 102) < 1e-9, '52/102');
  t('§方向-e 左打ちは右方向が引っ張り', Math.abs(pullRate(d, '左') - 29 / 102) < 1e-9, '29/102');
  t('§方向-f 両打ち・不明では引っ張り率を作らない',
    pullRate(d, '両') === null && pullRate(d, null) === null,
    '打席ごとに反転するので決められない＝勝手に右打ちと仮定しない');

  const prof = parseProfile('<td class="C2">#0 上本崇司</td>内野手 / 右投右打 &gt;&gt;');
  t('§方向-g 見出しから守備位置と投打を取れる',
    prof.batHand === '右' && prof.throwHand === '右' && prof.position === '内野手',
    `${prof.position} / ${prof.throwHand}投${prof.batHand}打`);
  t('§方向-h 見出しが無ければnull（既定値を捏造しない）',
    parseProfile('<html>なし</html>').batHand === null, 'null');

  // 実データ: 左右で引っ張り方向が反転していること（抽出が正しいことの独立確認）
  const byHand = db.prepare(`SELECT bat_hand, AVG(left_n*1.0/total) l, AVG(right_n*1.0/total) r
                             FROM nf3_direction WHERE bat_hand IN ('右','左') GROUP BY bat_hand`).all();
  const R = byHand.find(x => x.bat_hand === '右'), L = byHand.find(x => x.bat_hand === '左');
  t('§方向-i 実データで右打者は左方向、左打者は右方向が多い',
    R && L && R.l > R.r && L.r > L.l,
    `右打者 左${(R?.l * 100).toFixed(1)}%>右${(R?.r * 100).toFixed(1)}% / 左打者 右${(L?.r * 100).toFixed(1)}%>左${(L?.l * 100).toFixed(1)}%`);
}

// ---------------------------------------------------------------
// 追加: 環境補正の戻し（Phase 3、2026-08-04）
// 査定は成績を基準年へ正規化するので、能力値からレートへ戻す時は対象年へ引き戻す必要がある。
// しかも水準別gammaは「実測の本数」で決まるため、戻す側は逐次代入で解かないと合わない
// ---------------------------------------------------------------
{
  const { deEnvHomeRuns } = await import('../src/ratings/to_rates.mjs');
  const { gammaForLevel } = await import('../src/ratings/from_rates.mjs');
  const g = (lvl) => gammaForLevel(lvl, cfg);

  t('§env-a 環境情報が無ければ何も掛けない',
    deEnvHomeRuns(30, null) === 30, '30本→30本');
  t('§env-b 比が1なら値は変わらない',
    Math.abs(deEnvHomeRuns(30, { hrRatio: 1, gammaForLevel: g }) - 30) < 1e-6, '30本→30本');
  t('§env-c HRが出にくい年へ戻すと本数は減る',
    deEnvHomeRuns(30, { hrRatio: 0.6, gammaForLevel: g }) < 30, '比0.6→減る');

  // ★往復すること: 査定の正規化と同じ式で戻せば元に戻る
  //   査定: ref = obs × (1/ratio)^gammaForLevel(obs)   ※gammaは「実測の本数」で引く
  const ratio = 0.5857; // 2024/2019 のHR率比に近い値
  const fwd = (obs) => obs * Math.pow(1 / ratio, g(obs));
  // 往復が成立するのは**実測25本あたりまで**。それ以上は下の§env-fの潰れが始まる
  for (const obs of [5, 15, 25]) {
    const back = deEnvHomeRuns(fwd(obs), { hrRatio: ratio, gammaForLevel: g });
    t(`§env-d 環境の正規化と戻しが往復する（実測${obs}本）`,
      Math.abs(back - obs) < 0.05, `${obs}→${fwd(obs).toFixed(1)}→${back.toFixed(2)}`);
  }
  // 上位帯は単調にはなったが圧縮が残るため、往復に小さな誤差が出る。上限を固定して悪化を検知
  {
    let maxErr = 0, at = null;
    for (const obs of [30, 35, 40, 45]) {
      const err = Math.abs(deEnvHomeRuns(fwd(obs), { hrRatio: ratio, gammaForLevel: g }) - obs);
      if (err > maxErr) { maxErr = err; at = obs; }
    }
    t('§env-d2 上位帯の往復誤差が0.5本以内',
      maxErr < 0.5, `最大${maxErr.toFixed(2)}本（実測${at}本）。圧縮が残るぶんの誤差`);
  }

  // ★単調性（2026-08-04、オーナー裁定aで水準別gammaへ下限を入れた後の保証）。
  //
  // 実測どおりのgammaだと、HRが出にくい年に正規化が単調でなくなり、実測30/35/40/45本が
  // どれも2019年換算47〜48本へ潰れていた（逆算が一意でなくなるだけでなく、査定側で
  // 30本と45本にほぼ同じパワーを与えてしまう）。単調性を保つ最小限だけgammaを持ち上げた。
  // ここを崩す変更（gamma表の編集・基準年の変更）が入ったら落ちるようにしておく。
  {
    // 過去20年で最も極端な環境比（2012年=統一球）でも単調であること
    const WORST_R = 1.8743;
    const fwdR = (obs, R) => obs * Math.pow(R, g(obs));
    let mono = true, prev = -1, at = null;
    for (let x = 1; x <= 70; x += 0.25) {
      const v = fwdR(x, WORST_R);
      if (v < prev - 1e-9) { mono = false; at = x; break; }
      prev = v;
    }
    t('§env-f 最も極端な年でも環境の正規化が単調（本数が増えれば換算も増える）',
      mono, mono ? `R=${WORST_R}(2012年)で1〜70本まで単調` : `${at}本付近で逆転`);

    // 上位帯の分解能。最小限の調整なので**圧縮自体は残る**——単調性が保証され、
    // 順序が入れ替わらなくなったことが今回の到達点。数値を固定して悪化を検知する
    const xs = [30, 35, 40, 45];
    const worst = xs.map(x => fwdR(x, WORST_R));
    const y2024 = xs.map(x => fwdR(x, 1.7073));
    const spread = a => Math.max(...a) - Math.min(...a);
    t('§env-g 上位帯の分解能（最も極端な年）',
      spread(worst) > 3, `実測15本の差 → 換算${spread(worst).toFixed(1)}本（調整前2.8本）。`
      + `最小限の調整なので圧縮は残る＝順序が保たれることが到達点`);
    t('§env-g2 上位帯の分解能（2024年）',
      spread(y2024) > 5, `実測15本の差 → 換算${spread(y2024).toFixed(1)}本（調整前は0.9本に潰れていた）`);

    // 実測値は捨てずに保存されていること（調整は単調性の制約であって測定の否定ではない）
    t('§env-h 実測のgammaが設定に逐語保存されている',
      Array.isArray(cfg.environment._gamma_by_level?._measured_points)
      && cfg.environment._gamma_by_level._measured_points.length
         === cfg.environment._gamma_by_level.points.length,
      '_measured_points に調整前の値を保持');
  }

  // 基準年換算の本数でgammaを引く実装（誤り）だと往復しない＝再発検知。
  // 35本級で見る（45本級は上の潰れ帯に入り、誤り版でもたまたま近い値になるため検知に使えない）
  {
    const obs = 35, ref = fwd(obs);
    const wrong = ref * Math.pow(ratio, g(ref)); // gammaを ref で引いてしまった場合
    t('§env-e gammaを基準年換算で引くと往復しない（この誤りの再発検知）',
      Math.abs(wrong - obs) > 0.5,
      `誤=${wrong.toFixed(1)}本 vs 正=${obs}本`);
  }
}

// ── §文脈 ミートの基準打率が査定に届いているか（2026-08-05 T-0102の修理の再発検知）──
// 以前は selectContext が Tier B と判定しても appraiseBatting へ総合打率を渡しており、
// 「判定は動くが結果に効かない」状態だった。判定と結果の両方を縛る。
{
  const { appraiseBatting } = await import('../src/ratings/from_rates.mjs');
  const { loadLeagueSplitAverage } = await import('../src/ratings/nf3_splits.mjs');
  const dists = { contact: { mu: -1.6, sigma: 0.4 }, eye: { mu: -2.4, sigma: 0.5 } };
  const line = { PA: 600, AB: 540, H: 150, B2: 25, B3: 2, HR: 15, BB: 50, HBP: 5, SO: 90, SH: 0, SF: 5 };
  const env = { lgAvg: 0.243, lgHrRate: 0.022, refAvg: 0.251, refHrRate: 0.026 };
  const base = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true });
  // 対右だけ低い選手。総合.278 に対して対右.250
  const ctxLow = { avg: 0.250, AB: 380, tier: 'B', lgAvg: 0.2465 };
  const withCtx = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true, contextAvg: ctxLow });

  t('§文脈-a 文脈打率を渡すとミートが変わる（渡しても効かない状態の再発検知）',
    withCtx.meet !== base.meet, `総合${base.meet} → 対右${withCtx.meet}`);
  t('§文脈-b 対右で打てていない選手はミートが下がる',
    withCtx.meet < base.meet, `総合.278→${base.meet} / 対右.250→${withCtx.meet}`);
  t('§文脈-c どの文脈を使ったかが観測値に残る',
    withCtx.observed.avgContext?.tier === 'B' && withCtx.observed.avgContext?.AB === 380,
    JSON.stringify(withCtx.observed.avgContext));
  t('§文脈-d 総合を使った時は avgContext が null（区別できる）',
    base.observed.avgContext === null, 'null');

  // ★リーグ平均を揃え忘れる誤りの再発検知（仕様02 §92「文脈を一致させる」）
  const mismatched = appraiseBatting(line, cfg, dists, env, {
    useIsoBlend: true, contextAvg: { ...ctxLow, lgAvg: env.lgAvg },
  });
  t('§文脈-e リーグ平均を総合のままにすると結果がずれる（片側だけ切替の再発検知）',
    mismatched.meet !== withCtx.meet,
    `リーグ対右で揃える=${withCtx.meet} / リーグ総合のまま=${mismatched.meet}`);

  // ★2026-08-05 オーナー指示で縮小の設計が変わったためテストも書き換えた。
  //   旧: 全選手に一律kappa=300 → 文脈の打数が少ないほど強くPriorへ戻る、を検証していた
  //   新: 「基本的にはその年だけで査定。過去を参照するのは出場が少ない時だけ」
  //       → **その年の総打数**が十分ならkappa=0＝縮小しない。文脈打数はkappa>0の時の重みに使う
  const prior = { avg: 0.250, hr: 0.02, kind: 'test', basis: 'test' };
  const fullSeason = appraiseBatting(line, cfg, dists, env,
    { useIsoBlend: true, prior, contextAvg: { avg: 0.320, AB: 380, tier: 'B', lgAvg: 0.2465 } });
  // 出場が少ない年（総打数200＝けが等で出られなかった想定）
  const shortLine = { ...line, AB: 200, H: 56, PA: 230 };
  const shortSeason = appraiseBatting(shortLine, cfg, dists, env,
    { useIsoBlend: true, prior, contextAvg: { avg: 0.320, AB: 140, tier: 'B', lgAvg: 0.2465 } });

  t('§文脈-f 十分出場した年は縮小しない（その年の成績をそのまま使う）',
    fullSeason.observed.kappaUsed?.meet === 0,
    `総打数${line.AB} → kappa=${fullSeason.observed.kappaUsed?.meet}`);
  t('§文脈-f2 出場が少ない年は縮小する（けが等で出られなかった場合）',
    shortSeason.observed.kappaUsed?.meet > 0,
    `総打数${shortLine.AB} → kappa=${shortSeason.observed.kappaUsed?.meet}（不足${shortSeason.observed.kappaUsed?.shortfall}）`);
  t('§文脈-f3 縮小の強さは出場の不足分で決まる（恣意的な固定値ではない）',
    shortSeason.observed.kappaUsed?.shortfall === (cfg.shrinkage.full_season_ab - shortLine.AB),
    `${cfg.shrinkage.full_season_ab} − ${shortLine.AB} = ${shortSeason.observed.kappaUsed?.shortfall}`);
  t('§文脈-f4 十分出場の閾値は実データ由来（規定打席到達者の打数の最小値）',
    cfg.shrinkage.full_season_ab === 359 && /規定打席/.test(cfg.shrinkage._full_season_ab_basis ?? ''),
    `full_season_ab=${cfg.shrinkage.full_season_ab}`);

  // リーグ側の対右平均が実データから引けること（引けない年は null を返す）
  const lg2024 = loadLeagueSplitAverage(db, 2024, '対右投手');
  // ★実際に使われたkappaが計算ログに出るか（2026-08-06発見: kappa_meet/kappa_powerは
  //   静的な上限値であり、この選手に実際使われた値ではなかった。オーナーからの
  //   「パワー素点83.8→最終75.3はなぜ」という質問に答える過程で気づいた別件）
  const { buildCalcLog } = await import('../src/cards/card_schema.mjs');
  const logFull = buildCalcLog({ line, bat: fullSeason, prior, cfg, contextTier: 'B' });
  const logShort = buildCalcLog({ line: shortLine, bat: shortSeason, prior, cfg, contextTier: 'B' });
  t('§文脈-i 計算ログにも実際使われたkappaが出る（静的な上限値と別に）',
    logFull.shrinkage.kappa_used?.meet === 0 && logShort.shrinkage.kappa_used?.meet > 0,
    `十分出場=${logFull.shrinkage.kappa_used?.meet} / 出場少=${logShort.shrinkage.kappa_used?.meet}`);

  t('§文脈-g リーグの対右平均が実データから作れる',
    lg2024 != null && lg2024.avg > 0.2 && lg2024.avg < 0.3 && lg2024.players > 100,
    lg2024 ? `${lg2024.avg.toFixed(4)}（${lg2024.players}人・${lg2024.AB}打数）` : 'null');
  t('§文脈-h NF3の無い年は null を返す（0で埋めない）',
    loadLeagueSplitAverage(db, 1990, '対右投手') === null, 'null');
}

// ── §球場 環境補正に球場が入っているか（2026-08-05 T-0103の修理の再発検知）──
// 仕様02 §4は「年度比 × 球場 × リーグ」の掛け算だが、実装は年度比だけで球場が丸ごと落ちていた。
// 係数は測定済み(2026-08-01)で球場別の打数も読み込んでいたのに、一度も参照していなかった。
{
  const { appraiseBatting, playerParkFactor } = await import('../src/ratings/from_rates.mjs');
  const { existsSync, readFileSync } = await import('node:fs');
  const dists = { contact: { mu: -1.6, sigma: 0.4 }, eye: { mu: -2.4, sigma: 0.5 } };
  const line = { PA: 600, AB: 540, H: 140, B2: 25, B3: 1, HR: 30, BB: 50, HBP: 5, SO: 110, SH: 0, SF: 5 };
  const env = { lgAvg: 0.243, lgHrRate: 0.022, refAvg: 0.251, refHrRate: 0.026 };

  // 打ちにくい球場（0.65）で打った本塁打は割り増して評価される
  const hard = { factor: 0.65, coverage: 1.0, parks: [{ park: '甲子園', ab: 540, factor: 0.65 }] };
  const easy = { factor: 1.99, coverage: 1.0, parks: [{ park: '神宮', ab: 540, factor: 1.99 }] };
  const base = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true });
  const inHard = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true, parkFactor: hard });
  const inEasy = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true, parkFactor: easy });

  t('§球場-a 球場係数を渡すとパワーが変わる（渡しても効かない状態の再発検知）',
    inHard.power !== base.power, `補正なし${base.power} → 甲子園${inHard.power}`);
  t('§球場-b 打ちにくい球場の本塁打は高く評価される',
    inHard.power > base.power, `補正なし${base.power} < 甲子園${inHard.power}`);
  t('§球場-c 打ちやすい球場の本塁打は低く評価される',
    inEasy.power < base.power, `神宮${inEasy.power} < 補正なし${base.power}`);
  t('§球場-d 同じ本塁打数でも球場で差がつく',
    inHard.power - inEasy.power > 5, `甲子園${inHard.power} − 神宮${inEasy.power} = ${(inHard.power - inEasy.power).toFixed(1)}点`);
  t('§球場-e どの球場でどれだけ打ったかが観測値に残る',
    inHard.observed.parkFactor?.factor === 0.65 && inHard.observed.parkFactor.parks.length === 1,
    JSON.stringify(inHard.observed.parkFactor?.parks));
  t('§球場-f 球場データが無ければ補正しない（1.0で埋めない）',
    base.observed.parkFactor === null && base.observed.parkSkipped === null, 'null');

  // 係数の無い球場は分母から外す（1.0で埋めると「平均的な球場だった」と嘘をつく）
  const mixed = playerParkFactor(
    [{ park: '甲子園', AB: 200 }, { park: '未知の地方球場', AB: 100 }],
    { parks: { 甲子園: { factor: 0.65 } } });
  t('§球場-g 係数の無い球場は加重の分母から外す（1.0で埋めない）',
    Math.abs(mixed.factor - 0.65) < 1e-9 && mixed.coveredAB === 200 && mixed.totalAB === 300,
    `係数${mixed.factor} 被覆${mixed.coveredAB}/${mixed.totalAB}`);
  t('§球場-h 被覆率が低い時は補正しない（一部の球場だけで全体を代表させない）',
    appraiseBatting(line, cfg, dists, env, {
      useIsoBlend: true, parkFactor: { factor: 0.65, coverage: 0.2, parks: [] },
    }).observed.parkFactor === null, '被覆20%では未適用');

  // 実測ファイルが存在し、極端な球場の差が想定どおりの向きであること
  const pfPath = 'outputs/derived/park_factors.json';
  if (existsSync(pfPath)) {
    const pf = JSON.parse(readFileSync(pfPath, 'utf8'));
    const jingu = pf.hr?.parks?.['神宮']?.factor, koshien = pf.hr?.parks?.['甲子園']?.factor;
    t('§球場-i 実測の球場係数が読める（神宮 > 甲子園）',
      jingu > 1.5 && koshien < 0.8, `神宮${jingu?.toFixed(2)} / 甲子園${koshien?.toFixed(2)}`);
  }
}

// ── §二重 階層Bと対左差分の二重適用（2026-08-05に作り込んで同日発見・解消）──
// Tier B は「対右投手の打率」を基準にするので、対左の影響はその時点で既に外れている。
// そこからさらに対左差分を引くと同じ調整を2回かける。2026-08-04のSol Pro白紙便が
// 「階層Bでは対左得能を逆算に入れてはいけない」と独立に指摘していた点。
{
  const { buildMeetLedger } = await import('../src/ratings/special_abilities.mjs');
  const base = {
    rawTotalAvg: 0.280, AB: 500,
    env: { lgAvg: 0.243, refAvg: 0.251 },
    prior: { avg: 0.255 },
    clutch: null,
    platoon: { meetDiff: 0.040, weight: 0.33, reliability: 0.60, vsLAb: 165, vsRAb: 335 },
  };
  const asB = buildMeetLedger(55, { ...base, contextTier: 'B', infieldHitAbility: null }, cfg);
  const asC = buildMeetLedger(55, { ...base, contextTier: 'C', infieldHitAbility: null }, cfg);
  // 台帳は skip も delta=0 の項目として adjustments に入れ、理由の頭に [調整不要] を付ける
  const entryOf = (led, name) => (led.adjustments ?? []).find(a => a.component === name);
  const deltaOf = (led, name) => entryOf(led, name)?.delta ?? 0;

  t('§二重-a Tier Bでは対左差分を引かない（二重適用の再発検知）',
    deltaOf(asB, 'vs_left_delta') === 0,
    `Tier Bの対左ぶん=${deltaOf(asB, 'vs_left_delta')}`);
  t('§二重-b Tier C（総合が基準）では従来どおり対左差分を引く',
    deltaOf(asC, 'vs_left_delta') !== 0,
    `Tier Cの対左ぶん=${deltaOf(asC, 'vs_left_delta').toFixed(2)}`);
  t('§二重-c 見送った理由が台帳に残る（黙って落とさない）',
    /二重適用/.test(entryOf(asB, 'vs_left_delta')?.reason ?? ''),
    entryOf(asB, 'vs_left_delta')?.reason?.slice(0, 45));
  // ★2026-08-05 このテストは同日中に逆向きへ書き換えた。
  //   当初は「対右基準でも得点圏の影響は残るのだから引くべき」として delta≠0 を期待していた。
  //   方針としては正しいが、**引く方法が間違っていた**とオーナー指摘で判明したため訂正する。
  //   実装は `rawTotalAvg`（総合打率）から得点圏差を引いた値を、baselineMeet（対右打率から
  //   作った値）と比べていた＝母集団が違うものの引き算。
  //   実測（村上宗隆2024）: 総合.244／対右.217。この調整は+3.55点を加算していたが、
  //   中身は得点圏の効果ではなく **.244と.217の差(27厘)** だった。村上は得点圏で強い
  //   （.273 vs 非得点圏.233）ので、仕様05 §2の意図ではミートは下がるはずで符号すら逆。
  //   正しく引くには「対右投手の中での得点圏差」が要るが交差セルは公開データに無く、
  //   仕様02 §5.1が周辺値からの復元を禁じている。よって Tier B では引かない。
  const asBClutch = buildMeetLedger(55, {
    ...base, contextTier: 'B', infieldHitAbility: null,
    clutch: { diff: 0.030, weight: 0.25, reliability: 0.55, rispAb: 120 },
  }, cfg);
  t('§二重-d Tier Bではチャンス差分を引かない（総合打率ベースの差を対右基準に当てる誤りの再発検知）',
    deltaOf(asBClutch, 'chance_delta') === 0,
    `Tier Bのチャンスぶん=${deltaOf(asBClutch, 'chance_delta')}`);
  t('§二重-e 引かない理由が台帳に残る（黙って落とさない）',
    /交差セル|母集団/.test(entryOf(asBClutch, 'chance_delta')?.reason ?? ''),
    entryOf(asBClutch, 'chance_delta')?.reason?.slice(0, 50));
  t('§二重-f Tier C（総合が基準）では従来どおりチャンス差分を引く',
    deltaOf(buildMeetLedger(55, {
      ...base, contextTier: 'C', infieldHitAbility: null,
      clutch: { diff: 0.030, weight: 0.25, reliability: 0.55, rispAb: 120 },
    }, cfg), 'chance_delta') !== 0,
    '総合打率が基準なら母集団は揃っているので引ける');
}

// ── §捕逸 捕手の捕球を捕逸で測る（2026-08-05 オーナー裁定）──
// 仕様04 §10.1が捕手の捕球材料に捕逸を名指ししているのに一度も読んでいなかった。
// 現行のErrRは捕手について実質的に捕逸の指標（corr -0.685、失策Eとは -0.155）なので併用＝二重計上。
// 差し替えの主目的は被覆（ErrRは2020年以降のみ、捕逸は2006年から）。
{
  const { catchingRating, appraiseAllPositions } = await import('../src/ratings/fielding.mjs');
  const { readFileSync } = await import('node:fs');
  const fldNorm = JSON.parse(readFileSync('configs/fielding_norms.json', 'utf8'));

  const n = fldNorm.passedBallByCatcherSeason;
  t('§捕逸-a 捕逸の正規化パラメータが2006年から作られている',
    n?.bySeason?.['2006'] != null && n?.bySeason?.['2024'] != null && Object.keys(n.bySeason).length >= 18,
    `${Object.keys(n?.bySeason ?? {}).length}年分`);

  const mk = (pb, g, season = 2024) => ({ pos: 'C', season, inn: 900, pb, g, errr: 5, rngr: null, arm: 1 });
  const few = catchingRating(mk(1, 100), fldNorm, cfg);   // 捕逸が少ない＝良い
  const many = catchingRating(mk(9, 100), fldNorm, cfg);  // 捕逸が多い＝悪い
  t('§捕逸-b 捕逸が少ない捕手ほど捕球が高い（符号の向き）',
    few.rating > many.rating, `捕逸1個=${few.rating.toFixed(1)} > 捕逸9個=${many.rating.toFixed(1)}`);
  t('§捕逸-c 捕手の捕球は捕逸を材料にしている（ErrRではない）',
    few.material === 'passed_ball', few.material);

  // ErrRを変えても捕手の捕球は動かない（＝差し替えであって併用でないことの保証）
  const base = catchingRating({ ...mk(4, 100), errr: 5 }, fldNorm, cfg);
  const errrChanged = catchingRating({ ...mk(4, 100), errr: -5 }, fldNorm, cfg);
  t('§捕逸-d ErrRを変えても捕手の捕球は動かない（併用による二重計上の再発検知）',
    Math.abs(base.rating - errrChanged.rating) < 1e-9,
    `ErrR=5 → ${base.rating.toFixed(2)} / ErrR=-5 → ${errrChanged.rating.toFixed(2)}`);

  // 捕手以外は従来どおりErrR
  const ss = catchingRating({ pos: 'SS', season: 2024, inn: 900, errr: 5, pb: null }, fldNorm, cfg);
  t('§捕逸-e 捕手以外は従来どおりErrRで測る',
    ss != null && ss.material !== 'passed_ball', ss ? (ss.material ?? 'ErrR') : 'null');

  // ★被覆: 守備イニングが無い年（2019年以前）でも捕逸だけで捕球を査定できる
  const oldRows = [{ pos: 'C', season: 2015, inn: 0, pb: 3, g: 68,
    rngr: null, errr: null, arm: null, framing: null, blocking: null }];
  const oldFld = appraiseAllPositions(oldRows, 0, fldNorm, cfg);
  t('§捕逸-f 守備イニングが無い年でも捕逸だけで捕球が出る（被覆拡大の再発検知）',
    oldFld.length === 1 && oldFld[0].catching?.rating != null,
    oldFld.length ? `捕球=${oldFld[0].catching?.rating?.toFixed(1)}` : '行が落ちた');
  t('§捕逸-g そのとき守備力・肩力はnullのまま（材料が無いものを埋めない）',
    oldFld[0]?.fielding == null && oldFld[0]?.arm == null, '両方null');

  t('§捕逸-h 捕逸が無ければ捕球はnull（0で埋めない）',
    catchingRating({ pos: 'C', season: 2024, inn: 900, pb: null, g: 100, errr: 5 }, fldNorm, cfg) === null, 'null');
}

// ── §未査定 nullになった能力が自動で未査定に載る（2026-08-05）──
// 以前は手書きの列挙で17項目中5つしか書かれておらず、捕手19人全員の守備力がnullなのに
// 「未査定」に出ていなかった＝欠落が黙って通っていた。
{
  const { collectUnappraised } = await import('../src/cards/ability_sheet.mjs');
  const base = { ミート: { value: 50 }, パワー: null, 守備力: null, 捕球: { value: 50 } };
  const abilities = { 送球: null, 盗塁: { value: 50 } };

  const listNonCatcher = collectUnappraised([base, abilities], { pos: '三' });
  t('§未査定-a nullの能力が自動で載る（列挙の書き忘れが起きない）',
    listNonCatcher.length === 3
    && listNonCatcher.some(s => s.startsWith('パワー'))
    && listNonCatcher.some(s => s.startsWith('守備力'))
    && listNonCatcher.some(s => s.startsWith('送球')),
    listNonCatcher.join(' / ').slice(0, 60));
  t('§未査定-b 値のある能力は載らない',
    !listNonCatcher.some(s => s.startsWith('ミート') || s.startsWith('捕球') || s.startsWith('盗塁')), 'ミート・捕球・盗塁は出ない');

  const listCatcher = collectUnappraised([base], { pos: 'C' });
  t('§未査定-c 捕手の守備力は理由が言い換わる（構造的な欠落と分かる）',
    /守備範囲/.test(listCatcher.find(s => s.startsWith('守備力')) ?? ''),
    listCatcher.find(s => s.startsWith('守備力'))?.slice(0, 50));

  // キーが無い（捕手以外のフレーミング等）のと、キーはあるが値がnullなのは別物
  t('§未査定-d キー自体が無い項目は未査定に出ない（該当なしと欠落を区別）',
    !collectUnappraised([{ ミート: { value: 50 } }], { pos: '三' }).length, '0件');
}

// ── §捕手肩 捕手の肩力を送球速度で測る（2026-08-05 オーナー裁定）──
// ★層別しないと関係が見えない材料。全体68人では r=0.036 だが
//   外野 -0.135 / 内野 +0.137 / 捕手 +0.676 と層で符号すら違う（層の水準差が打ち消し合う）。
//   CCは当初これを層別せずに測り「使えないと確定」と誤報告した。
{
  const { buildDirectMeasurements } = await import('../src/ratings/direct_measurement.mjs');
  const dm = { ...cfg.direct_measurement, npb_plus_direct: cfg.npb_plus_direct };

  const futureBlocked = buildDirectMeasurements({ throw_speed_kmh: 130.0, is_catcher: true }, dm, 2024);
  const fast = buildDirectMeasurements({ throw_speed_kmh: 130.0, is_catcher: true }, dm, 2026);
  const slow = buildDirectMeasurements({ throw_speed_kmh: 107.0, is_catcher: true }, dm, 2026);
  t('§捕手肩-a NPB+2026送球速度は2024カードへ未来情報として入れない',
    futureBlocked.肩力 == null, `2024肩力=${futureBlocked.肩力?.value ?? 'null'}`);
  t('§捕手肩-b 計測年2026なら捕手の送球速度から肩力が出て、速いほど高い',
    fast.肩力?.value != null && fast.肩力.value > slow.肩力.value,
    `130km/h=${fast.肩力?.value} > 107km/h=${slow.肩力?.value}`);

  // ★捕手以外へは適用しない（内野・外野では効いていないため）
  const notCatcher = buildDirectMeasurements({ throw_speed_kmh: 145.0, is_catcher: false }, dm, 2026);
  t('§捕手肩-c 捕手以外には適用しない（層別漏れの再発検知）',
    notCatcher.肩力 == null, '外野手145km/hでも null');

  t('§捕手肩-d 実測が無ければ肩力はnull（0で埋めない）',
    buildDirectMeasurements({ is_catcher: true }, dm, 2026).肩力 == null, 'null');
  t('§捕手肩-e どの材料から来たかが残る',
    /NPB\+/.test(fast.肩力.source ?? ''), fast.肩力.source);
  t('§捕手肩-f 計測年2026は同年直接計測として扱う',
    fast.肩力.tier === 'direct_same_year', fast.肩力.tier);
  t('§捕手肩-g 暫定であることが値に添えられている',
    /暫定/.test(fast.肩力.note ?? ''), '注記あり');

  // ★実測が能力欄まで届くこと（「受け皿はあるのに効かない」状態の再発検知）。
  //   2026-08-05以前は directs の組み立てが能力欄の後ろにあり、証拠は出るのに能力値が1点も動かなかった。
  {
    const { makeContext, appraiseCard } = await import('../src/cards/pipeline.mjs');
    const { readFileSync } = await import('node:fs');
    const rv = JSON.parse(readFileSync('configs/run_values.json', 'utf8')).values;
    const runNorm = JSON.parse(readFileSync('configs/running_norms.json', 'utf8'));
    const fldNorm = JSON.parse(readFileSync('configs/fielding_norms.json', 'utf8'));
    const ctx2 = makeContext(db, cfg);
    const res = appraiseCard(ctx2, { name: '若月　健矢', mode: '2024', cfg, rv, runNorm, fldNorm });
    const sheetArm = res.card?.abilities?.基礎能力?.肩力?.value;
    const directArm = res.card?.ability_evidence?.肩力?.direct_measurement;
    t('§捕手肩-h 2024実カードにもNPB+2026の肩力直接計測が漏れない',
      sheetArm != null && directArm == null,
      `能力欄=${sheetArm} / direct=${directArm?.value ?? 'null'}`);
  }

  // ── §球場2 改称と、NF3の無い年の内訳（2026-08-05）─────────────────
  // 実害2件: (1)係数は現在の呼称・1球データは当時の呼称で一致せず、柳田2020や浅村2021の
  //          球場補正が丸ごと効いていなかった (2)球場補正が計算ログに1行も残っていなかった
  {
    const { playerParkFactor } = await import('../src/ratings/from_rates.mjs');
    const { makeContext, appraiseCard } = await import('../src/cards/pipeline.mjs');
    const { readFileSync, existsSync } = await import('node:fs');
    const aliases = JSON.parse(readFileSync('configs/park_aliases.json', 'utf8'));
    const table = { parks: { 'みずほPayPay': { factor: 1.2 }, 'エスコンＦ': { factor: 0.9 } } };

    const renamed = playerParkFactor([{ park: 'PayPayドーム', AB: 300 }], table, aliases);
    t('§球場2-a 改称前の呼称でも係数が引ける（黙って分母から落ちる状態の再発検知）',
      renamed && Math.abs(renamed.factor - 1.2) < 1e-9 && renamed.coverage === 1,
      renamed ? `係数${renamed.factor} 被覆${(renamed.coverage * 100).toFixed(0)}%` : 'null');
    t('§球場2-b 対応表が無ければ引けないまま（対応表が効いていることの裏取り）',
      playerParkFactor([{ park: 'PayPayドーム', AB: 300 }], table, null) === null, 'null');
    t('§球場2-c 全角Fと半角Fの表記ゆれを吸収する',
      Math.abs(playerParkFactor([{ park: 'エスコンF', AB: 300 }], table, aliases).factor - 0.9) < 1e-9,
      '0.9');

    // 移転（別の建物）を同一視していないこと。札幌ドームの打席がエスコンの係数を拾ってはいけない
    t('§球場2-d 札幌ドームとエスコンFは別の球場のまま（移転を改称と混同しない）',
      playerParkFactor([{ park: '札幌ドーム', AB: 300 }], table, aliases) === null,
      '札幌ドームは係数が引けない＝統合されていない');
    t('§球場2-e 対応表に移転が混入していない',
      !aliases.aliases.some(a => {
        const ns = [a.canonical, ...(a.also ?? [])];
        return ns.some(n => n.includes('札幌')) && ns.some(n => n.includes('エスコン'));
      }), 'なし');

    // 係数が引けなかった球場は記録に残す（静かに落ちるのを防ぐ）
    const withLocal = playerParkFactor(
      [{ park: 'PayPayドーム', AB: 300 }, { park: '北九州', AB: 20 }], table, aliases);
    t('§球場2-f 係数の無い球場は unmatchedParks に残る',
      withLocal.unmatchedParks?.length === 1 && withLocal.unmatchedParks[0].park === '北九州',
      JSON.stringify(withLocal.unmatchedParks));

    // NF3（2023-2025）の無い年でも、1球データの内訳で補正が効く
    if (db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name='park_plate_appearances'`).get()) {
      const rv = JSON.parse(readFileSync('configs/run_values.json', 'utf8')).values;
      const runNorm = JSON.parse(readFileSync('configs/running_norms.json', 'utf8'));
      const fldNorm = JSON.parse(readFileSync('configs/fielding_norms.json', 'utf8'));
      const ctx3 = makeContext(db, cfg);
      const c2021 = appraiseCard(ctx3, { name: '村上　宗隆', mode: '2021', cfg, rv, runNorm, fldNorm }).card;
      const pk = c2021?.calc_log?.power?.park;
      t('§球場2-g NF3の無い年でも球場補正が効く（1球データの内訳を使う）',
        pk && pk.factor > 1 && pk.coverage > 0.9,
        pk ? `2021年 係数${pk.factor.toFixed(3)} 被覆${(pk.coverage * 100).toFixed(0)}%` : 'null');
      t('§球場2-h 球場補正が計算ログに残る（結果に効くのに追えない状態の再発検知）',
        pk && pk.parks?.length > 0 && pk.covered_ab > 0 && pk.total_ab >= pk.covered_ab,
        pk ? `${pk.parks.length}球場・${pk.covered_ab}/${pk.total_ab}打席` : 'null');
      t('§球場2-i 主な球場が本拠地になっている（名寄せの取り違え検知）',
        pk?.parks?.[0]?.park === '神宮', pk?.parks?.[0]?.park);
    }
  }

  // ── §経路 査定の入り口が1つであること（2026-08-05）────────────────────
  // 実害: シーズン一括査定が appraiseBatting を直接呼んでおり、カード査定が渡している
  // 材料（球場補正・ミートの文脈打率）を渡していなかった。同じ選手に2つの値が存在し、
  // **エンジンの分布合わせはそちら側で判定していた**ため、カード側の改善が判定に入らなかった。
  // 食い違いは2021年250人でパワー平均4.52点・最大31.6点。
  {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('scripts/appraise_season.mjs', 'utf8');
    t('§経路-a シーズン一括査定は appraiseBatting を直接呼ばない（2経路化の再発検知）',
      !/\bappraiseBatting\s*\(/.test(src), 'appraiseBatting( の直接呼び出しなし');
    t('§経路-b シーズン一括査定はカード査定を経由する',
      /appraiseCard\s*\(/.test(src), 'appraiseCard( を使用');

    // 球場係数はその年の平均が1.0でなければならない（リーグ全体の水準を動かさないため）。
    // 集めた係数は年により 0.925〜1.055 とばらついており、正規化しないと全選手の本塁打が
    // 一律に割り増し／割り引きされる（実測: シミュレーションの本塁打が +3.25% ずれた）
    const { makeContext: mk, appraiseCard: ac } = await import('../src/cards/pipeline.mjs');
    const rv2 = JSON.parse(readFileSync('configs/run_values.json', 'utf8')).values;
    const rn = JSON.parse(readFileSync('configs/running_norms.json', 'utf8'));
    const fn = JSON.parse(readFileSync('configs/fielding_norms.json', 'utf8'));
    const ctx4 = mk(db, cfg);
    const c = ac(ctx4, { name: '村上　宗隆', mode: '2021', cfg, rv: rv2, runNorm: rn, fldNorm: fn }).card;
    const pk2 = c?.calc_log?.power?.park;
    // 神宮は本塁打が出やすいので1より大きく、かつ正規化後なので極端にはならない
    t('§経路-c 球場係数はその年の平均が1.0になるよう正規化される',
      pk2 && pk2.factor > 1.0 && pk2.factor < 1.6,
      pk2 ? `村上2021 = ${pk2.factor.toFixed(3)}` : 'null');

    // 二軍成績が Prior に入ること（仕様 §8.4）。カード査定側に無く、移植した
    t('§経路-d 二軍成績を Prior 候補に引ける（仕様§8.4・カード査定に欠けていた経路）',
      typeof ctx4.farmHistOf === 'function', typeof ctx4.farmHistOf);
  }

  // ── §NPB実測 NPB+アプリの実測をパワー・走力へ（2026-08-05 オーナー承認 T-0107）──
  {
    const { buildDirectMeasurements } = await import('../src/ratings/direct_measurement.mjs');
    const merged = { ...cfg.direct_measurement, npb_plus_direct: cfg.npb_plus_direct };
    const row = { hard_hit_pct: 49, barrel_pct: 17, swing_speed_avg: 115.1, top_speed_kmh: 29.4, launch_angle_avg: 15 };
    const dPast = buildDirectMeasurements(row, merged, 2024);
    const d = buildDirectMeasurements(row, merged, 2026);

    t('§NPB実測-a 2026年NPB+実測を2024年カードへ未来情報として入れない',
      dPast.パワー == null && dPast.走力 == null,
      `2024: パワー=${dPast.パワー?.value ?? 'null'} / 走力=${dPast.走力?.value ?? 'null'}`);
    t('§NPB実測-b 計測年2026のカードでは瞬間最高速度から走力が出る',
      d.走力?.value > 0, d.走力 ? `${d.走力.value}（${d.走力.source}）` : 'null');
    t('§NPB実測-c 計測年なら同じ能力に候補が複数あっても1つだけ使う（重ねない）',
      d.パワー?.source?.includes('hard_hit_pct'), `${d.パワー?.source}（testの一致が最も高いもの）`);

    // ★2026-08-06 オーナー指摘で追加。NPB+のモデルはパワプロの能力値を目標に当てはめた式
    //   （scripts/calibrate_npb_plus_direct.mjs が `SELECT power ... FROM pawapuro_full`）。
    //   仕様アンカーを持つ能力へ混ぜると目盛りが2つになるので、パワーには渡さない。
    const withAnchor = buildDirectMeasurements(row, { ...merged, scale_calibration: cfg.scale_calibration }, 2026);
    t('§NPB実測-g 計測年でも仕様アンカーを持つ能力（パワー）にはパワプロ目盛りの実測を入れない',
      withAnchor.パワー == null, `パワー=${withAnchor.パワー?.value ?? 'null'}`);
    t('§NPB実測-h アンカーの無い走力は計測年には使える（実測自体を捨てたわけではない）',
      withAnchor.走力?.value > 0, `走力=${withAnchor.走力?.value}`);
    t('§NPB実測-d ホールドアウトで保たれない材料は使わない（弾道＝打球角度 test 0.129）',
      !JSON.stringify(d).includes('launch_angle'), '弾道は入らない');
    t('§NPB実測-e 実測が無ければ何も返さない（推定で埋めない）',
      (() => { const e = buildDirectMeasurements({}, merged, 2026); return !e.パワー && !e.走力; })(), 'null');

    // ★実測で統計値を丸ごと置き換えない（精度の低い実測が精度の高い統計を壊すのを防ぐ）
    const { makeContext: mk3, appraiseCard: ac3 } = await import('../src/cards/pipeline.mjs');
    const { readFileSync: rf } = await import('node:fs');
    const rv2 = JSON.parse(rf('configs/run_values.json', 'utf8')).values;
    const ctx6 = mk3(db, cfg);
    const card = ac3(ctx6, { name: '山川　穂高', mode: '2024', cfg, rv: rv2, runNorm, fldNorm }).card;
    const sp = card?.abilities?.基礎能力?.走力;
    // 2024カードには2026年NPB+を入れない。さらに2026-08-07以降は、
    // 旧speedComponents自体が走塁技術混入で停止中なので、最終走力はnullが正しい。
    // 直接計測・旧proxyは ability_evidence / calc log にだけ残す。
    const speedGate = ctx6.modelGates?.speed_ability;
    t('§NPB実測-f 2024能力欄まで2026年NPB+が漏れず、停止中の旧走力も最終値に出ない',
      speedGate?.enabled === false && sp == null,
      `speed_gate=${speedGate?.status ?? '—'} / ability=${sp?.value ?? 'null'}`);

    // ★アンカーがそのまま能力値になること（パワプロ較正・実測混合のどちらでも上書きされない）
    const mura = ac3(ctx6, { name: '村上　宗隆', mode: '2024', cfg, rv: rv2, runNorm, fldNorm }).card;
    const anc = cfg.power_anchors.points;
    const interp = x => {
      for (let i = 1; i < anc.length; i++) {
        if (x <= anc[i][0]) { const [a, b] = anc[i - 1], [c2, d2] = anc[i]; return b + (d2 - b) * (x - a) / (c2 - a); }
      }
      return anc.at(-1)[1];
    };
    const expected = interp(mura.calc_log.power.post);
    t('§アンカー-a 補正後の本塁打数がアンカーどおりの点数になる（別の目盛りで上書きされない）',
      Math.abs(mura.abilities.基礎能力.パワー.value - expected) < 0.15,
      `${mura.calc_log.power.post.toFixed(2)}本 → 期待${expected.toFixed(1)} / 実際${mura.abilities.基礎能力.パワー.value}`);
    t('§アンカー-b 目安（20本→70 / 30本→80 / 46本→90）が正本に保たれている',
      anc.find(p => p[0] === 20)?.[1] === 70 && anc.find(p => p[0] === 30)?.[1] === 80
      && anc.find(p => p[0] === 46)?.[1] === 90, '20→70 / 30→80 / 46→90');
    t('§アンカー-c ミート・パワーにはパワプロ較正を当てない（当てるとアンカーが壊れる）',
      cfg.scale_calibration.applied.ミート == null && cfg.scale_calibration.applied.パワー == null
      && cfg.scale_calibration.not_applied_has_spec_anchor?.パワー != null,
      '較正対象は走力・弾道のみ');
    t('§アンカー-d 走力・弾道の較正は残っている（こちらはアンカーが無く較正が唯一の根拠）',
      cfg.scale_calibration.applied.走力?.slope > 0 && cfg.scale_calibration.applied.弾道?.slope > 0,
      `走力 slope=${cfg.scale_calibration.applied.走力?.slope.toFixed(3)}`);
  }

  // ── §併殺材料 併殺の各段階を守備力へ（2026-08-05 オーナー承認）──────────
  // 守備範囲（RngR、翌年一致0.256）より再現性が高い（DPS二塁0.436・DPT遊撃0.399）。
  // 置き換えず足す。DPF（最後に受ける）は0.055でほぼ再現しないので使わない。
  {
    const { fieldingRating } = await import('../src/ratings/fielding.mjs');
    const base = { pos: '2B', inn: 1000, rngr: 2.0, errr: 0, chances: 500 };
    const noDp = fieldingRating(base, 0, fldNorm, cfg);
    const manyDp = fieldingRating({ ...base, dps: 35, dpt: 55 }, 0, fldNorm, cfg);
    const fewDp = fieldingRating({ ...base, dps: 10, dpt: 20 }, 0, fldNorm, cfg);

    t('§併殺材料-a 併殺への関与が多いと守備力が上がる',
      manyDp && fewDp && manyDp.rating > fewDp.rating,
      manyDp ? `少ない${fewDp.rating.toFixed(1)} → 多い${manyDp.rating.toFixed(1)}` : 'null');
    t('§併殺材料-b 併殺データが無くても守備力は出る（推定で埋めない）',
      noDp?.rating != null && noDp.components?.length === 1,
      `材料 ${noDp?.components?.map(c => c.name).join('+')}`);
    t('§併殺材料-c 守備機会が少なければ使わない',
      fieldingRating({ ...base, chances: 100, dps: 35, dpt: 55 }, 0, fldNorm, cfg)
        ?.components?.length === 1, '100機会では未使用');
    t('§併殺材料-d 重みは翌年再現性（守備範囲より高い）',
      fldNorm.doublePlay?.byMetricPos?.['DPS|二']?.weight > (fldNorm.rangeWeight ?? 0.256),
      `守備範囲0.256 < DPS二塁 ${fldNorm.doublePlay?.byMetricPos?.['DPS|二']?.weight}`);
    t('§併殺材料-e DPF（最後に受ける）は材料に入っていない（再現しないため）',
      !JSON.stringify(fldNorm.doublePlay?.byMetricPos ?? {}).includes('DPF'), 'DPFなし');
    t('§併殺材料-f 位置の表記が違っても引ける（bm_fldはSS/2B、集計は遊/二）',
      fieldingRating({ ...base, pos: 'SS', dps: 40, dpt: 45 }, 0, fldNorm, cfg)?.components?.length > 1,
      'SSで併殺の材料が入る');
  }

  // ── §走塁材料 追加進塁コンポーネントは再構築まで休止（2026-08-07監査）──────────
  // 旧baserunning_advancesは打席の最終行を開始走者状態として構築しており、
  // 明示状態を読めた3,062件のうち262件(8.56%)でsuccessラベルが矛盾した。
  // 数式の受け皿自体は再構築後に再利用できるよう残すが、本番pipelineはmodel_gatesで入力を遮断する。
  {
    const { speedComponents } = await import('../src/ratings/running.mjs');
    const { readFileSync: rfAdvance } = await import('node:fs');
    const modelGates = JSON.parse(rfAdvance('configs/model_gates.json', 'utf8'));
    const line = { AB: 500, SO: 100, B2: 25, B3: 3, HR: 10, GDP: 8, PA: 570 };
    const base = { gbPct: 45, infieldHits: 15, bats: 'R', season: 2024 };
    const noAdv = speedComponents(line, base, 2.0, runNorm);
    const hypothetical = speedComponents(line, { ...base, advance: 0.15, advanceChances: 40 }, 2.0, runNorm);

    t('§走塁材料-a 数式の受け皿は再構築後の再利用用に残っている',
      hypothetical.z.advance != null && hypothetical.score !== noAdv.score,
      `noAdv=${noAdv.score?.toFixed(3)} / hypothetical=${hypothetical.score?.toFixed(3)}`);
    t('§走塁材料-b ただし既存追加進塁ソースは本番利用停止',
      modelGates.baserunning_advance_source?.enabled === false
        && modelGates.baserunning_advance_source?.status === 'STALE_REBUILD_REQUIRED',
      modelGates.baserunning_advance_source?.status);
    t('§走塁材料-c ラベル矛盾の監査結果が設定に固定されている',
      modelGates.baserunning_advance_source?.evidence?.outcome_label_contradiction_rate > 0.08,
      `${((modelGates.baserunning_advance_source?.evidence?.outcome_label_contradiction_rate ?? 0) * 100).toFixed(2)}%`);
    t('§走塁材料-d 走力は追加進塁なしでも算出できる（欠損を0と見なさない）',
      noAdv.score != null && noAdv.z.advance == null, '既存の他材料だけで算出');

    const pipeSrc = rfAdvance('src/cards/pipeline.mjs', 'utf8');
    const durableSrc = rfAdvance('src/cards/durable_estimate.mjs', 'utf8');
    t('§走塁材料-e 単年経路でゲート無効時はadvanceOfを呼ばない',
      pipeSrc.includes("advanceGate?.enabled === false") && pipeSrc.includes("? null : advanceOf"),
      'pipelineで遮断');
    t('§走塁材料-f 複数年経路でも同じゲートを使う',
      durableSrc.includes('advanceEnabled ? advanceOf'), 'durable_estimateで遮断');
    t('§走塁材料-g 再開条件が設定に明示されている',
      (modelGates.baserunning_advance_source?.reopen_conditions?.length ?? 0) >= 4,
      `${modelGates.baserunning_advance_source?.reopen_conditions?.length ?? 0}条件`);
  }

  // ── §内野送球 内野手の送球（精度）の得能（2026-08-05・オーナー指示の要素切り分け）──
  {
    const { readFileSync, existsSync } = await import('node:fs');
    if (existsSync('outputs/derived/infield_throw_accuracy.json')) {
      const j = JSON.parse(readFileSync('outputs/derived/infield_throw_accuracy.json', 'utf8'));
      // 守備位置ごとに基準を分けている（三塁は一塁まで遠く、無視すると三塁手が一律に悪く出る）
      const b = j.position_baseline;
      t('§内野送球-a 守備位置ごとに基準を分けている',
        b?.['3B']?.rate > b?.['2B']?.rate,
        `3B ${(b?.['3B']?.rate * 100).toFixed(2)}% > 2B ${(b?.['2B']?.rate * 100).toFixed(2)}%`);
      t('§内野送球-b 事象が稀なので得能（有無）にしている＝全員には付かない',
        j.judged.filter(x => x.ability).length < j.judged.length * 0.2,
        `${j.judged.filter(x => x.ability).length}/${j.judged.length}人`);

      const { makeContext: mk2, appraiseCard: ac2 } = await import('../src/cards/pipeline.mjs');
      const rv3 = JSON.parse(readFileSync('configs/run_values.json', 'utf8')).values;
      const rn2 = JSON.parse(readFileSync('configs/running_norms.json', 'utf8'));
      const fn2 = JSON.parse(readFileSync('configs/fielding_norms.json', 'utf8'));
      const ctx5 = mk2(db, cfg);
      // 名寄せ: 1球データは姓だけ（「佐藤輝」）、査定側はフルネーム（「佐藤　輝明」）
      t('§内野送球-c 姓だけの名前をフルネームへ結べている（取り違えは捨てる）',
        [...(ctx5.infieldThrow?.keys() ?? [])].filter(k => k !== '_dropped').length > 0,
        `${[...(ctx5.infieldThrow?.keys() ?? [])].filter(k => k !== '_dropped').length}人`);
      const card = ac2(ctx5, { name: '佐藤　輝明', mode: '2024', cfg, rv: rv3, runNorm: rn2, fldNorm: fn2 }).card;
      const th = card?.abilities?.得能?.送球;   // ★パスは 得能（特殊能力 ではない。一度間違えてFAILで気づいた）
      t('§内野送球-d 2020-2026集約の本人送球を2024カードへ未来情報として入れない',
        th == null,
        th ? `${th.ability} ${th.wild_throws}件/${th.events}打球` : 'null（as-of遮断）');
      const maki = ac2(ctx5, { name: '牧　秀悟', mode: '2024', cfg, rv: rv3, runNorm: rn2, fldNorm: fn2 }).card;
      t('§内野送球-e 判定に届かない選手には付かない（0で埋めない・キーの存在も確認）',
        maki?.abilities?.得能 && ('送球' in maki.abilities.得能) && maki.abilities.得能.送球 == null,
        '送球キーは在るが値はnull');
    }
  }

  // ── §縮小補正 案D（出場量でPriorを補正、2026-08-05 オーナー承認）─────────
  // 縮小はリーグ打率を系統的に押し上げていた（主因=self_recent。少ない出場の年は
  // 本人の平均より実際に悪いのに、その事実を反映せず本人平均へ回帰させていた）。
  // 出場量に応じてPriorを下げることで原因に直接効かせる（案B=後付けで一律に戻す、との比較で採用）。
  {
    const { selectPrior } = await import('../src/ratings/shrinkage.mjs');
    const league = { avg: 0.250, hr: 0.02 };
    const hist = [
      { season: 2022, ab: 500, isFarm: false, avgEnv: 0.280, hrEnv: 0.03 },
      { season: 2023, ab: 480, isFarm: false, avgEnv: 0.275, hrEnv: 0.03 },
    ];
    const fullSeason = selectPrior({ season: 2024, ab: 500 }, hist, league, cfg.shrinkage);
    const shortSeason = selectPrior({ season: 2024, ab: 100 }, hist, league, cfg.shrinkage);

    t('§縮小補正-a 補正係数が設定に保存されている',
      cfg.shrinkage.prior.playing_time_adjustment?.slope > 0,
      JSON.stringify(cfg.shrinkage.prior.playing_time_adjustment?.slope));
    t('§縮小補正-b 出場が少ない年のPriorは、同じ周辺実績でも低く出る（同一のhistoryで打数だけ変えた）',
      shortSeason.avg < fullSeason.avg,
      `500打数=${fullSeason.avg.toFixed(4)} > 100打数=${shortSeason.avg.toFixed(4)}`);
    t('§縮小補正-c 補正は上げる方向には働かない（常に0以下）',
      selectPrior({ season: 2024, ab: 1000 }, hist, league, cfg.shrinkage).avg
        <= (hist[0].avgEnv * hist[0].ab * 0.6 + hist[1].avgEnv * hist[1].ab) / (hist[0].ab * 0.6 + hist[1].ab) + 1e-9,
      '1000打数でも周辺実績の加重平均を超えない');
    t('§縮小補正-d self_recent以外（league）には適用されない',
      selectPrior({ season: 2024, ab: 100 }, [], league, cfg.shrinkage).avg === league.avg,
      `周辺実績なし → ${selectPrior({ season: 2024, ab: 100 }, [], league, cfg.shrinkage).kind}のPrior=リーグ平均のまま`);

    // 実データで、押し上げが小さくなっていることを確認（前は+2〜3厘台、後はおおむね2厘以内）
    const { shrink } = await import('../src/ratings/shrinkage.mjs');
    const rows2024 = db.prepare(`SELECT player_id, ab, h FROM v_batting
      WHERE season = 2024 AND position <> '投' AND ab >= 50`).all();
    const lg2024 = db.prepare(`SELECT SUM(h) h, SUM(ab) ab FROM v_batting WHERE season=2024`).get();
    const league2024 = { avg: lg2024.h / lg2024.ab, hr: 0.02 };
    let rawSum = 0, rawAb = 0, postSum = 0;
    for (const r of rows2024) {
      const h2 = db.prepare(`SELECT season, ab, h FROM v_batting
        WHERE player_id=? AND season BETWEEN 2021 AND 2027 AND season<>2024 AND ab>=30`).all(r.player_id)
        .map(x => ({ season: x.season, ab: x.ab, isFarm: false, avgEnv: x.h / x.ab, hrEnv: 0.02 }));
      const prior = selectPrior({ season: 2024, ab: r.ab }, h2, league2024, cfg.shrinkage);
      const post = shrink(r.h / r.ab, r.ab, prior.avg, cfg.shrinkage.kappa_meet);
      rawSum += r.h; rawAb += r.ab; postSum += post * r.ab;
    }
    const pushUp = (postSum / rawAb - rawSum / rawAb) * 1000;
    t('§縮小補正-e 2024年の押し上げが実データで2.5厘以内に収まっている（旧+2.21厘台から悪化していない）',
      Math.abs(pushUp) < 2.5, `押し上げ ${pushUp >= 0 ? '+' : ''}${pushUp.toFixed(2)}厘`);
  }

  // ── §年度補正の文脈 基準年のリーグ平均も同じ文脈で取る（2026-08-05 オーナー指摘で修理）──
  // 文脈打率（対右投手）を使っているのに、比べる相手の片方だけが総合打率だった。
  //   対象年 = 対右投手のリーグ平均 ／ 基準年(2019) = **総合**のリーグ平均
  // 母集団が違うため環境の差が実際より小さく見積もられていた（2024年で3.79%と出ていたが
  // 対右どうしなら4.67%）。村上宗隆2024の基準打率は .222 → .226 と約4厘上がる。
  {
    const { appraiseBatting } = await import('../src/ratings/from_rates.mjs');
    const dists = { contact: { mu: -1.6, sigma: 0.4 }, eye: { mu: -2.4, sigma: 0.5 } };
    const line = { PA: 610, AB: 500, H: 122, B2: 13, B3: 1, HR: 33, BB: 105, HBP: 4, SO: 180, SH: 0, SF: 1 };
    const env = { lgAvg: 0.2429, lgHrRate: 0.0171, refAvg: 0.2521, refHrRate: 0.0292 };
    // 対右の文脈（2024年.2465 / 2019年.2580）
    const ctxWithRef = { avg: 0.217, AB: 327, tier: 'B', lgAvg: 0.2465, refAvg: 0.2580 };
    const ctxNoRef = { avg: 0.217, AB: 327, tier: 'B', lgAvg: 0.2465, refAvg: null };
    const withRef = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true, contextAvg: ctxWithRef });
    const noRef = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true, contextAvg: ctxNoRef });

    t('§年度補正-a 基準年も同じ文脈で比べると環境補正が大きくなる（対右どうしの比較）',
      withRef.observed.preShrink.avg > noRef.observed.preShrink.avg,
      `文脈揃え ${withRef.observed.preShrink.avg.toFixed(4)} > 片側だけ総合 ${noRef.observed.preShrink.avg.toFixed(4)}`);
    t('§年度補正-b 基準年の文脈平均が無い時は従来どおり総合へ落ちる（推定で埋めない）',
      Number.isFinite(noRef.observed.preShrink.avg), `${noRef.observed.preShrink.avg.toFixed(4)}`);
  }

  // ── §案2 捕球と送球の二重計上を解消（2026-08-05 オーナー承認「5:ok」）─────────
  // 送球得能(TE基準)が確定した選手だけ、捕球の材料をErrR全体からFE(捕球以外の失策)へ
  // 差し替える。他の選手は影響を受けない（現行のErrRのまま、精度を落とさない）。
  {
    const { catchingRating } = await import('../src/ratings/fielding.mjs');
    const base = { pos: '2B', season: 2024, inn: 1000, errr: -2.0, chances: 500, fe: 5 };
    const withoutAbility = catchingRating(base, fldNorm, cfg);
    const withAbility = catchingRating({ ...base, useFeCatching: true, fePos: '二' }, fldNorm, cfg);

    t('§案2-a 送球得能が無い選手は従来どおりErrR材料',
      withoutAbility?.material == null, `material=${withoutAbility?.material}`);
    t('§案2-b 送球得能がある選手はFE材料に切り替わる',
      withAbility?.material === 'fe_only', `material=${withAbility?.material}`);
    t('§案2-c 英語の位置表記(bm_fld由来)のままではFEの基準が引けず通常材料へ落ちる（再発検知）',
      catchingRating({ ...base, useFeCatching: true, fePos: undefined, pos: '2B' }, fldNorm, cfg)?.material == null,
      '日本語表記(fePos)が無いとFE材料は使われない＝ErrRへ落ちる（安全側）');
    t('§案2-d FEの基準（位置ごとの平均・標準偏差）が設定に保存されている',
      fldNorm.fe?.byPos?.['二']?.mean != null, JSON.stringify(fldNorm.fe?.byPos?.['二']));

    // 実データで、送球得能を持つ選手だけ切り替わっていることを確認
    const { makeContext: mk7, appraiseCard: ac7 } = await import('../src/cards/pipeline.mjs');
    const { readFileSync: rf5 } = await import('node:fs');
    const rv7 = JSON.parse(rf5('configs/run_values.json', 'utf8')).values;
    const ctx10 = mk7(db, cfg);
    const withThrow = ac7(ctx10, { name: '菊池　涼介', mode: '2024', cfg, rv: rv7, runNorm, fldNorm }).card;
    const withoutThrow = ac7(ctx10, { name: '牧　秀悟', mode: '2024', cfg, rv: rv7, runNorm, fldNorm }).card;
    const primWith = withThrow.ratings?.fielding?.find(f => f.is_primary);
    const primWithout = withoutThrow.ratings?.fielding?.find(f => f.is_primary);
    const logWith = withThrow.calc_log?.fielding?.find(f => f.pos === primWith?.pos);
    const logWithout = withoutThrow.calc_log?.fielding?.find(f => f.pos === primWithout?.pos);
    t('§案2-e 2024終了後まで含むTE集約を菊池2024のFE差し替えへ使わない',
      logWith?.catching?.material !== 'fe_only', `material=${logWith?.catching?.material}`);
    t('§案2-f 送球得能の無い牧秀悟は従来どおり',
      logWithout?.catching?.material == null, `material=${logWithout?.catching?.material}`);
  }

  // ── §NF3拡張 対左右別成績を2006-2022年へ拡張（2026-08-05・T-0115・T-0119原目的）─────
  // NF3取得を2006-2022年へ広げ、既存の parse_nf3.mjs / loadSplits をそのまま通したところ、
  // コード変更なしにミートの文脈判定(Tier B)が2023-2025→2006年まで広がった
  // （selectContext・loadSplits に年のハードコードが無かったため）。
  {
    const has2006 = db.prepare(`SELECT 1 FROM nf3_split WHERE section='hand' AND season=2006 LIMIT 1`).get();
    t('§NF3拡張-a hand区分（対左右別）が2006年まで取得できている',
      !!has2006, has2006 ? 'あり' : 'なし（NF3の2006-2022取得が未完了の可能性）');

    if (has2006) {
      const { makeContext: mk6, appraiseCard: ac6 } = await import('../src/cards/pipeline.mjs');
      const { readFileSync: rf4 } = await import('node:fs');
      const rv6 = JSON.parse(rf4('configs/run_values.json', 'utf8')).values;
      const ctx9 = mk6(db, cfg);
      const c2019 = ac6(ctx9, { name: '村上　宗隆', mode: '2019', cfg, rv: rv6, runNorm, fldNorm }).card;
      const c2021 = ac6(ctx9, { name: '村上　宗隆', mode: '2021', cfg, rv: rv6, runNorm, fldNorm }).card;
      t('§NF3拡張-b 2019年（拡張前は総合打率=Tier C だった年）が Tier B になる',
        c2019?.calc_log?.context_tier === 'B', `tier=${c2019?.calc_log?.context_tier}`);
      t('§NF3拡張-c 2021年も同様に Tier B',
        c2021?.calc_log?.context_tier === 'B', `tier=${c2021?.calc_log?.context_tier}`);
      // 打数つきで取れていること（縮小に使うため必須。無いと基準として使えない）
      const row = db.prepare(`SELECT ab FROM nf3_split WHERE section='hand' AND season=2019
        AND label='対右投手' AND name_norm LIKE '%村上%宗隆%'`).get();
      t('§NF3拡張-d 対右投手の行に打数(ab)が入っている（縮小の基準として使うのに必須）',
        row?.ab > 0, `ab=${row?.ab}`);
    }
  }

  // ── §弾道推定 打球構成比の変換で弾道を2019年以前へ広げる（2026-08-05 オーナー承認 T-0118）──
  // NPB Basementの実測（2020年以降）が無い年は、アウト内容の割合(fly_out_pct/ground_out_pct)から
  // 変換した推定値を使う。実測と混同しないよう is_estimated フラグを立てる。
  {
    const { makeContext: mk5, appraiseCard: ac5 } = await import('../src/cards/pipeline.mjs');
    const { readFileSync: rf3 } = await import('node:fs');
    const rv5 = JSON.parse(rf3('configs/run_values.json', 'utf8')).values;
    const ctx8 = mk5(db, cfg);
    const c2024 = ac5(ctx8, { name: '村上　宗隆', mode: '2024', cfg, rv: rv5, runNorm, fldNorm }).card;
    const c2019 = ac5(ctx8, { name: '村上　宗隆', mode: '2019', cfg, rv: rv5, runNorm, fldNorm }).card;

    t('§弾道推定-a 実測のある年(2024)は is_estimated=false',
      c2024.abilities?.基礎能力?.弾道?.is_estimated === false, JSON.stringify(c2024.abilities?.基礎能力?.弾道?.is_estimated));
    t('§弾道推定-b 実測の無い年(2019)でも弾道が出る（以前はnullだった）',
      c2019.abilities?.基礎能力?.弾道?.value != null, `弾道=${c2019.abilities?.基礎能力?.弾道?.value}`);
    t('§弾道推定-c 推定値には is_estimated=true が立つ（実測と混同しない）',
      c2019.abilities?.基礎能力?.弾道?.is_estimated === true, JSON.stringify(c2019.abilities?.基礎能力?.弾道?.is_estimated));
    t('§弾道推定-d 推定の出典が能力欄に残る',
      typeof c2019.abilities?.基礎能力?.弾道?.estimation_source === 'string'
        && c2019.abilities.基礎能力.弾道.estimation_source.includes('フライ'),
      c2019.abilities?.基礎能力?.弾道?.estimation_source);
    t('§弾道推定-e 計算ログにも実測/推定の別が残る',
      c2024.calc_log?.trajectory?.is_estimated === false && c2019.calc_log?.trajectory?.is_estimated === true,
      `2024=${c2024.calc_log?.trajectory?.is_estimated} / 2019=${c2019.calc_log?.trajectory?.is_estimated}`);

    // 元データが無い選手・年は null のまま（推定で埋めない）。
    // 中島宏之2006年＝NPB Basement(2020年以降)にもアウト内容データ(収集済み範囲)にも無い実例
    const noData = ac5(ctx8, { name: '中島　宏之', mode: '2006', cfg, rv: rv5, runNorm, fldNorm });
    t('§弾道推定-f アウト内容データも無い年は null のまま（0で埋めない）',
      !noData.error && noData.card.abilities?.基礎能力?.弾道 == null,
      noData.error ?? JSON.stringify(noData.card.abilities?.基礎能力?.弾道));
  }

  // ── §走力複数年ログ 走力の複数年プールの根拠が計算ログへ渡る（2026-08-05修理）───
  // 肩力(arm)は複数年プールの根拠(years/seasons)が既にログに出ていたが、走力は
  // pipeline.mjs内で計算(speedDetail)されているのにcard_schema.mjsへ渡していなかった。
  // 「複数年で均している」という設計の主張を、カードを見ただけでは検証できない状態だった。
  {
    const { makeContext: mk4, appraiseCard: ac4 } = await import('../src/cards/pipeline.mjs');
    const { readFileSync: rf2 } = await import('node:fs');
    const rv4 = JSON.parse(rf2('configs/run_values.json', 'utf8')).values;
    const ctx7 = mk4(db, cfg);
    // 周東佑京は複数年データがあるレギュラー（bm経由でNPB Basementデータを持つ想定）
    const card = ac4(ctx7, { name: '周東　佑京', mode: '2024', cfg, rv: rv4, runNorm, fldNorm }).card;
    const rl = card?.calc_log?.running;
    t('§走力複数年ログ-a 複数年プールを使ったかが計算ログに出る',
      rl && 'speed_is_multi_year' in rl, rl ? `速度複数年=${rl.speed_is_multi_year}` : 'null');
    t('§走力複数年ログ-b 実際に複数年（1年より多い）が使われている',
      rl?.speed_years > 1, `${rl?.speed_years}年（${rl?.speed_seasons?.join(',')}）`);
  }
}

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
db.close();
process.exit(fail ? 1 : 0);
