// SP-032 / SP-036 / SP-037 — 統合済みcommunity rawを受入基準に対して評価する。
//
// 収集そのものは run2 で実施済み（Hub側→canonへ統合、statusは未移植）。
// ここでは **収集物が要件を満たしているか** を独立に検査する。
// 「件数が揃っている」ことを合格根拠にしない（実データの中身を見る）。
//
// 対象要件:
//   SR-015 (SP-032) 旧Grok-Xでゲーム査定を理由に棄却した候補をRating Consensusとして再分類
//   SR-019 (SP-036) genericな俊足/鈍足等を0情報にせず弱い方向証拠として保持
//   SR-020 (SP-037) 同一場面の多数反応を独立票として水増しせずreaction volumeを別保存
//
// 使い方: node scripts/sp032_036_037_community_raw_evaluation.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = readFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_community_rating_raw_20260813_run2.jsonl'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));

const findings = [];
const add = (id, severity, req, summary, detail) => findings.push({ id, severity, requirement: req, summary, detail });

// ── 0. スキーマの一貫性（これが崩れていると以降の集計が全部ずれる） ──────────
const laneVals = {}, classVals = {};
for (const r of rows) {
  laneVals[String(r.physical_or_rating_lane)] = (laneVals[String(r.physical_or_rating_lane)] ?? 0) + 1;
  classVals[String(r.classification)] = (classVals[String(r.classification)] ?? 0) + 1;
}
const laneCaseDup = Object.keys(laneVals).filter(k => Object.keys(laneVals).some(o => o !== k && o.toLowerCase() === k.toLowerCase()));
if (laneCaseDup.length) {
  add('C-01', 'BLOCK', 'schema', '`physical_or_rating_lane` に大文字小文字違いの同義値が混在',
    `値と件数: ${JSON.stringify(laneVals)}。lane別に数えると同じ意味の値が別物として二重に数えられる`);
}
const classArrayLike = Object.keys(classVals).filter(k => k.trim().startsWith('['));
if (classArrayLike.length) {
  add('C-02', 'BLOCK', 'schema', '`classification` が「文字列」と「JSON配列を文字列化したもの」の2形式で混在',
    `配列形式の値: ${JSON.stringify(classArrayLike)} 合計${classArrayLike.reduce((s, k) => s + classVals[k], 0)}件。` +
    `分類で絞り込むと配列形式の行が漏れる`);
}

// ── 1. SR-015 / SP-032: 旧rejected 150件の再分類 ───────────────────────
const RECLASS = ['RECLASSIFIED_TO_RATING_LANE', 'RECLASSIFIED_TO_WEAK_CONTEXT_LANE',
  'NOT_RECLASSIFIABLE_INSUFFICIENT', 'NOT_RECLASSIFIABLE_PLAYER_IDENTITY', 'NOT_RECLASSIFIABLE_IDENTITY_CONFLICT',
  'RETAINED_NOT_DIRECTIONAL', 'RETAINED_DUPLICATE_NOT_INDEPENDENT', 'RETAINED_REPOST_NOT_INDEPENDENT'];
const reclassRows = rows.filter(r => RECLASS.includes(r.reclassification_status));
const byStatus = {};
for (const r of reclassRows) byStatus[r.reclassification_status] = (byStatus[r.reclassification_status] ?? 0) + 1;
if (reclassRows.length !== 150) {
  add('C-03', 'MAJOR', 'SR-015', `再分類対象が150件でなく${reclassRows.length}件`,
    JSON.stringify(byStatus));
}
// 各行に判定理由があるか（「理由なく落とした」を検出）
const noReason = reclassRows.filter(r => !String(r.acceptance_reason ?? r.old_rejection_reason ?? '').trim());
if (noReason.length) {
  add('C-04', 'MAJOR', 'SR-015', `再分類行のうち${noReason.length}件に判定理由が無い`,
    '理由欄が空だと、後から採否の当否を検証できない');
}

// ── 2. SR-019 / SP-036: weak generic label が 0情報化されていないか ────────
const weak = rows.filter(r => r.acceptance_status === 'ACCEPTED_WEAK_DIRECTIONAL_CONTEXT');
const weakNoDirection = weak.filter(r => {
  const c = String(r.classification);
  return !/FAST|SLOW/i.test(c);
});
if (weakNoDirection.length) {
  add('C-05', 'MAJOR', 'SR-019', `weak directional として採用された${weak.length}件のうち${weakNoDirection.length}件に方向(FAST/SLOW)が無い`,
    '「弱い方向証拠」として保持する要件なのに方向が入っていなければ、実質0情報と同じ');
}
// weakが数値走力へ化けていないか
const weakWithNumeric = weak.filter(r => r.target_rating_if_explicit != null && String(r.target_rating_if_explicit).trim() !== '');
if (weakWithNumeric.length) {
  add('C-06', 'BLOCK', 'SR-019', `weak context ${weakWithNumeric.length}件に数値rating値が入っている`,
    'weakは数値走力・独立票・strict consensusを生成してはならない');
}

