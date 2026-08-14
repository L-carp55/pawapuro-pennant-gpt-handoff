// NPB_ENTERPRISE_TRACKING_ARTICLE レーンの評価（2026-08-14）
//
// ■ 何をするか
//   owner が保存した2026-08-10 DATA SPOTLIGHT 記事を、NPB+ アプリ画面レーンとは**別の provenance**
//   として評価する。この記事から作ってよいものと作ってはいけないものを、機械で区別して出す。
//
// ■ 作ってはいけないもの（母集団が選択標本のため）
//   標本は「二塁盗塁の**成功**」かつ「タイム上位50件」に条件づけられている。したがって
//   全選手向けの測定信頼性・汎用の重み・「上位50に居ない＝遅い」の判定は**原理的に作れない**。
//   ここでは NOT_IDENTIFIABLE を明示して残し、数値を作らない。
//
// ■ 作ってよいもの
//   周東佑京**個人**について、同一シーズン内で event 単位の最高速度が繰り返し最上位に出たこと。
//   これは NPB+ アプリの単一値が「たまたま出た1回」ではないことの独立な裏づけになる。
//   出力は confidence の文脈フラグであって、点数でも重みでもない。
//
// 使い方: node scripts/sp100_npb_enterprise_article_lane.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const art = JSON.parse(readFileSync(path.join(ROOT, 'data', 'manual', 'npb_enterprise_tracking_article_20260810.json'), 'utf8'));
const latent = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp100_npb_raw_latent_speed.json'), 'utf8'));

// fail closed: レーンを取り違えて NPB+ アプリ側と混ぜないこと
if (art.provenance_lane !== 'NPB_ENTERPRISE_TRACKING_ARTICLE') {
  throw new Error('provenance lane が想定と違う。アプリ画面レーンと混ぜてはならない');
}
if (!latent.players?.some(p => p.npb_top_speed_z != null)) {
  throw new Error('[fail closed] SP-100 v2 の出力が要る（旧版の latent_speed_z は汚染済み）');
}

const f = art.facts;
const SHUTO = '周東 佑京';
const shutoApp = latent.players.find(p => nk(p.player) === nk(SHUTO)) ?? null;

// ── アプリ側での本人の位置（記事とは独立に計算） ──────────────────
const zs = latent.players.map(p => p.npb_top_speed_z).filter(x => x != null).sort((a, b) => a - b);
const appRank = shutoApp == null ? null
  : zs.filter(x => x < shutoApp.npb_top_speed_z).length + 1;

// ── 記事側の反復性（本人限定・母集団推定はしない） ───────────────
const repeat = {
  events_in_top50: f.shuto_appearances_in_top50,
  next_highest_player_events: f.next_highest_player_appearances,
  events_at_or_above_threshold: f.events_at_or_above_9_17_mps,
  share_of_extreme_events: +(f.events_at_or_above_9_17_mps.shuto / f.events_at_or_above_9_17_mps.total).toFixed(4),
  max_speed_reached_times: f.shuto_events_at_max,
  max_kmh: f.shuto_sprint_speed_max_kmh,
  gap_vs_non_shuto_mean_kmh: +(f.shuto_sprint_speed_max_kmh - f.non_shuto_mean_sprint_speed_kmh).toFixed(3),
  lead_shorter_than_peers_m: +(f.non_shuto_lead_mean_m - f.shuto_lead_mean_m).toFixed(3),
};

// ── できないことを、できない理由つきで残す ─────────────────────
const cannot = {
  population_measurement_reliability: {
    verdict: 'NOT_IDENTIFIABLE',
    value: null,
    why: [
      '標本が「成功した二塁盗塁」かつ「タイム上位50件」に条件づけられている（打ち切り標本）',
      '同一選手の反復が観測されるのは、速い成功盗塁を多く生む選手に偏る＝出現自体が結果に依存する',
      '上位50件に居ない選手の観測が存在しないため、母集団の分散も測定誤差も推定できない',
    ],
    _do_not: '出現回数8回や 9.24/9.17 m/s の閾値を、全選手共通の信頼性係数へ変換しない',
  },
  steal_time_as_speed_teacher: {
    verdict: 'REJECTED',
    why: '記事自身が「同じタイムでもリード・スタート・加速・走速度の組合せが異なりうる」と明記。'
      + '二盗タイムは純粋な足の速さの計測ではない',
  },
  absence_means_slow: {
    verdict: 'REJECTED',
    why: '上位50件に居ないことは、遅いことでも、盗塁機会が無かったことでもありうる（識別できない）',
  },
  merge_into_pinch_runner_lane: {
    verdict: 'REJECTED',
    why: 'SP-061 は代走起用の文脈レーン。本記事は代走の証拠ではない（合流させない）',
  },
};

