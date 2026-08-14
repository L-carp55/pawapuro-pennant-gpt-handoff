// Opus Bulk Review — Grok Large Wave の台帳是正（2026-08-14）
//
// ■ なぜ要るか
//   `scripts/_update_registry_large_wave_20260814.mjs` は成果物を一切検査せず、
//   `patch(tasks,'SP-XXX',{status:...})` の羅列で15タスクを DONE 系へ、7除外を closed へ動かした。
//   task の gate_block 列は 1 のままだが、**validator が「gate_block=1 かつ未クローズ」を数える**ため、
//   status を DONE にするだけで gate blockers が 28 → 14 に落ちていた。
//   独立 red-team で、この15件のうち複数が 0レコードの成果物・循環クローズ・
//   未完のsweep に基づくと確定したため、**測定を伴わない前進を巻き戻す**。
//
// ■ このスクリプトの作り（前回との違い）
//   status を決め打ちで書かない。各成果物の **列挙件数を実際に数え**、
//   その数値を根拠欄へ書き込む。判定そのものはレビューの結論だが、数字は計算に由来する。
//
// 使い方: node scripts/opus_largewave_review_remediation_20260814.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const REG = 'docs/state/speed_task_registry.tsv';
const EXCL = 'docs/state/speed_exclusion_reason_ledger.tsv';

function readTsv(rel) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '').trimEnd();
  const lines = raw.split(/\r?\n/);
  const head = lines[0].split('\t');
  return { head, rows: lines.slice(1).filter(Boolean).map(l => {
    const c = l.split('\t');
    return Object.fromEntries(head.map((h, i) => [h, c[i]]));
  }) };
}
function writeTsv(rel, head, rows) {
  const out = [head.join('\t'), ...rows.map(r => head.map(h => r[h] ?? '').join('\t'))].join('\n') + '\n';
  if (!DRY) fs.writeFileSync(path.join(ROOT, rel), out, 'utf8');
}

/** 成果物の列挙件数を実際に数える（存在確認ではなく中身） */
function substance(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return { exists: false, records: null };
  const bytes = fs.statSync(abs).size;
  if (/\.jsonl$/i.test(rel)) {
    return { exists: true, bytes, records: fs.readFileSync(abs, 'utf8').split(/\r?\n/).filter(Boolean).length };
  }
  if (!/\.json$/i.test(rel)) return { exists: true, bytes, records: null };
  let j; try { j = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return { exists: true, bytes, records: null }; }
  let m = 0;
  const walk = (v, d) => {
    if (d > 6 || v == null) return;
    if (Array.isArray(v)) { if (v.length > m) m = v.length; v.slice(0, 50).forEach(x => walk(x, d + 1)); }
    else if (typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], d + 1);
  };
  walk(j, 0);
  return { exists: true, bytes, records: m };
}
const countOf = row => (row.artifacts || '').split(/[;,]/).map(s => s.trim())
  .filter(a => /\.(json|jsonl)$/i.test(a))
  .map(a => ({ a, ...substance(a) }));

