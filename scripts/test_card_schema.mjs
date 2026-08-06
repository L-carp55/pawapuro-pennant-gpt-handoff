// カードスキーマ・信頼度・計算ログの回帰テスト（Sol仕様03 §2/§7/§8）
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCard, validateCard, assessConfidence, buildCalcLog } from '../src/cards/card_schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));

let pass = 0, fail = 0;
const t = (name, cond, note = '') => {
  if (cond) { pass++; console.log(`PASS  ${name}${note ? '  — ' + note : ''}`); }
  else { fail++; console.log(`FAIL  ${name}${note ? '  — ' + note : ''}`); }
};
const throws = fn => { try { fn(); return false; } catch { return true; } };

console.log('=== カードスキーマ・信頼度・計算ログ ===\n');

const player = { player_id: '01000001', name_ja: 'テスト 選手', team: 'テスト球団', league: 'セ', primary_position: '三', bats: '右', throws: '右', team_games: 143 };
const ratings = { meet: 70, power: 80, contact: 55, eye: 60 };
const conf = assessConfidence({ pa: 600, contextTier: 'C', priorKind: 'self_recent', hasTracking: false, hasFieldingData: true, provisionalCoeffs: 2 });

// --- §2 スキーマ ---
{
  const card = buildCard({ player, cardType: 'peak_single_year', seasonLabel: 2024, seasonsUsed: [2024], ratings, calcLog: {}, confidence: conf });
  t('§2-a 必須フィールドが揃ったカードを作れる', card.player_id === '01000001' && card.card_type === 'peak_single_year');
  t('§2-b ピーク単年は season_label と seasons_used が一致',
    card.season_label === 2024 && card.seasons_used.length === 1, `label=${card.season_label} used=[${card.seasons_used}]`);
}
{
  t('§2-c 必須フィールドが欠けると例外',
    throws(() => buildCard({ player: { ...player, name_ja: null }, cardType: 'peak_single_year', seasonLabel: 2024, seasonsUsed: [2024], ratings, calcLog: {}, confidence: conf })),
    'name_ja欠落で停止');
  t('§2-d 不正な card_type は例外',
    throws(() => validateCard({ player_id: 'x', name_ja: 'y', card_type: 'best_season', seasons_used: [2024], team: 't', league: 'セ', primary_position: '三' })),
    '許可外の型で停止');
}

// --- §3.1 ピーク単年は他年度を混ぜない（スキーマ層でも保証）---
{
  t('§3.1 ピーク単年に複数年を渡すと例外',
    throws(() => buildCard({ player, cardType: 'peak_single_year', seasonLabel: 2024, seasonsUsed: [2023, 2024], ratings, calcLog: {}, confidence: conf })),
    '2年渡すと停止');
  t('§3.1-b ラベルと使用年度の不一致は例外',
    throws(() => buildCard({ player, cardType: 'peak_single_year', seasonLabel: 2023, seasonsUsed: [2024], ratings, calcLog: {}, confidence: conf })));
}

// --- §3.2 合成カード ---
{
  const formula = { method: 'rolling_weighted_posterior', description: '連続3年を打数の重みで合算' };
  const card = buildCard({ player, cardType: 'prime_composite', seasonLabel: 2024, seasonsUsed: [2022, 2023, 2024], ratings, calcLog: {}, confidence: conf, formula });
  t('§3.2-a 合成カードは season_label が強制的に null になる',
    card.season_label === null, `seasonLabel=2024 を渡しても null`);
  t('§3.2-b 合成式が無いと例外',
    throws(() => buildCard({ player, cardType: 'prime_composite', seasonLabel: null, seasonsUsed: [2022, 2023, 2024], ratings, calcLog: {}, confidence: conf })),
    '合成式の公開が必須');
  t('§3.2-c 合成カードに1年しか渡さないと例外',
    throws(() => buildCard({ player, cardType: 'prime_composite', seasonLabel: null, seasonsUsed: [2024], ratings, calcLog: {}, confidence: conf, formula })));
}

