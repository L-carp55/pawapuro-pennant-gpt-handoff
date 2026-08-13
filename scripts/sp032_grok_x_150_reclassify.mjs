// SP-032 — 旧 Grok-X rejected 150件を全件再分類する。
// 「ゲーム査定への言及だから除外」は禁止。本文がある行は中身で判定する。
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'outputs', 'derived', 'speed_community_rating_raw_20260813_run2.jsonl');
const OUT_JSONL = path.join(ROOT, 'outputs', 'derived', 'sp032_grok_x_150_reclassification_20260813.jsonl');
const OUT_CSV = path.join(ROOT, 'outputs', 'derived', 'sp032_grok_x_150_reclassification_20260813.csv');
const OUT_QA = path.join(ROOT, 'outputs', 'derived', 'sp032_grok_x_150_reclassification_qa_20260813.json');

const BUCKETS = ['RATING_CONSENSUS', 'WEAK_PHYSICAL_OR_CONTEXT', 'NOISE_OR_UNRELATED'];

function loadJsonl(p) {
  return readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}

function textOf(r) {
  return [r.text, r.old_text_excerpt].map(x => String(x ?? '').trim()).filter(Boolean).join('\n');
}

function classify(r) {
  const text = textOf(r);
  const compact = text.replace(/[\s　]+/g, '');
  const old = String(r.old_rejection_reason ?? '');
  const status = String(r.reclassification_status ?? '');
  const duplicate = /DUPLICATE|SAME_EVENT_ORIGIN|REPOST/.test(old) || /DUPLICATE|REPOST/.test(status);

  if (!compact) {
    return {
      bucket: 'NOISE_OR_UNRELATED',
      labels: ['JOKE_OR_NOISE'],
      independence: 'NOT_AN_ORIGIN',
      reason: '投稿本文が台帳に残っていない。証拠が無いのではなくソース不完全。ゲーム査定言及を理由にはしていない。',
    };
  }

  const mentionsGame = /(パワプロ|プロスピ|パワプロアプリ|称号|能力値|査定)/.test(text);
  const ratingLetter = /走力\s*[A-GS0-9Ａ-Ｇ]|走力は[A-GSＡ-Ｇ]|走力[A-GSＡ-Ｇ]/.test(text) || /走力[A-GＡ-Ｇ]/.test(compact);
  const ratingCompare = /(同じ走力|走力同じ|走力の査定|走力に称号)/.test(text);
  const tooHighLow = /(高すぎ|低すぎ|速すぎ|遅すぎ|もっと高|もっと低)/.test(text) && /(走力|査定|能力)/.test(text);

  if (ratingLetter || ratingCompare || tooHighLow || (mentionsGame && /走力/.test(text))) {
    const labels = [];
    if (tooHighLow && /(高すぎ|速すぎ)/.test(text)) labels.push('RATING_TOO_HIGH');
    if (tooHighLow && /(低すぎ|遅すぎ)/.test(text)) labels.push('RATING_TOO_LOW');
    if (ratingLetter || ratingCompare) labels.push('RATING_VALUE_CONTEXT');
    if (!labels.length) labels.push('RATING_VALUE_CONTEXT');
    return {
      bucket: 'RATING_CONSENSUS',
      labels,
      independence: duplicate ? 'DUPLICATE_KEEP_AS_REACTION' : 'ORIGIN',
      reason: mentionsGame
        ? 'ゲーム査定・能力値への言及がある。旧「ゲーム査定だから除外」は使わない。Rating Consensus として保持。'
        : '走力の数値/等級への言及がある。',
    };
  }

  const fast = /(俊足|快足|爆速|足が速|足速|脚が速|脚力|走るの速|走力もある|走力も備|走力を兼|足も速|足の速|爆発的走力|走力はヤバ|肩と走力)/.test(text)
    || /イノシシ並み/.test(text);
  const slow = /(鈍足|足が遅|足遅|脚が遅|足速くない|足が速くない|走力そこそこ)/.test(text);
  const aging = /(衰|落ちた|ピークを過ぎ|昔より|まだ足速|脚力衰)/.test(text) && /(足|脚|走)/.test(text);
  const effort = /全力疾走/.test(text);
  const measurement = /(一塁到達|スプリント|km\/h|50メートル|50m|3\.\d{2})/.test(text);

  if (fast || slow || aging || measurement) {
    const labels = [];
    if (fast && !slow) labels.push('GENERIC_FAST');
    if (slow) labels.push('GENERIC_SLOW');
    if (aging) labels.push('AGING_NOT_REFLECTED');
    if (measurement) labels.push('PLAYER_COMPARISON');
    if (!labels.length) labels.push('UNCLASSIFIED_CONTEXT');
    return {
      bucket: 'WEAK_PHYSICAL_OR_CONTEXT',
      labels,
      independence: duplicate ? 'DUPLICATE_KEEP_AS_REACTION' : 'ORIGIN',
      reason: measurement
        ? '身体測定・到達タイム等の弱い方向証拠。独立物理測定には数えない。'
        : '俊足/鈍足/衰え等の弱い方向証拠。数値教師にはしない。',
    };
  }

  if (effort) {
    return {
      bucket: 'WEAK_PHYSICAL_OR_CONTEXT',
      labels: ['UNCLASSIFIED_CONTEXT'],
      independence: duplicate ? 'DUPLICATE_KEEP_AS_REACTION' : 'ORIGIN',
      reason: '全力疾走の記述。最大努力の観察ではあるが、速さの方向は特定できないので弱い文脈として保持。',
    };
  }

  if (duplicate) {
    return {
      bucket: 'NOISE_OR_UNRELATED',
      labels: ['JOKE_OR_NOISE'],
      independence: 'DUPLICATE_KEEP_AS_REACTION',
      reason: '同一originの重複/転載。本文に独立した走力・査定主張が読めない。',
    };
  }

  return {
    bucket: 'NOISE_OR_UNRELATED',
    labels: ['JOKE_OR_NOISE'],
    independence: 'NOT_AN_ORIGIN',
    reason: '走力の方向もゲーム査定の主張も特定できない。無関係または判定不能。取得不能ではない。',
  };
}

