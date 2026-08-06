// Sol仕様 09_QA_TESTS のうち、得能・二重計上に関わる回帰テスト。
//   Q3  三振の二重減点なし（三振赤特ON時にK%減点と赤特減点を二重適用しない）
//   Q7  チャンス/対左の二重計上なし（Tier Aを使ったらチャンスBを理由に再減点しない）
//   Q11 RBIを変えてもチャンスランクが変わらない（仕様05 §3「RBIを直接使わない」）
//   Q12 金特が自動付与されない（通常のタイトル級だけでは付かない）
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AdjustmentLedger } from '../src/ratings/ledger.mjs';
import { buildMeetLedger, buildPowerLedger, goldSpecialAbilities, strikeoutAbility } from '../src/ratings/special_abilities.mjs';
import { applyEnvironment } from '../src/ratings/from_rates.mjs';
import { shrink } from '../src/ratings/shrinkage.mjs';
import { interp, clamp } from '../src/ratings/scale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); ok ? pass++ : fail++; };

// --- Q3: 三振の二重減点なし ---
{
  const led = buildMeetLedger(60, { contextTier: 'C', infieldHitAbility: null }, cfg);
  const strikeoutEntry = led.adjustments.find(e => e.component === 'strikeout_red_delta');
  check('Q3 三振による基礎ミートの調整が入らない', strikeoutEntry.delta === 0,
    strikeoutEntry.reason);
  // 三振赤特そのものは付く（能力としては表現される）
  const ab = strikeoutAbility(28, cfg);
  check('Q3-b 三振赤特は得能として付与される', ab?.color === 'red', ab ? `${ab.ability}(${ab.color})` : 'なし');
}

// --- Q7: チャンス/対左の二重計上なし ---
{
  const tierA = buildMeetLedger(60, { contextTier: 'A', infieldHitAbility: null }, cfg);
  const chance = tierA.adjustments.find(e => e.component === 'chance_delta');
  check('Q7 Tier Aではチャンスによる基礎ミート再減点なし', chance.delta === 0, chance.reason.slice(0, 60) + '…');
}

// --- 二重計上の検出装置そのものが動くか ---
{
  const led = new AdjustmentLedger('meet', 60);
  led.add('a', -2, { reason: 'テスト', informationSource: 'ground_ball_singles' });
  led.add('b', -3, { reason: 'テスト', informationSource: 'ground_ball_singles' }); // 同じ情報源
  let threw = false;
  try { led.finalize(); } catch { threw = true; }
  check('台帳が同一情報源の二重使用を検出して例外を投げる', threw, '同じ情報を2つの調整に使うとfinalizeで停止');

  const led2 = new AdjustmentLedger('meet', 60);
  led2.add('a', -2, { reason: 'テスト', informationSource: 'x' });
  let threw2 = false;
  try { led2.add('a', -1, { reason: 'テスト2' }); } catch { threw2 = true; }
  check('台帳が同名項目の二重登録を拒否する', threw2);

  const led3 = new AdjustmentLedger('meet', 60);
  let threw3 = false;
  try { led3.add('c', -2, {}); } catch { threw3 = true; }
  check('理由なしの調整を拒否する（仕様03 §4.5 manual_delta には理由必須）', threw3);
}

// --- Q11: RBIはチャンス査定に使わない（そもそも入力に無いことを構造で保証） ---
{
  const ctxA = { contextTier: 'C', infieldHitAbility: null, RBI: 30 };
  const ctxB = { contextTier: 'C', infieldHitAbility: null, RBI: 120 };
  const a = buildMeetLedger(60, ctxA, cfg), b = buildMeetLedger(60, ctxB, cfg);
  check('Q11 RBIを変えても査定結果が変わらない', a.final === b.final,
    `RBI30→${a.final.toFixed(1)} / RBI120→${b.final.toFixed(1)}（仕様05 §3「RBIを直接使わない」）`);
}

// --- Q12: 金特は歴史的水準のみ ---
{
  const historical = { hrPer500: { p995: 52.0, p999: 58.0 }, avgEnv: { p995: 0.352, p999: 0.365 } };
  // タイトル級（本塁打王クラス）でも歴代上位0.5%に届かなければ付かない
  const titleLevel = goldSpecialAbilities({ hrPer500: 44.0, avgEnv: 0.320 }, historical, cfg);
  check('Q12 タイトル級（換算44本・打率.320）では金特が付かない', titleLevel.length === 0,
    `付与数${titleLevel.length}`);
  // 歴代級なら付く
  const historic = goldSpecialAbilities({ hrPer500: 56.0, avgEnv: 0.320 }, historical, cfg);
  check('Q12-b 歴代上位0.5%級（換算56本）なら金特が付く', historic.length === 1,
    historic[0]?.basis ?? 'なし');
}