// --- §7 信頼度 ---
{
  const best = assessConfidence({ pa: 600, contextTier: 'A', priorKind: 'self_recent', hasTracking: true, hasFieldingData: true, provisionalCoeffs: 0 });
  const worst = assessConfidence({ pa: 80, contextTier: 'C', priorKind: 'league', hasTracking: false, hasFieldingData: false, provisionalCoeffs: 5 });
  t('§7-a 信頼度が5観点＋総合で出る',
    ['sample', 'source_quality', 'context_match', 'prior_quality', 'game_calibration', 'overall'].every(k => best[k]),
    Object.entries(best).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k}:${v}`).join(' '));
  t('§7-b 条件が良いほど総合が高い',
    best.overall < worst.overall || (best.overall === 'A' && worst.overall === 'D'),
    `最良=${best.overall} / 最悪=${worst.overall}`);
  t('§7-c 打席が少ないとサンプル評価が下がる',
    assessConfidence({ pa: 100, contextTier: 'C', priorKind: 'league', hasTracking: false, hasFieldingData: false, provisionalCoeffs: 3 }).sample === 'D',
    '100打席 → D');
  t('§7-d Priorがリーグ平均だとPrior評価が下がる',
    worst.prior_quality === 'D' && best.prior_quality === 'A',
    `本人周辺年=A / リーグ平均=D`);
  t('§7-e 守備データが無い年は注記が出る',
    worst._note != null && best._note === null, worst._note);
}

// --- §8 計算ログ ---
{
  const line = { PA: 600, AB: 520, H: 150, B2: 30, B3: 2, HR: 25, BB: 65, HBP: 5, SO: 100, SH: 0, SF: 5 };
  const bat = {
    meet: 70, power: 80, contact: 55, eye: 60,
    observed: {
      avg: 0.288, hrPer500: 30.1, soRate: 0.167, bbRate: 0.108,
      raw: { avg: 0.2885, hrPer500: 23.6 },
      preShrink: { avg: 0.295, hrPer500: 31.5 },
      envApplied: true, gammaUsed: 0.85, priorKind: 'self_recent', priorBasis: '一軍周辺3年',
    },
  };
  const env = { lgAvg: 0.243, lgHrRate: 0.017, refAvg: 0.251, refHrRate: 0.029 };
  const prior = { kind: 'self_recent', basis: '一軍周辺3年', avg: 0.290, hr: 0.045 };
  const log = buildCalcLog({ line, bat, run: null, fld: null, ledgers: null, env, prior, cfg, contextTier: 'C' });

  t('§8-a 入力・環境・Prior・縮小・ミート・パワーが全部入る',
    log.inputs && log.environment && log.prior && log.shrinkage && log.meat && log.power,
    Object.keys(log).join(', '));
  t('§8-b 環境補正の前後がたどれる',
    log.meat.context_avg === 0.2885 && log.meat.env_avg === 0.295 && log.meat.post_avg === 0.288,
    `生.2885 → 環境補正後.295 → 縮小後.288`);
  t('§8-c パワーも生→環境→縮小の3段が残る',
    log.power.hr_500paeq_raw === 23.6 && log.power.env === 31.5 && log.power.post === 30.1,
    `生23.6本 → 環境補正後31.5本 → 縮小後30.1本`);
  t('§8-d 使われた水準別gammaが記録される',
    log.environment.gamma_hr_used === 0.85, `gamma=${log.environment.gamma_hr_used}`);
  t('§8-e 基準打数が記録される（436.25誤用の再発検知）',
    log.power._ab_ref === cfg.ab_ref.value, `${log.power._ab_ref}打数`);
}

// --- 統合: 実際のカードがJSONとして往復できる ---
{
  const card = buildCard({
    player, cardType: 'peak_single_year', seasonLabel: 2024, seasonsUsed: [2024], ratings,
    calcLog: buildCalcLog({ line: { PA: 600, AB: 520, H: 150, B2: 30, B3: 2, HR: 25, BB: 65, HBP: 5, SO: 100 }, bat: null, run: null, fld: null, ledgers: null, env: null, prior: null, cfg, contextTier: 'C' }),
    confidence: conf, sources: ['プロEYE球'], unresolved: ['内野手の肩は未査定'],
  });
  const round = JSON.parse(JSON.stringify(card));
  t('統合 カードがJSONとして往復できる', validateCard(round) === true, `${Object.keys(card).length}フィールド`);
  t('統合 未解決事項が保持される', round.unresolved.length === 1, round.unresolved[0]);
}

console.log(`\n合計: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