const raw = loadJsonl(RAW);
const rows = raw.filter(r => r.source_type === 'GROK_X_OLD_REJECTED_LEDGER_RECLASSIFICATION');
if (rows.length !== 150) {
  console.error(`expected 150 rejected-ledger rows, got ${rows.length}`);
  process.exit(1);
}

const out = rows.map(r => {
  const decision = classify(r);
  if (!BUCKETS.includes(decision.bucket)) throw new Error(decision.bucket);
  return {
    record_id: r.record_id,
    old_source_id: r.old_source_id ?? null,
    player: r.player,
    canonical_player_id: r.canonical_player_id,
    source_url: r.source_url,
    text: textOf(r),
    old_rejection_reason: r.old_rejection_reason ?? null,
    previous_reclassification_status: r.reclassification_status ?? null,
    bucket: decision.bucket,
    labels: decision.labels,
    independence: decision.independence,
    reason: decision.reason,
    excluded_because_game_rating_mention: false,
    event_id: r.event_id || r.video_id_or_post_id || r.record_id,
    origin_count: decision.independence === 'ORIGIN' ? 1 : 0,
    reaction_volume: 1,
  };
});

const byBucket = {};
for (const r of out) byBucket[r.bucket] = (byBucket[r.bucket] ?? 0) + 1;
const noReason = out.filter(r => !r.reason.trim());
const usedOldBan = out.filter(r => r.excluded_because_game_rating_mention);

const header = [
  'record_id', 'old_source_id', 'player', 'canonical_player_id', 'source_url', 'text',
  'old_rejection_reason', 'previous_reclassification_status', 'bucket', 'labels',
  'independence', 'reason', 'excluded_because_game_rating_mention', 'event_id',
  'origin_count', 'reaction_volume',
];
const csv = [
  header.join(','),
  ...out.map(r => header.map(h => {
    const v = Array.isArray(r[h]) ? r[h].join('|') : r[h];
    return `"${String(v ?? '').replaceAll('"', '""')}"`;
  }).join(',')),
].join('\n');

writeFileSync(OUT_JSONL, out.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(OUT_CSV, csv + '\n');
const qa = {
  generated_at: '2026-08-13',
  input_rows: rows.length,
  classified_rows: out.length,
  by_bucket: byBucket,
  missing_reason: noReason.length,
  excluded_because_game_rating_mention: usedOldBan.length,
  policy: 'GAME_RATING_OR_GAME_DISCUSSION_EXCLUDED is not a valid destination. Game-rating mentions go to RATING_CONSENSUS.',
  verdict: (out.length === 150 && noReason.length === 0 && usedOldBan.length === 0) ? 'PASS' : 'FAIL',
};
writeFileSync(OUT_QA, JSON.stringify(qa, null, 2));
console.log(JSON.stringify(qa, null, 2));
if (qa.verdict !== 'PASS') process.exit(1);