// ── レビュー結論（独立 red-team の証拠に基づく差し戻し） ──────────────────
// status は「測定が status を支えているか」で決める。支えていなければ前の状態へ戻す。
const TASK_REVERSALS = [
  ['SP-020', 'PARTIAL', 'exact_dates_found=0 はハードコード定数。日付台帳は100人中34人分のみ。official-profile探索は未完（成果物自身が not_collected と明記）'],
  ['SP-022', 'PARTIAL', '不確かさが定数（0.2下限）で、156ドロー中96件が下限に張り付く＝証拠の質がほぼ効いていない。CLEARLY_SLOWER/LEAN_SLOWER が0なのは焦点リストがFの降順で i<j のみを組むという作り方の帰結（構成上0）'],
  ['SP-036', 'PARTIAL', 'event_id の名前空間不一致（yt:video:X と youtube:X）で独立origin が 7 と出ていたが実体は4件。7件中6件は選手が紐づかず、1件はゲーム挙動のジョーク'],
  ['SP-039', 'PARTIAL', '既存2026-08ファイルの射影のみで新規データ0。17/17 が INCONCLUSIVE のまま negative_finding=false をハードコード。消費先も無い'],
  ['SP-043', 'PARTIAL', '松山は snf/stale とも null で走力証拠ゼロ。community 記述は照合を伴わない断定、peers_same_pattern は low_pa_extremes の先頭8件で「同型」ではない'],
  ['SP-060', 'PARTIAL', '走力scoutingの実データは1件のみ。成果物自身が「Most 2026-100 players have no official scouting row」と明記'],
  ['SP-061', 'PARTIAL', 'sweep が第2ソースを取りこぼし（キー名 source_records を見ずに 0件マッチ、当該785KBファイルに代走17件）。他の3コーパスも未走査'],
  ['SP-062', 'NOT_STARTED', '成果物384バイトが全て文字列リテラルでデータアクセス0。「Broad recollection not opened」＝NOT_COLLECTED を DONE_NEGATIVE_FINDING として記録していた（CLAUDE.md 絶対禁止に該当）'],
  ['SP-063', 'PARTIAL', '手書き10行の対応表で、親タスクの Statcast Baserunning Run Value が未マップ。機械抽出になっていない'],
  ['SP-072', 'NOT_STARTED', '判定が sp016_scale_artifact_check.mjs のハードコード false を読み戻しているだけの循環。SR-037が問う「100人 vs 非100人が同一尺度か」を実際には比較していない（依存ファイル側では 100人 +0.791 / 非100人 -0.433 と逆方向に動いている）'],
  ['SP-074', 'PARTIAL', '検査が構成上必ず通る（S も N も z 値なので平均≈0・双方向は保証される）。閾値|corr|>0.9 は発火しえず実測 -0.595。S=2025 と N=2026 の年ずれを成果物自身が認めたまま閉じている'],
  ['SP-090', 'PARTIAL', '走査対象がハードコード11パスで、同じwaveの成果物13件を含んでいない。missing_from_repo_after_this_file=[] もリテラル。chat-only知見の走査は実質未実施'],
  ['SP-098', 'PARTIAL', '名原典彦が status=ERROR のまま未解決。同定チェックが `id === 定数 || !!id` で任意のidを通す自己充足形。SP-079の前提条件を「同定でなくcoverageの問題」と読み替えて閉じている'],
];

// 除外の差し戻し。closed のまま残すものは理由を残す。
const EXCL_REVERSALS = [
  ['EX-004', 'OVERBROAD_REOPEN', 1, 1,
    '2026-08-14 Opus review で再open。閉じる根拠の一脚が SP-062（0レコード・データアクセス無し）で、'
    + 'もう一脚の SP-061 は sweep が未完（第2ソース取りこぼし）。SP-060 は実データ1件。再closeは SP-061 再sweep後。'],
  ['EX-011', 'OVERSTRICT_REOPEN', 1, 1,
    '2026-08-14 Opus review で再open。generic 7件は event_id 名前空間不一致による重複計上で実体4件。'
    + 'うち6件は選手未紐づけ、1件はゲーム挙動のジョーク。独立originの数え方を直してから再判定する。'],
  ['EX-013', 'OVERSTRICT_REOPEN', 1, 1,
    '2026-08-14 Opus review で再open。pairwise は実在するが不確かさが定数（156ドロー中96件が下限0.2）で証拠の質が効かない。'
    + 'CLEARLY_SLOWER/LEAN_SLOWER が0なのは焦点リストがFの降順・i<j のみという作り方の帰結（構成上0）で、'
    + '「厳しすぎる要求を外した」ことの証明になっていない。'],
  ['EX-017', 'REASSESS_REQUIRED', 1, 1,
    '2026-08-14 Opus review で再open。代走5件という母数が、キー名不一致で第2ソース（代走17件を含む785KB）を'
    + '0件マッチのまま出した結果。母数が確定してから再判定する。'],
  ['EX-018', 'REASSESS_REQUIRED', 1, 1,
    '2026-08-14 Opus review で再open。唯一のJSON証拠 sp062_defensive_chase_close_20260814.json が0レコードの'
    + '文字列リテラルのみで、DBもderivedも一度も参照していない。「探して分離できなかった」ではなく「探していない」。'],
];
// closed を維持するが、細い根拠を明示するもの
const EXCL_KEEP_WITH_NOTE = [
  ['EX-012', ' / 2026-08-14 Opus review: 17件の実データに基づく点は確認。ただし保持した low-weight レーンに消費先が無い（src/・configs/ から未参照）。消費先ができるまで判断へは効かない。'],
  ['EX-016', ' / 2026-08-14 Opus review: 実データ1件という母数を数えた上での downgrade として妥当と確認。ただし母数1のため、これ以降の走力判断への寄与は事実上ない。'],
];

