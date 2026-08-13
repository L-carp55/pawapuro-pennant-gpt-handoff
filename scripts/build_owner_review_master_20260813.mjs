// 2026 NPB 走力 Owner Review Master Table
//
// 正本: docs/tasks/OWNER_SPEED_REVIEW_MASTER_TABLE_TASK_20260813.md
//       docs/satei_handoff/21_CORRECTED_CONTINUATION_AFTER_CLAUDE_REDTEAM_20260813.md
//
// ★重要な位置づけ（21c §7）:
//   オーナーが「あなたの査定」と呼んでいるのは **GPT/Codex freeze**。
//   Claude側の既存production model は **control / reference の別列**として足す。混ぜない。
//
// 禁止（task §1）: オーナーに目盛りを作らせない／1人ずつ点を付けさせない／
//   final ratingを書き換えない／PowerProへfitしない。
//
// 使い方: node scripts/build_owner_review_master_20260813.mjs <GPT成果物のディレクトリ>

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
if (!SRC || !existsSync(SRC)) { console.error('GPT成果物のディレクトリを渡す'); process.exit(1); }

const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const num = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };

function parseCSV(t) {
  const rows = []; let f = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
      else if (ch === '\n') { f.push(c); rows.push(f); f = []; c = ''; } else if (ch !== '\r') c += ch; } }
  if (c || f.length) { f.push(c); rows.push(f); }
  return rows;
}
const objs = txt => { const r = parseCSV(txt); const H = r[0];
  return r.slice(1).filter(x => x.length > 3).map(x => Object.fromEntries(H.map((h, i) => [h, x[i]]))); };
const load = f => objs(readFileSync(path.join(SRC, f), 'utf8'));

// ── 入力 ───────────────────────────────────────────────────────────
const freeze = load('speed_2026_100_final_reappraisal_freeze_20260811.csv');   // GPT/Codex査定（主軸）
const master = load('speed_2026_100_master_evidence.csv');
const reg = JSON.parse(readFileSync(path.join(SRC, 'speed_2026_powerpro_discrepancy_register.json'), 'utf8'));
const ppSummary = load('pawapuro_speed_history_player_summary_2015_2026.csv');
const ppEvents = load('pawapuro_speed_change_events_2015_2026.csv');
const ppPanel = load('pawapuro_speed_history_panel_2015_2026.csv');
const physical = load('speed_historical_physical_measurements_2015_2026.csv');
const grok = load('speed_2026_grok_x_sources.csv');
const sns = load('speed_2026_sns_consensus_sources_v2.csv');