// --- 得能付与Phase3b（2026-08-04）: チャンス・対左を基礎能力へ反映 ---
{
  const env = { lgAvg: 0.250, lgHrRate: 0.028, refAvg: 0.243, refHrRate: 0.021 };
  const prior = { avg: 0.250, hr: 0.024 };
  const AB = 500;
  const rawTotalAvg = 0.270, rawHrPerAb = 0.066;

  // baseline はテストの都合の定数ではなく、baseline側もrawTotalAvg/rawHrPerAbと
  // 「全く同じ経路」（appraiseBattingが実際に通す env補正→shrink→interp）を通した値にする。
  // そうしないと delta が「調整の効果」ではなく「テストの作り物の不整合」を測ってしまう
  // （2026-08-04 に一度この間違いを踏んで3件FAILし、本コメントとして記録）
  const meetBaseline = clamp(interp(cfg.meet_anchors.points,
    shrink(applyEnvironment(rawTotalAvg, env.lgAvg, env.refAvg, cfg.environment.gamma_avg), AB, prior.avg, cfg.shrinkage.kappa_meet)), cfg.clamp);
  const powerBaseline = clamp(interp(cfg.power_anchors.points,
    shrink(applyEnvironment(rawHrPerAb, env.lgHrRate, env.refHrRate, 0.91), AB, prior.hr, cfg.shrinkage.kappa_power) * cfg.ab_ref.value), cfg.clamp);

  const baseCtx = { contextTier: 'C', infieldHitAbility: null, rawTotalAvg, env, prior, AB };

  // 得能が平均より多い（プラスの差分）→ 基礎能力を下げる（仕様05 §2）
  const posClutch = { diff: 0.040, weight: 0.3, reliability: 0.5, rispAb: 150 };
  const ledPos = buildMeetLedger(meetBaseline, { ...baseCtx, clutch: posClutch, platoon: null }, cfg);
  const chancePos = ledPos.adjustments.find(e => e.component === 'chance_delta');
  check('Phase3b チャンスが平均より多いと基礎ミートが下がる', chancePos.delta < 0, `delta=${chancePos.delta.toFixed(2)}`);

  // 得能が平均より少ない（マイナスの差分）→ 基礎能力を上げる
  const negClutch = { diff: -0.040, weight: 0.3, reliability: 0.5, rispAb: 150 };
  const ledNeg = buildMeetLedger(meetBaseline, { ...baseCtx, clutch: negClutch, platoon: null }, cfg);
  const chanceNeg = ledNeg.adjustments.find(e => e.component === 'chance_delta');
  check('Phase3b チャンスが平均より少ないと基礎ミートが上がる', chanceNeg.delta > 0, `delta=${chanceNeg.delta.toFixed(2)}`);

  // 符号が逆なら delta も逆符号（対称性）
  check('Phase3b チャンスの符号を反転するとdeltaも反転する（対称性）',
    Math.sign(chancePos.delta) === -Math.sign(chanceNeg.delta), `pos=${chancePos.delta.toFixed(2)} neg=${chanceNeg.delta.toFixed(2)}`);

  // 対左のミート差も同じ向き
  const posPlatoon = { meetDiff: 0.050, weight: 0.35, reliability: 0.46, vsLAb: 173, hrRateDiff: null };
  const ledPlatoon = buildMeetLedger(meetBaseline, { ...baseCtx, clutch: null, platoon: posPlatoon }, cfg);
  const vsLeft = ledPlatoon.adjustments.find(e => e.component === 'vs_left_delta');
  check('Phase3b 対左ミート差が平均より多いと基礎ミートが下がる', vsLeft.delta < 0, `delta=${vsLeft.delta.toFixed(2)}`);

  // --- パワー側の対左反映は「既定で無効」。無効であること自体を固定する ---
  // 2026-08-04に実装したが同日に見送った。根拠＝対左右の本塁打率差は観測の92.4%が雑音で、
  // 本塁打はまれな事象のため対左およそ118打数では左右差を測れない（測れないものを能力に足さない）。
  // ※当初はパワプロとの誤差を根拠に挙げたが、KONAMI比較は参考チェックへの格下げ・凍結後比較が
  //   決まっているためオーナー指摘で撤回した。採否の物差しは configs の
  //   special_abilities.base_reflection._judging_criterion が正本
  const powerCtx = { rawHrPerAb, env, prior, gammaUsed: 0.91, AB };
  const weakVsL = { hrRateDiff: -0.030, weight: 0.35, reliability: 0.46, vsLAb: 173, reason: null };
  const strongVsL = { hrRateDiff: 0.030, weight: 0.35, reliability: 0.46, vsLAb: 173, reason: null };

  const ledPowerDefault = buildPowerLedger(powerBaseline, { ...powerCtx, platoon: weakVsL }, cfg);
  const defaultEntry = ledPowerDefault.adjustments.find(e => e.component === 'platoon_power_delta');
  check('Phase3b-gate パワーの対左反映は既定で無効（基礎パワーを動かさない）',
    defaultEntry.delta === 0 && ledPowerDefault.final === powerBaseline,
    `delta=${defaultEntry.delta} final=${ledPowerDefault.final.toFixed(1)}（=baseline ${powerBaseline.toFixed(1)}）`);
  check('Phase3b-gate 無効の理由が台帳に残る（黙って消さない）',
    /雑音|見送|反映しない/.test(defaultEntry.reason ?? ''), (defaultEntry.reason ?? '').slice(0, 40) + '…');
  check('Phase3b-gate 設定値が意図どおりfalse',
    cfg.special_abilities.base_reflection.power_from_platoon.enabled === false
    && !!cfg.special_abilities.base_reflection.power_from_platoon._why_disabled,
    '根拠つきで無効化されている');

  // 再開できる状態を保つ: 有効化した時に機構が正しく動くことは引き続き検査する
  // （無効化したまま実装が腐ると、再開条件を満たした時に気づけない）
  const cfgOn = JSON.parse(JSON.stringify(cfg));
  cfgOn.special_abilities.base_reflection.power_from_platoon.enabled = true;
  const ledPowerWeak = buildPowerLedger(powerBaseline, { ...powerCtx, platoon: weakVsL }, cfgOn);
  const platoonPowerWeak = ledPowerWeak.adjustments.find(e => e.component === 'platoon_power_delta');
  check('Phase3b 有効化時: 対左のHR率が対右より低いと基礎パワーは上がる', platoonPowerWeak.delta > 0, `delta=${platoonPowerWeak.delta.toFixed(2)}`);

  const ledPowerStrong = buildPowerLedger(powerBaseline, { ...powerCtx, platoon: strongVsL }, cfgOn);
  const platoonPowerStrong = ledPowerStrong.adjustments.find(e => e.component === 'platoon_power_delta');
  check('Phase3b 有効化時: 対左のHR率が対右より高いと基礎パワーは下がる', platoonPowerStrong.delta < 0, `delta=${platoonPowerStrong.delta.toFixed(2)}`);

  // アンカー表の単位を取り違えると暴走する（過去に実際に踏んだバグ: hrPerAbをhrPer500用アンカーへ
  // そのまま渡し、baseline94→final25という65点超の異常値が出た）。二度と混入しないことを保証する
  check('Phase3b パワーのアンカー単位ミス再発防止（|delta|が現実的な範囲に収まる）',
    Math.abs(platoonPowerWeak.delta) < 20 && Math.abs(platoonPowerStrong.delta) < 20,
    `weak=${platoonPowerWeak.delta.toFixed(2)} strong=${platoonPowerStrong.delta.toFixed(2)}（基準: 実データ108人の最大観測値は6.21）`);

  // データ不足時は調整なしで安全にskipする（クラッシュしない）
  const ledMissing = buildMeetLedger(meetBaseline, { contextTier: 'C', infieldHitAbility: null, rawTotalAvg: null, env, prior, AB, clutch: null, platoon: null }, cfg);
  check('Phase3b rawTotalAvg欠落時はチャンス・対左とも調整なし（クラッシュしない）',
    ledMissing.adjustments.find(e => e.component === 'chance_delta').delta === 0 &&
    ledMissing.adjustments.find(e => e.component === 'vs_left_delta').delta === 0);

  const ledPowerMissing = buildPowerLedger(powerBaseline, { rawHrPerAb: null, env, prior, gammaUsed: null, AB, platoon: null }, cfg);
  check('Phase3b rawHrPerAb欠落時はパワー調整なし（クラッシュしない）',
    ledPowerMissing.adjustments.find(e => e.component === 'platoon_power_delta').delta === 0);

  // 対左情報源はミートとパワー両方の台帳で使うが、別能力の別台帳なので二重計上の検出には引っかからない
  const meetWithPlatoon = buildMeetLedger(meetBaseline, { ...baseCtx, clutch: null, platoon: posPlatoon }, cfg);
  const powerWithPlatoon = buildPowerLedger(powerBaseline, { ...powerCtx, platoon: weakVsL }, cfg);
  check('Phase3b 同じ対左情報源をミート・パワー両方で使っても二重計上例外にならない（別能力の別台帳）',
    meetWithPlatoon.final != null && powerWithPlatoon.final != null);
}

// --- 台帳の表示（仕様§15「途中式を省略しない」） ---
console.log('\n--- 台帳の出力例（Tier C・内野安打○あり） ---');
const sample = buildMeetLedger(58.3, {
  contextTier: 'C',
  infieldHitAbility: { basis: 'ゴロ単打の超過4.2% のうち走力説明分1.8%を除いた残差2.4%' },
}, cfg);
console.log(AdjustmentLedger.render(sample));

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