// ── 適用 ────────────────────────────────────────────────
const reg = readTsv(REG);
const byId = new Map(reg.rows.map(r => [r.task_id, r]));
const log = [];

for (const [id, newStatus, reason] of TASK_REVERSALS) {
  const r = byId.get(id);
  if (!r) { log.push(`MISSING TASK ${id}`); continue; }
  const arts = countOf(r);
  const measured = arts.map(a => `${a.a}=${a.exists ? (a.records ?? 'n/a') : 'MISSING'}件`).join('; ');
  const before = r.status;
  r.status = newStatus;
  r.next_action_or_blocker =
    `【2026-08-14 Opus bulk review 差し戻し ${before}→${newStatus}】${reason}｜実測した列挙件数: ${measured || '(JSON成果物なし)'}｜`
    + `再close条件: 上記の欠陥を直した上で、成果物に列挙された証拠が1件以上あること`;
  log.push(`${id}: ${before} -> ${newStatus}  [${measured}]`);
}

const ex = readTsv(EXCL);
const exById = new Map(ex.rows.map(r => [r.exclusion_id, r]));
for (const [id, verdict, own, gate, note] of EXCL_REVERSALS) {
  const r = exById.get(id);
  if (!r) { log.push(`MISSING EXCL ${id}`); continue; }
  const before = r.verdict;
  r.verdict = verdict;
  r.owner_review_block = String(own);
  r.gate_block = String(gate);
  r.corrected_policy = `${note} ｜前回の記述: ${r.corrected_policy}`;
  log.push(`${id}: ${before} -> ${verdict} (gate ${gate})`);
}
for (const [id, note] of EXCL_KEEP_WITH_NOTE) {
  const r = exById.get(id);
  if (r) { r.corrected_policy += note; log.push(`${id}: kept ${r.verdict}, note appended`); }
}

writeTsv(REG, reg.head, reg.rows);
writeTsv(EXCL, ex.head, ex.rows);

const openTasks = reg.rows.filter(r => r.gate_block === '1'
  && !['DONE_VALIDATED', 'DONE_NEGATIVE_FINDING', 'SUPERSEDED', 'CLOSED_DUPLICATE'].includes(r.status));
const openExcl = ex.rows.filter(r => ['OVERBROAD_REOPEN', 'OVERSTRICT_REOPEN', 'SCOPE_OVERREACH_REOPEN', 'REASSESS_REQUIRED'].includes(r.verdict) && r.gate_block === '1');

console.log(log.join('\n'));
console.log(`\n${DRY ? '[DRY RUN]' : '[APPLIED]'} gate task blockers = ${openTasks.length}, gate exclusion blockers = ${openExcl.length}`);
console.log(`gate task blockers: ${openTasks.map(r => r.task_id).join(',')}`);
console.log(`gate exclusion blockers: ${openExcl.map(r => r.exclusion_id).join(',')}`);