const masterBy = new Map(master.map(r => [norm(r.player), r]));
const regBy = new Map(reg.rows.map(r => [norm(r.player), r]));
const ppSumBy = new Map();
for (const h of ppSummary) for (const k of [norm(h.player), norm(h.player_name)]) if (k && !ppSumBy.has(k)) ppSumBy.set(k, h);
const group = (arr, keyer) => { const m = new Map();
  for (const r of arr) { const k = keyer(r); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
const ppEvBy = group(ppEvents, r => norm(r.player));
const ppPanelBy = group(ppPanel, r => norm(r.canonical_player_name) || norm(r.player_name) || norm(r.display_name));
const physBy = group(physical, r => norm(r.player));
const snsBy = group([...grok, ...sns], r => norm(r.player));

// ── Claude既存production model（control列）────────────────────────
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const dbNames = db.prepare('SELECT DISTINCT name FROM v_batting WHERE season BETWEEN 2021 AND 2025').all().map(r => r.name);
const dbByNorm = new Map(dbNames.map(n => [norm(n), n]));
const resolveDb = p => { const k = norm(p); if (dbByNorm.has(k)) return dbByNorm.get(k);
  const h = dbNames.filter(n => norm(n).endsWith(k)); return h.length === 1 ? h[0] : null; };
const ctx = makeContext(db, cfg);

const yearOf = s => { const m = String(s ?? '').match(/(20\d\d)/); return m ? +m[1] : null; };

// PowerPro履歴を人が読める形へ（年:値 → 年:値。連続する同値は畳む）
function ppHistorySummary(k) {
  const rows = (ppPanelBy.get(k) ?? [])
    .map(r => ({ y: yearOf(r.update_date) ?? yearOf(r.rating_reference_season) ?? yearOf(r.work), v: num(r.speed) }))
    .filter(x => x.y && x.v != null).sort((a, b) => a.y - b.y);
  if (!rows.length) return { text: '履歴なし', points: [], years: [] };
  const byYear = new Map();
  for (const x of rows) byYear.set(x.y, x.v);        // 同年に複数版がある場合は最後の値
  const seq = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [y, v] of seq) if (!out.length || out.at(-1)[1] !== v) out.push([y, v]);   // 変化点だけ残す
  return { text: out.map(([y, v]) => `${y}:${v}`).join(' → '), points: out, years: seq.map(s => s[0]) };
}

const rows = [];
for (const f of freeze) {
  const k = norm(f.player);
  const m = masterBy.get(k) ?? {};
  const rg = regBy.get(k) ?? {};
  const sum = ppSumBy.get(k) ?? null;
  const hist = ppHistorySummary(k);
  const dn = resolveDb(f.player);

  // ── Claude既存production model（control）──────────────────────
  let ctrlRating = null, ctrlBasis = null, ctrlStatus = 'NOT_REPRODUCIBLE';
  if (dn) {
    try {
      const card = appraiseCard(ctx, { name: dn, mode: '2025', statPrimarySpeed: true, cfg, rv, runNorm, fldNorm }).card;
      const B = card?.abilities?.基礎能力?.走力, R = card?.calc_log?.running;
      if (B?.value != null) {
        ctrlRating = B.value; ctrlStatus = 'REPRODUCED';
        ctrlBasis = `実プレー結果（三塁打割合・併殺回避・内野安打・進塁・UBR）を${R?.speed_years ?? '?'}年プール`
          + `（${R?.speed_seasons?.join(',') ?? '-'}）。NPB+の自動blendなし・較正あり`;
      }
    } catch (e) { ctrlStatus = 'ERROR'; ctrlBasis = e.message; }
  } else ctrlStatus = 'NAME_UNRESOLVED';

  // ── 物理証拠 ────────────────────────────────────────────────
  const ph = physBy.get(k) ?? [];
  const t90 = ph.filter(x => /T90/i.test(x.metric) && num(x.value) != null);
  const short = ph.filter(x => /30M|50M/i.test(x.metric) && num(x.value) != null);
  const h2f = ph.filter(x => /H2F|HOME.*FIRST|一塁到達/i.test(x.metric + (x.notes ?? '')));
  const fmtMeas = a => a.length ? a.slice(0, 3).map(x => `${x.metric}=${x.value}${x.unit ?? ''}(${x.measurement_year || '年不明'}${x.timing_method ? '/' + x.timing_method : ''})`).join(' , ') : '';
  const directT90Cur = num(m.direct_t90_current_count) ?? 0;
  const shortCnt = num(m.standardized_short_distance_count) ?? 0;
  const physStrength = directT90Cur > 0 ? 'CURRENT_DIRECT_T90'
    : shortCnt > 0 ? 'STANDARDIZED_SHORT_DISTANCE'
    : t90.length ? 'HISTORICAL_DIRECT_T90'
    : short.length ? 'HISTORICAL_SHORT_DISTANCE' : 'NONE';

  // ── SNS ─────────────────────────────────────────────────────
  const sp = (snsBy.get(k) ?? []).filter(s => /true|accept/i.test(s.accepted ?? s.acceptance_status ?? ''));
  const dir = {};
  for (const s of sp) { const d = s.supports_faster_current_slower_mixed || s.evidence_direction || 'unknown'; dir[d] = (dir[d] ?? 0) + 1; }
  const snsSummary = sp.length ? `採用${sp.length}件: ${Object.entries(dir).map(([a, b]) => `${a}×${b}`).join(' / ')}` : '採用証拠なし';
  const snsFaster = (dir.faster ?? 0) + (dir.FASTER ?? 0);
  const snsSlower = (dir.slower ?? 0) + (dir.SLOWER ?? 0);

  // ── PowerPro ────────────────────────────────────────────────
  const pp = num(rg.powerpro_2026_speed);
  const lastChangeYear = hist.points.length ? hist.points.at(-1)[0] : null;
  const yearsSinceChange = lastChangeYear ? 2026 - lastChangeYear : null;
  const obsRecent = hist.years.filter(y => y >= 2023).length;

  // ── 差 ──────────────────────────────────────────────────────
  const proj = num(f.final_rating);
  const diff = (proj != null && pp != null) ? proj - pp : null;
  const absDiff = diff == null ? null : Math.abs(diff);
  const big = absDiff != null && absDiff >= 5;
  const direction = diff == null ? '' : diff > 0 ? 'PROJECT_HIGHER' : diff < 0 ? 'POWERPRO_HIGHER' : 'EQUAL';

  // ── PowerPro据え置き（年数だけで断定しない。観測継続を見る）──
  // ★年数だけでstaleと断定しない（task §5）。長期据え置き **かつ** 裏付けが要る。
  const staleReasons = [];
  let stale = false;
  const longHeld = yearsSinceChange != null && yearsSinceChange >= 4 && obsRecent >= 2;
  if (longHeld) {
    const corrob = [];
    if (absDiff != null && absDiff >= 8) corrob.push(`現在の査定と${absDiff.toFixed(0)}点乖離`);
    if (physStrength === 'CURRENT_DIRECT_T90' || physStrength === 'STANDARDIZED_SHORT_DISTANCE')
      corrob.push(`比較可能な身体計測がある（${physStrength}）`);
    if (snsFaster >= 2 || snsSlower >= 2) corrob.push('SNSに方向の揃った独立投稿が複数');
    if (corrob.length) {
      staleReasons.push(`最後の変更が${lastChangeYear}年（${yearsSinceChange}年前）で、以降${obsRecent}年分の観測がありながら動いていない`);
      staleReasons.push(...corrob);
      stale = true;
    }
  }

  // ── 差の理由（証拠が支持した時だけ書く。無ければNO_CLEAR_CAUSE）──
  const cls = [], why = [];
  const games = num(m.games), pa = num(m.PA);
  if (games != null && games < 40) { cls.push('LOW_EXPOSURE_NPBPLUS_RISK');
    why.push(`2026年の出場が${games}試合と少なく、NPB+が最高速度を観測しきれていない可能性`); }
  if (f.metric_conflict && f.metric_conflict !== 'NONE') { cls.push('METRIC_CONSTRUCT_CONFLICT');
    why.push(`指標の構成が衝突している（${f.metric_conflict}）`); }
  if (/HISTORICAL/i.test(f.temporal_status ?? '')) { cls.push('TEMPORAL_CHANGE_NOT_CAPTURED');
    why.push(`過去の直接計測が文脈扱いに留まり、現在への持ち越しが決まっていない（${f.temporal_status}）`); }
  if (stale && diff != null) {
    if (diff < 0) { cls.push('POWERPRO_STALE_HIGH_SUSPECTED'); why.push('PowerProが高いまま据え置かれている疑い'); }
    else { cls.push('POWERPRO_STALE_LOW_SUSPECTED'); why.push('PowerProが低いまま据え置かれている疑い'); }
  }
  if (directT90Cur > 0 && diff != null && Math.abs(diff) >= 5) {
    cls.push('CURRENT_PHYSICAL_SUPPORTS_PROJECT');
    why.push(`現在の直接計測（T90）があり、project側に物理的な裏付けがある: ${fmtMeas(t90)}`);
  } else if ((t90.length || short.length) && diff != null && diff < -5) {
    cls.push('HISTORICAL_PHYSICAL_SUPPORTS_POWERPRO');
    why.push(`過去の身体計測がPowerProの高い評価と同じ向きを示す: ${fmtMeas([...t90, ...short])}`);
  }
  if (snsFaster >= 2 && diff != null && diff < 0) { cls.push('SNS_SUPPORTS_POWERPRO_DIRECTION');
    why.push(`SNSで「速い」方向の独立投稿が${snsFaster}件`); }
  if (snsSlower >= 2 && diff != null && diff > 0) { cls.push('SNS_SUPPORTS_PROJECT_DIRECTION');
    why.push(`SNSで「遅い」方向の独立投稿が${snsSlower}件`); }
  if (big && !cls.length) { cls.push('NO_CLEAR_CAUSE');
    why.push('利用可能な証拠（身体計測・SNS・出場量・PowerPro推移）のいずれもこの差の向きを支持していない'); }

  const reasonConfidence = !big ? '' : cls.includes('NO_CLEAR_CAUSE') ? 'NONE'
    : (cls.includes('CURRENT_PHYSICAL_SUPPORTS_PROJECT') || cls.length >= 2) ? 'MEDIUM' : 'LOW';

  // ── project側の疑い ─────────────────────────────────────────
  const topSpeedOnly = /CURRENT_NPB_PLUS_ORDINAL/i.test(f.primary_evidence_class ?? '');
  const histConflict = (f.metric_conflict && f.metric_conflict !== 'NONE') || /CONFLICT/i.test(f.sns_classification ?? '');

  // ── レビュー対象（task §6。LOW_MEDIUMだけでは入れない）────────
  const reviewReasons = [];
  if (big) reviewReasons.push(`PowerProとの差${diff > 0 ? '+' : ''}${diff?.toFixed(0)}`);
  if (f.confidence === 'LOW') reviewReasons.push('project側のconfidenceがLOW');
  if (histConflict) reviewReasons.push('証拠の衝突あり');
  if (stale) reviewReasons.push('PowerPro据え置きの疑い');
  const reviewRequired = reviewReasons.length > 0;

  rows.push({
    player: f.player, player_id: f.player_id, team: f.team,
    gpt_codex_rating: proj, gpt_codex_low: num(f.final_low), gpt_codex_high: num(f.final_high),
    gpt_codex_confidence: f.confidence, gpt_codex_decision_class: f.decision_class,
    gpt_codex_short_rationale: f.short_rationale,
    existing_production_model_rating: ctrlRating,
    existing_production_model_basis: ctrlBasis, existing_production_model_status: ctrlStatus,
    npb_plus_sprint_kmh: num(f.sprint_kmh), exposure_games: games, exposure_pa: pa,
    direct_t90_summary: fmtMeas(t90), standardized_30m_50m_summary: fmtMeas(short),
    home_to_first_summary: fmtMeas(h2f), historical_physical_summary: ph.length ? `計測${ph.length}件` : '',
    physical_evidence_strength: physStrength,
    sns_physical_classification: f.sns_classification, sns_physical_summary: snsSummary,
    video_classification: f.video_classification,
    powerpro_current_speed: pp, powerpro_match_status: rg.powerpro_match_status ?? '',
    powerpro_history_summary: hist.text,
    powerpro_change_points: hist.points.length, powerpro_years_since_material_change: yearsSinceChange,
    project_minus_powerpro: diff, abs_project_powerpro_diff: absDiff, large_diff_ge_5: big,
    discrepancy_direction: direction, discrepancy_reason_class: cls.join('|'),
    discrepancy_reason_explanation_ja: why.join('／'), discrepancy_reason_confidence: reasonConfidence,
    powerpro_stale_suspected: stale, powerpro_stale_reason: staleReasons.join('／'),
    project_top_speed_overweight_suspected: topSpeedOnly && big && diff > 0,
    project_acceleration_missing_suspected: topSpeedOnly && big && diff < 0,
    historical_evidence_conflict: histConflict, current_exposure_risk: games != null && games < 40,
    owner_review_required: reviewRequired, owner_review_reasons: reviewReasons.join('／'),
    owner_verdict: '', owner_note: '', owner_preferred_rating_optional: '',
  });
}
db.close();

// ── レビュー優先度（task §6）────────────────────────────────────
const prio = r => {
  if (r.powerpro_stale_suspected && r.large_diff_ge_5) return 1;
  if ((r.gpt_codex_confidence === 'LOW' || r.historical_evidence_conflict) && r.large_diff_ge_5) return 2;
  if (r.large_diff_ge_5) return 3;
  return 4;
};
const queue = rows.filter(r => r.owner_review_required)
  .sort((a, b) => prio(a) - prio(b) || (b.abs_project_powerpro_diff ?? 0) - (a.abs_project_powerpro_diff ?? 0));

// ── 出力 ───────────────────────────────────────────────────────────
const OUT = path.join(ROOT, 'outputs');
const COLS = Object.keys(rows[0]);
const esc = v => { if (v == null) return ''; const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
writeFileSync(path.join(OUT, 'derived', 'speed_2026_100_owner_review_master_20260813.csv'),
  [COLS.join(','), ...rows.map(r => COLS.map(c => esc(r[c])).join(','))].join('\n') + '\n', 'utf8');
writeFileSync(path.join(OUT, 'derived', 'speed_2026_100_owner_review_master_20260813.json'),
  JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10),
    source: '21_CORRECTED_CONTINUATION_AFTER_CLAUDE_REDTEAM_20260813.md / OWNER_SPEED_REVIEW_MASTER_TABLE_TASK_20260813.md',
    note: 'gpt_codex_* がオーナーの言う「あなたの査定」。existing_production_model_* はClaude側のcontrol（混ぜていない）',
    rows }, null, 2), 'utf8');