// ── 唯一の正当な産物: 本人限定の反復性フラグ ────────────────────
const playerFlags = [];
if (shutoApp) {
  playerFlags.push({
    player: SHUTO,
    player_id: shutoApp.player_id ?? null,
    lane: 'NPB_ENTERPRISE_TRACKING_ARTICLE',
    flag: 'WITHIN_SEASON_REPEATED_ELITE_MAX_SPEED',
    is_weight: false,
    is_rating: false,
    _what_it_means: '同一シーズン内で event 単位の最高速度が繰り返し集団最上位に到達している。'
      + 'NPB+ アプリの単一値が単発の外れ値である可能性を下げる。点数にも重みにもしない。',
    app_lane: {
      top_speed_kmh: shutoApp.top_speed_kmh,
      npb_top_speed_z: shutoApp.npb_top_speed_z,
      rank_of: `${appRank} / ${zs.length}`,
      exposure_runs: shutoApp.exposure_runs,
    },
    article_lane: repeat,
    consistency_check: {
      app_max_kmh: shutoApp.top_speed_kmh,
      article_max_kmh: f.shuto_sprint_speed_max_kmh,
      article_below_app: f.shuto_sprint_speed_max_kmh < shutoApp.top_speed_kmh,
      reading: '記事の最大値がアプリ値を下回るのは、記事が制限された event 集合の観測だから、で説明がつく。'
        + '集計規則が同一である証拠は無いので、2つを同じ量として平均したり差を誤差として読んだりしない。',
    },
  });
}

const out = {
  generated_at: '2026-08-14',
  lane: 'NPB_ENTERPRISE_TRACKING_ARTICLE',
  separate_from: 'NPB+ app/player-screen lane（data/manual/npb_plus_screens.jsonl）',
  evidence_status: 'MEASURED_POSITIVE_PLAYER_SPECIFIC',
  source: art.source,
  selection_bias: art.population._selection_bias,
  what_this_lane_can_support: playerFlags,
  what_this_lane_cannot_support: cannot,
  effect_on_sp100: {
    reliability_verdict_unchanged: 'NOT_IDENTIFIABLE',
    _why: '本記事は選択標本のため、NPB+ の汎用測定信頼性を識別しない。SP-100 v2 の判定を変えない。',
    candidate_n_unchanged: true,
    candidate_f_unchanged: true,
    _only_change: '周東佑京1名について、反復性の文脈フラグが1件付いた（重みでも点数でもない）',
  },
  effect_on_sp022: {
    usable_as: '高位レンジの順序証拠（周東を最上位側に置く根拠の補強）',
    not_usable_as: '1-100への直接変換、pairwise確率の重み',
  },
  n_player_flags: playerFlags.length,
};

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'npb_enterprise_article_lane_20260814.json'),
  JSON.stringify(out, null, 2));

console.log(`lane = ${out.lane}（アプリ画面レーンとは別）`);
console.log(`母集団の測定信頼性: ${cannot.population_measurement_reliability.verdict}（数値を作らない）`);
console.log(`SP-100 への影響: reliability=${out.effect_on_sp100.reliability_verdict_unchanged} / N・F 不変`);
console.log(`個人フラグ: ${playerFlags.length}件`);
for (const p of playerFlags) {
  console.log(`  ${p.player}: アプリ ${p.app_lane.top_speed_kmh}km/h (z=${p.app_lane.npb_top_speed_z}, ${p.app_lane.rank_of})`);
  console.log(`    記事: 上位50件中${p.article_lane.events_in_top50}回登場（次点${p.article_lane.next_highest_player_events}回） / `
    + `9.17m/s以上の${p.article_lane.events_at_or_above_threshold.total}件中${p.article_lane.events_at_or_above_threshold.shuto}件 / `
    + `最高${p.article_lane.max_kmh}km/h を${p.article_lane.max_speed_reached_times}回`);
  console.log(`    リードは同集団平均より ${p.article_lane.lead_shorter_than_peers_m}m 短い（長いリードでの説明が付かない）`);
}