// ── 3. SR-020 / SP-037: 同一場面の重複を独立票にしていないか ───────────────
const withEvent = rows.filter(r => r.event_id != null && String(r.event_id).trim() !== '');
const eventGroups = new Map();
for (const r of withEvent) {
  const k = String(r.event_id);
  if (!eventGroups.has(k)) eventGroups.set(k, []);
  eventGroups.get(k).push(r);
}
const multi = [...eventGroups.entries()].filter(([, v]) => v.length > 1);
// 同一eventの中で、独立originとして数えられている行が複数ないか
const overcounted = [];
for (const [eid, grp] of multi) {
  const accepted = grp.filter(r => String(r.acceptance_status).startsWith('ACCEPTED'));
  const groups = new Set(accepted.map(r => String(r.independence_group)));
  if (accepted.length > 1 && groups.size > 1) overcounted.push({ event_id: eid, accepted: accepted.length, distinct_groups: groups.size });
}
if (overcounted.length) {
  add('C-07', 'BLOCK', 'SR-020', `同一event内で採用行が複数の独立originとして数えられている: ${overcounted.length}件`,
    JSON.stringify(overcounted.slice(0, 5)));
}
const noEvent = rows.filter(r => (r.event_id == null || String(r.event_id).trim() === ''));
if (noEvent.length) {
  add('C-08', 'MINOR', 'SR-020', `event_id が無い行が${noEvent.length}件`,
    'event_idが無い行は同一場面かどうかを機械判定できない。reaction volumeの分離が保証されない範囲');
}
// reaction volume が独立票と別フィールドに分かれているか
const volFields = ['comment_count', 'like_sum', 'top_like_count', 'agreement_ratio', 'origin_count'];
const haveVol = volFields.filter(f => rows.some(r => r[f] != null && String(r[f]).trim() !== ''));
if (haveVol.length === 0) {
  add('C-09', 'BLOCK', 'SR-020', 'reaction volume を保持するフィールドが実データに1つも埋まっていない',
    `対象フィールド: ${volFields.join(',')}`);
}

// ── 4. coverage / 範囲外の明示（negative finding と取得不能の分離） ──────────
const notFound = rows.filter(r => r.acceptance_status === 'NOT_FOUND').length;
const insufficient = rows.filter(r => r.acceptance_status === 'INSUFFICIENT').length;

const out = {
  generated_at: '2026-08-13',
  scope: 'run2で収集しcanonへ統合したcommunity raw(473行)を、SP-032/036/037の受入基準に対して独立評価',
  row_total: rows.length,
  schema_value_counts: { physical_or_rating_lane: laneVals, classification: classVals },
  sr015_reclassification: { rows: reclassRows.length, by_status: byStatus },
  sr019_weak_directional: { accepted_weak: weak.length, without_direction: weakNoDirection.length, with_numeric_rating: weakWithNumeric.length },
  sr020_dedupe: { rows_with_event_id: withEvent.length, multi_row_events: multi.length, overcounted_events: overcounted.length, reaction_volume_fields_present: haveVol },
  uncollected_or_unresolved: { NOT_FOUND: notFound, INSUFFICIENT: insufficient,
    note: 'これらは「証拠が無い」ではなく「取得・特定できていない」。negative findingへ転記しない' },
  findings,
  verdict: findings.some(f => f.severity === 'BLOCK') ? 'BLOCK（受入不可。修理してから再評価）'
    : findings.length ? 'CONDITIONAL（受入可だが要修正）' : 'PASS',
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp032_036_037_community_raw_evaluation.json'), JSON.stringify(out, null, 2));

console.log(`rows=${rows.length}  verdict=${out.verdict}\n`);
for (const f of findings) console.log(`[${f.severity}] ${f.id} (${f.requirement}) ${f.summary}\n      ${f.detail.slice(0, 160)}`);
console.log(`\n未取得/未特定: NOT_FOUND=${notFound}  INSUFFICIENT=${insufficient}（negative findingへ転記しない）`);