// master Markdown
const f1 = v => v == null ? '-' : (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : v);
const sg = v => v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(0);
const M = []; const mp = s => M.push(s);
mp('# 2026 NPB 走力 — Owner Review Master Table（100人）\n');
mp(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
mp('## 列の意味\n');
mp('| 列 | 意味 |');
mp('|---|---|');
mp('| project査定 | **GPT/Codex freeze**。オーナーが「あなたの査定」と呼んでいるもの |');
mp('| 既存モデル(control) | Claude側の既存production model。**比較用の参考**で、project査定には混ぜていない |');
mp('| PowerPro現在 / 推移 | 2026年の値と、値が動いた年だけを並べた履歴 |');
mp('| 差 | project査定 − PowerPro |');
mp('| 差の理由 | 証拠が支持した時だけ書く。支持が無ければ `NO_CLEAR_CAUSE` |\n');
mp(`**レビュー対象: ${queue.length}人 / 100人**（差5以上 or confidence LOW or 証拠衝突 or 据え置き疑い。`);
mp('LOW_MEDIUMだけでは対象にしていない）\n');
mp('---\n');
mp('| 選手 | project査定 | 幅 | conf | 既存モデル | PowerPro | 差 | PowerPro推移 | 据え置き | 差の理由 | レビュー |');
mp('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows.sort((a, b) => (b.abs_project_powerpro_diff ?? 0) - (a.abs_project_powerpro_diff ?? 0)))
  mp(`| ${r.player} | ${f1(r.gpt_codex_rating)} | ${f1(r.gpt_codex_low)}–${f1(r.gpt_codex_high)} | ${r.gpt_codex_confidence} | ${f1(r.existing_production_model_rating)} | ${f1(r.powerpro_current_speed)} | ${sg(r.project_minus_powerpro)} | ${r.powerpro_history_summary} | ${r.powerpro_stale_suspected ? 'YES' : '-'} | ${r.discrepancy_reason_class || '-'} | ${r.owner_review_required ? '要' : '-'} |`);
writeFileSync(path.join(OUT, 'speed_2026_100_owner_review_master_20260813.md'), M.join('\n'), 'utf8');

// owner review queue（選手ごとのsection形式）
const Q = []; const qp = s => Q.push(s);
qp('# 走力 オーナーレビュー依頼 — 2026年\n');
qp(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
qp(`**${queue.length}人**についてご意見をください。100人全員を見る必要はありません。\n`);
qp('## お願いしたいこと\n');
qp('各選手について、次から**1つ選ぶだけ**で構いません。点数を付ける必要はありません。\n');
qp('| 選択肢 | 意味 |');
qp('|---|---|');
qp('| `POWERPRO_PLAUSIBLE` | PowerProの方が自然 |');
qp('| `POWERPRO_TOO_HIGH_OR_STALE` | PowerProが高すぎる／古い査定のまま |');
qp('| `POWERPRO_TOO_LOW` | PowerProが低すぎる |');
qp('| `PROJECT_TOO_HIGH` | こちらの査定が高すぎる |');
qp('| `PROJECT_TOO_LOW` | こちらの査定が低すぎる |');
qp('| `BOTH_QUESTIONABLE` | どちらも違和感 |');
qp('| `UNRESOLVED` | 判断できない |');
qp('| `OTHER` | その他（コメントで） |\n');
qp('点数を書きたい場合だけ「◯点」と添えてください。**必須ではありません。**\n');
qp('---\n');
let lastP = 0;
const PLABEL = { 1: '① 据え置き疑い＋大きな差', 2: '② 証拠が弱い／衝突＋大きな差', 3: '③ 大きな差', 4: '④ 据え置き・衝突のみ' };
for (const r of queue) {
  const p = prio(r);
  if (p !== lastP) { qp(`## ${PLABEL[p]}\n`); lastP = p; }
  qp(`### ${r.player}（${r.team}）\n`);
  qp('| 項目 | 内容 |');
  qp('|---|---|');
  qp(`| こちらの査定 | **${f1(r.gpt_codex_rating)}**（幅 ${f1(r.gpt_codex_low)}–${f1(r.gpt_codex_high)} / 確からしさ ${r.gpt_codex_confidence}） |`);
  qp(`| その根拠 | ${r.gpt_codex_short_rationale || '-'} |`);
  qp(`| 既存モデル（参考） | ${f1(r.existing_production_model_rating)} — ${r.existing_production_model_basis || '-'} |`);
  qp(`| PowerPro現在 | **${f1(r.powerpro_current_speed)}** |`);
  qp(`| PowerPro推移 | ${r.powerpro_history_summary} |`);
  qp(`| 差 | **${sg(r.project_minus_powerpro)}** |`);
  qp(`| 身体計測 | ${[r.direct_t90_summary, r.standardized_30m_50m_summary].filter(Boolean).join(' / ') || 'なし'} |`);
  qp(`| 出場（2026） | ${r.exposure_games ?? '-'}試合 / ${r.exposure_pa ?? '-'}打席 |`);
  qp(`| SNS | ${r.sns_physical_summary} |`);
  qp(`| AIが考える差の理由 | ${r.discrepancy_reason_explanation_ja || '（差が小さいため未分析）'} |`);
  qp(`| PowerPro据え置き疑い | ${r.powerpro_stale_suspected ? 'YES — ' + r.powerpro_stale_reason : 'NO'} |`);
  qp(`| レビュー理由 | ${r.owner_review_reasons} |`);
  qp('| **あなたの裁定** | |');
  qp('| コメント（任意） | |');
  qp('');
}
writeFileSync(path.join(OUT, 'OWNER_SPEED_REVIEW_QUEUE_20260813.md'), Q.join('\n'), 'utf8');

// ── QA（task §10）──────────────────────────────────────────────
const freezeBy = new Map(freeze.map(f => [norm(f.player), f]));
const qa = {
  generated_at: new Date().toISOString().slice(0, 10),
  rows_100: rows.length === 100,
  unique_players: new Set(rows.map(r => r.player)).size === rows.length,
  nahara_kept: rows.some(r => /名原/.test(r.player)),
  // 空IDは正しい（捏造しない）。検査すべきは『sourceに無いIDを作っていないか』
  no_fabricated_ids: rows.every(r => (r.player_id ?? '') === (freezeBy.get(norm(r.player))?.player_id ?? '')),
  ids_blank_count: rows.filter(r => !r.player_id).length,
  gpt_codex_matches_source: rows.every(r => num(freezeBy.get(norm(r.player))?.final_rating) === r.gpt_codex_rating),
  powerpro_exact_match_count: rows.filter(r => r.powerpro_current_speed != null).length,
  diff_consistent: rows.every(r => r.project_minus_powerpro == null
    || Math.abs(r.project_minus_powerpro - (r.gpt_codex_rating - r.powerpro_current_speed)) < 1e-9),
  all_big_diff_in_queue: rows.filter(r => r.large_diff_ge_5).every(r => r.owner_review_required),
  all_low_confidence_in_queue: rows.filter(r => r.gpt_codex_confidence === 'LOW').every(r => r.owner_review_required),
  all_stale_in_queue: rows.filter(r => r.powerpro_stale_suspected).every(r => r.owner_review_required),
  all_conflict_in_queue: rows.filter(r => r.historical_evidence_conflict).every(r => r.owner_review_required),
  low_medium_not_auto_flagged: rows.filter(r => r.gpt_codex_confidence === 'LOW_MEDIUM'
    && !r.large_diff_ge_5 && !r.powerpro_stale_suspected && !r.historical_evidence_conflict)
    .every(r => !r.owner_review_required),
  owner_fields_blank: rows.every(r => r.owner_verdict === '' && r.owner_note === '' && r.owner_preferred_rating_optional === ''),
  reasons_have_evidence_or_no_clear_cause: rows.filter(r => r.large_diff_ge_5)
    .every(r => r.discrepancy_reason_class && r.discrepancy_reason_class.length > 0),
  counts: {
    total: rows.length, review: queue.length,
    big_diff: rows.filter(r => r.large_diff_ge_5).length,
    conf_LOW: rows.filter(r => r.gpt_codex_confidence === 'LOW').length,
    conf_LOW_MEDIUM: rows.filter(r => r.gpt_codex_confidence === 'LOW_MEDIUM').length,
    stale: rows.filter(r => r.powerpro_stale_suspected).length,
    conflict: rows.filter(r => r.historical_evidence_conflict).length,
    control_reproduced: rows.filter(r => r.existing_production_model_status === 'REPRODUCED').length,
    no_clear_cause: rows.filter(r => /NO_CLEAR_CAUSE/.test(r.discrepancy_reason_class)).length,
  },
};
qa.all_pass = Object.entries(qa).filter(([k, v]) => typeof v === 'boolean').every(([, v]) => v);
writeFileSync(path.join(OUT, 'derived', 'speed_2026_100_owner_review_master_qa_20260813.json'), JSON.stringify(qa, null, 2), 'utf8');

console.log(`master ${rows.length}人 / review ${queue.length}人`);
console.log('QA:', Object.entries(qa).filter(([k, v]) => typeof v === 'boolean' && k !== 'all_pass')
  .map(([k, v]) => `${k}=${v ? 'OK' : 'NG'}`).join(' '));
console.log('内訳:', JSON.stringify(qa.counts));
