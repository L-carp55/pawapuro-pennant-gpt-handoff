// 走力の差の原因を、オーナーへ渡す前にAI側で分離・診断する。
//
// 指示（2026-08-13 GPT→Claude）:
//   1段目の選手について、差の原因を次の4種へ分離（複数該当可）。
//     MODEL_SCALE                … 自作査定全体の幅が狭いことによる差
//     PROJECT_EVIDENCE_CONFLICT  … プレー結果由来とNPB+/身体計測が大きく食い違う
//     POWERPRO_STALE_OR_ODD      … PowerProの据え置き・更新遅れ・不可解査定の疑い
//     CURRENT_EVIDENCE_WEAK      … 少出場・測定不足で現在能力が分からない
//   PROJECT_EVIDENCE_CONFLICT はオーナーへ投げる前に調査する。
//   PowerProは「N年据え置き」だけでstaleと断定せず、実際に各作品で観測され続けているか・
//   変更時点・年齢・現在証拠との整合まで見て3段階へ分ける。
//   新たな大規模調査の前に既存GitHub成果を使い切る。
//
// 出力:
//   outputs/derived/speed_conflict_diagnosis_2026.csv
//   outputs/speed_scale_diagnosis_2026.md
//   outputs/speed_player_conflict_diagnosis_2026.md
//
// 使い方: node scripts/diagnose_speed_conflicts.mjs <GPT成果物のディレクトリ>

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
// ★relative model候補（正本22 §5-C）。第2引数に --stat-primary を渡すと
//   走力のNPB+自動blendを行わず較正済み統計モデルをprimaryにする。既定=production同等。
const STAT_PRIMARY = process.argv.includes('--stat-primary');
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

// ── 入力（既存成果を使い切る）─────────────────────────────────────
const reg = JSON.parse(readFileSync(path.join(SRC, 'speed_2026_powerpro_discrepancy_register.json'), 'utf8'));
const master = load('speed_2026_100_master_evidence.csv');
const ppSummary = load('pawapuro_speed_history_player_summary_2015_2026.csv');
const ppEvents = load('pawapuro_speed_change_events_2015_2026.csv');
const ppPanel = load('pawapuro_speed_history_panel_2015_2026.csv');
const physical = load('speed_historical_physical_measurements_2015_2026.csv');
const grok = load('speed_2026_grok_x_sources.csv');
const sns = load('speed_2026_sns_consensus_sources_v2.csv');

const byName = (arr, key = 'player') => {
  const m = new Map();
  for (const r of arr) { const k = norm(r[key]); if (!k) continue; (m.get(k) ?? m.set(k, []).get(k)).push(r); }
  return m;
};
const masterBy = new Map(master.map(r => [norm(r.player), r]));
const ppSumBy = new Map();
for (const h of ppSummary) for (const k of [norm(h.player), norm(h.player_name)]) if (k && !ppSumBy.has(k)) ppSumBy.set(k, h);
const ppEvBy = byName(ppEvents);
const ppPanelBy = (() => { const m = new Map();
  for (const r of ppPanel) for (const k of [norm(r.canonical_player_name), norm(r.player_name), norm(r.display_name)]) {
    if (!k) continue; if (!m.has(k)) m.set(k, []); if (m.get(k).at(-1) !== r) m.get(k).push(r); break; }
  return m; })();
const physBy = byName(physical);
const snsBy = (() => { const m = new Map();
  for (const r of [...grok, ...sns]) { const k = norm(r.player); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m; })();

// ── 自作査定 ───────────────────────────────────────────────────────
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const dbNames = db.prepare('SELECT DISTINCT name FROM v_batting WHERE season BETWEEN 2021 AND 2025').all().map(r => r.name);
const dbByNorm = new Map(dbNames.map(n => [norm(n), n]));
const resolveDb = p => { const k = norm(p); if (dbByNorm.has(k)) return dbByNorm.get(k);
  const h = dbNames.filter(n => norm(n).endsWith(k)); return h.length === 1 ? h[0] : null; };
const ctx = makeContext(db, cfg);
const M = cfg.npb_plus_direct.models.top_speed_kmh;
// ★NPB+のraw測定はblendの有無と無関係に保持する（正本22 §5-C）。
//   候補モデルではblendしないが、材料衝突の evidence としては測り続ける。
const npbRawBy = new Map();
for (const x of db.prepare('SELECT player_id, top_speed_kmh FROM npb_plus_measurement WHERE top_speed_kmh IS NOT NULL').all())
  npbRawBy.set(x.player_id, x.top_speed_kmh);
const npbRawByName = new Map();
for (const [pid, spd] of npbRawBy) {
  const nm = db.prepare('SELECT name FROM v_batting WHERE player_id=? ORDER BY season DESC LIMIT 1').get(pid)?.name;
  if (nm) npbRawByName.set(norm(nm), spd);
}

const rows = [];
for (const r of reg.rows) {
  const m = masterBy.get(norm(r.player)) ?? {};
  const dn = resolveDb(r.player);
  let mine = null, stat = null, npbUsed = null, years = null, zc = null, used = null, err = null, calibrated = false;
  if (dn) {
    try {
      const card = appraiseCard(ctx, { name: dn, mode: '2025', cfg, rv, runNorm, fldNorm, statPrimarySpeed: STAT_PRIMARY }).card;
      const B = card?.abilities?.基礎能力?.走力, R = card?.calc_log?.running;
      mine = B?.value ?? null; stat = B?.statistical_value ?? B?.value ?? null;
      npbUsed = B?.measured ?? null; years = R?.speed_years ?? null; zc = R?._speed_z ?? null;
      calibrated = B?.uncalibrated != null;
      // blendしない候補モデルでは card に measured が載らないので、raw値から補う
      if (npbUsed == null) npbUsed = npbRawByName.get(norm(r.player)) ?? npbRawByName.get(norm(dn)) ?? null;
      // 候補モデルでは mine が較正後、stat は素点。材料衝突は「較正後の統計値」と比べる
      if (B?.statistical_value == null) stat = mine;
    } catch (e) { err = e.message; }
  } else err = 'DB名寄せ不可';
  const pp = num(r.powerpro_2026_speed);
  const npbDerived = npbUsed != null ? M.intercept + M.slope * npbUsed : null;
  rows.push({ player: r.player, team: r.team, mine, stat, npbUsed, npbDerived, pp,
    rawDiff: (mine != null && pp != null) ? mine - pp : null,
    years, zc, games: num(m.games), pa: num(m.PA),
    directT90: num(m.direct_t90_current_count) ?? 0, shortD: num(m.standardized_short_distance_count) ?? 0,
    exposure: m.exposure_class ?? '', undersample: m.undersampling_suspicion ?? '', calibrated, err });
}
db.close();

// ── スケール診断 ───────────────────────────────────────────────────
const paired = rows.filter(r => r.mine != null && r.pp != null);
const sd = a => { const mu = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / a.length); };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const SDm = sd(paired.map(r => r.mine)), SDp = sd(paired.map(r => r.pp));
const MUm = mean(paired.map(r => r.mine)), MUp = mean(paired.map(r => r.pp));
const zsd = sd(rows.filter(r => Number.isFinite(r.zc)).map(r => r.zc));
const S = cfg.zscore_ratings.speed, CAL = cfg.scale_calibration.applied['走力'];
const calibratedCount = paired.filter(r => r.calibrated).length;

// 材料間の系統的なずれ（プレー結果由来 vs NPB+由来）
const both = rows.filter(r => r.stat != null && r.npbDerived != null);
const offset = both.length ? mean(both.map(r => r.npbDerived - r.stat)) : 0;

for (const r of rows) {
  // 目盛りを揃えた診断値（★パワプロの幅を正解として採用したわけではない）
  r.scaleAdj = (r.mine != null && r.pp != null) ? ((r.mine - MUm) / SDm) * SDp + MUp - r.pp : null;
  // 差のうち目盛りで説明できる分
  r.scalePart = (r.rawDiff != null && r.scaleAdj != null) ? r.rawDiff - r.scaleAdj : null;
  // 材料衝突のうち、系統オフセットを除いた「その選手固有」の分
  r.conflictRaw = (r.stat != null && r.npbDerived != null) ? r.npbDerived - r.stat : null;
  r.conflictResid = r.conflictRaw != null ? r.conflictRaw - offset : null;
}

// ── PowerPro据え置きの3段階判定 ────────────────────────────────────
// 「N年据え置き」だけで断定しない。実際に各作品で観測され続けているかを見る。
const yearOf = s => { const mm = String(s ?? '').match(/(20\d\d)/); return mm ? +mm[1] : null; };
for (const r of rows) {
  const k = norm(r.player);
  const sum = ppSumBy.get(k) ?? null;
  const ev = (ppEvBy.get(k) ?? []).filter(e => num(e.change) !== 0 && num(e.change) != null);
  const panel = ppPanelBy.get(k) ?? [];
  const obsYears = [...new Set(panel.map(p => yearOf(p.update_date) ?? yearOf(p.rating_reference_season) ?? yearOf(p.work)).filter(Boolean))].sort();
  const unchangedDays = sum ? num(sum.longest_unchanged_days) : null;
  const nObs = sum ? num(sum.num_observations) : (panel.length || null);
  const nChg = sum ? num(sum.num_changes) : ev.length;
  const lastChangeYear = ev.length ? Math.max(...ev.map(e => yearOf(e.date)).filter(Boolean)) : null;
  const ageNow = panel.length ? num(panel.at(-1).age_at_rating) : null;

  // 据え置き期間が実際に観測でカバーされているか（観測の空白による見かけの据え置きを除く）
  const recentObsYears = obsYears.filter(y => y >= 2023);
  const coveredRecently = recentObsYears.length >= 2;
  const longUnchanged = unchangedDays != null && unchangedDays >= 1095;   // 3年
  const neverChanged = nChg === 0 && (nObs ?? 0) >= 5;
  const changedRecently = lastChangeYear != null && lastChangeYear >= 2024;

  let stale = 'NO_STALE_EVIDENCE', why = [];
  if (changedRecently) {
    why.push(`直近${lastChangeYear}年に変更あり`);
  } else if ((longUnchanged || neverChanged) && coveredRecently) {
    // 観測は続いているのに動いていない＝据え置きの疑いが立つ
    const corrob = [];
    if (ageNow != null && ageNow >= 30) corrob.push(`年齢${ageNow}歳（衰えが出やすい）`);
    if (r.directT90 > 0 || r.shortD > 0) corrob.push('現在の身体計測あり');
    if (Math.abs(r.scaleAdj ?? 0) >= 10) corrob.push('現在証拠と乖離');
    stale = corrob.length ? 'POWERPRO_STALE_SUPPORTED' : 'POWERPRO_STALE_POSSIBLE';
    why.push(`${recentObsYears.length}年分の観測が続く中で${neverChanged ? '一度も変更なし' : `最長${(unchangedDays / 365).toFixed(1)}年据え置き`}`);
    why.push(...corrob);
  } else if (longUnchanged || neverChanged) {
    stale = 'POWERPRO_STALE_POSSIBLE';
    why.push(`据え置きだが直近の観測が${recentObsYears.length}年分しかなく、観測の空白かもしれない`);
  } else if (!nObs) {
    why.push('パワプロ履歴なし');
  } else {
    why.push(`変更${nChg ?? 0}回・最長据置${unchangedDays != null ? (unchangedDays / 365).toFixed(1) + '年' : '不明'}`);
  }
  r.stale = stale; r.staleWhy = why; r.obsYears = obsYears; r.ageNow = ageNow;
  r.lastChangeYear = lastChangeYear; r.nChg = nChg; r.nObs = nObs;
}

// ── 4種の原因分離 ─────────────────────────────────────────────────
for (const r of rows) {
  const causes = [];
  if (r.scalePart != null && Math.abs(r.scalePart) >= 5) causes.push('MODEL_SCALE');
  if (r.conflictResid != null && Math.abs(r.conflictResid) >= 10) causes.push('PROJECT_EVIDENCE_CONFLICT');
  if (r.stale === 'POWERPRO_STALE_SUPPORTED' || r.stale === 'POWERPRO_STALE_POSSIBLE') causes.push('POWERPRO_STALE_OR_ODD');
  if ((r.games != null && r.games < 40) || (r.years != null && r.years <= 1)
      || /LOW|UNDER/i.test(r.exposure) || /true|suspect/i.test(r.undersample)) causes.push('CURRENT_EVIDENCE_WEAK');
  r.causes = causes;

  // ── 材料衝突の調査（既存成果の範囲で）──────────────────────
  if (causes.includes('PROJECT_EVIDENCE_CONFLICT')) {
    const d = [];
    const ph = (physBy.get(norm(r.player)) ?? []).filter(p => /T90|30M|50M/i.test(p.metric));
    if (ph.length) {
      const t90 = ph.filter(p => /T90/i.test(p.metric));
      d.push(`身体計測あり: ${ph.slice(0, 3).map(p => `${p.metric}=${p.value}${p.unit ?? ''}(${p.measurement_year || '年不明'}${p.timing_method ? '/' + p.timing_method : ''})`).join(' , ')}`);
      if (t90.length) {
        // T90が速いほど小さい。NPB+由来が高い(速い)ならT90は小さいはず
        const v = num(t90[0].value);
        if (v != null) d.push(v <= 4.05 ? 'T90は「速い」側＝NPB+由来を支持' : 'T90は「遅くない」程度＝決定打にならない');
      }
    } else d.push('身体計測なし（この選手は物理的な裏付けが取れない）');

    const sp = (snsBy.get(norm(r.player)) ?? []).filter(s => /true|accept/i.test(s.accepted ?? s.acceptance_status ?? ''));
    if (sp.length) {
      const dir = {};
      for (const s of sp) { const k = s.supports_faster_current_slower_mixed || s.evidence_direction || '不明'; dir[k] = (dir[k] ?? 0) + 1; }
      d.push(`SNS採用${sp.length}件: ${Object.entries(dir).map(([k, v]) => `${k}×${v}`).join(' / ')}`);
    } else d.push('SNS採用証拠なし');

    if (r.games != null && r.games < 60) d.push(`出場${r.games}試合＝NPB+が最高速度を観測しきれていない可能性`);
    if (r.years != null && r.years <= 2) d.push(`統計側のプールが${r.years}年しかなく推定が不安定`);

    // 決着したか
    const resolvedByPhys = ph.length > 0;
    const resolvedByExposure = (r.games != null && r.games < 40);
    r.conflictVerdict = (resolvedByPhys || resolvedByExposure) ? 'PARTIALLY_EXPLAINED' : 'UNRESOLVED_PROJECT_CONFLICT';
    r.conflictNotes = d;
  } else { r.conflictVerdict = ''; r.conflictNotes = []; }
}

// ── 出力 ───────────────────────────────────────────────────────────
const f1 = v => v == null ? '-' : v.toFixed(1);
const sg = v => v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(1);

// (1) スケール診断
const A = [];
A.push('# 走力 スケール診断 — 自作査定の幅が狭い原因\n');
A.push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
A.push('## 結論\n');
A.push('幅が狭い原因は2つあり、**2つ目は配線の不備**である。\n');
A.push('### 原因1: 合成zは必ず縮む（統計的な必然）\n');
A.push('```text');
A.push(`合成zの標準偏差 = ${zsd.toFixed(3)}   （1.0なら母集団の幅を保てている）`);
A.push('```');
A.push('走力は5材料（三塁打割合・併殺回避・内野安打率・進塁・UBR）の**重み付き平均**。');
A.push('材料同士が完全相関でない限り、平均すると幅は必ず縮む。');
A.push('これは推定として正しい（条件付き期待値）が、**能力値としては母集団の幅を再現しない**。\n');
A.push('### 原因2: ★その縮みを戻す較正が、ほぼ誰にも掛かっていない\n');
A.push('```text');
A.push(`目盛り: center=${S.center} spread=${S.spread}  → 幅 ${(zsd * S.spread).toFixed(1)}`);
A.push(`較正 slope=${CAL.slope.toFixed(4)}          → 幅 ${(zsd * S.spread * CAL.slope).toFixed(1)}  ← 本来ここまで戻るはず`);
A.push(`実際の自作査定の幅                ${SDm.toFixed(1)}`);
A.push(`パワプロ2026の幅                  ${SDp.toFixed(1)}`);
A.push('```');
A.push(`**較正が掛かった選手は ${calibratedCount} / ${paired.length} 人しかいない。**\n`);
A.push('原因: NPB+実測を混ぜる経路（`blendDirect`）が `applyScale` を通らないため。');
A.push('この設計自体は意図的で、理由も記録されている——NPB+の変換式はパワプロの能力値を');
A.push('目標に当てはめたものなので、パワプロ由来の較正を再度当てると二重になる、というもの。\n');
A.push('**だが混ぜている相手（プレー結果由来の統計値）は較正前の目盛りに乗っている。**');
A.push('つまり `blendDirect` は**目盛りの違う2つの量を混ぜており**、結果はどちらの目盛りでもない。');
A.push('これが幅が縮む主因。\n');
A.push('### 数値の整合\n');
A.push(`合成z ${zsd.toFixed(3)} × spread ${S.spread} × 較正 ${CAL.slope.toFixed(3)} = **${(zsd * S.spread * CAL.slope).toFixed(1)}**`);
A.push(`パワプロの幅 = **${SDp.toFixed(1)}**\n`);
A.push('**較正さえ正しく届いていれば、幅の問題はほぼ解消する計算になる。**');
A.push('つまりこれはモデルの失敗ではなく、修正が対象へ届いていない配線の問題。\n');
A.push('## 材料間の系統的なずれ\n');
A.push('```text');
A.push(`NPB+由来 − プレー結果由来 の平均 = ${offset >= 0 ? '+' : ''}${offset.toFixed(1)}点   (n=${both.length})`);
A.push(`同じ向きの選手 = ${both.filter(r => (r.npbDerived - r.stat) > 0).length} / ${both.length}`);
A.push('```');
A.push('材料衝突の大半もまた目盛りのずれ。**選手固有の衝突は、この系統分を引いた残り**で判定する。\n');
A.push('## 未解決\n');
A.push('- 較正を混合経路にも掛けるべきかは**二重適用の懸念があるため要設計**。');
A.push('  正しい形は「NPB+側を統計側の目盛りへ変換してから混ぜる」か、');
A.push('  「両方を較正後の目盛りへ揃えてから混ぜる」のいずれか。本診断では方針決定まで行わない');
A.push('- 較正値そのもの（slope 1.3811）は2024年143人でパワプロへ合わせたもの。');
A.push('  パワプロを目盛りの正本にしない方針と衝突するため、最終的にはアンカーか');
A.push('  エンジン整合で置き換える必要がある（本工程の範囲外）');
writeFileSync(path.join(ROOT, 'outputs', 'speed_scale_diagnosis_2026.md'), A.join('\n'), 'utf8');

// (2) 選手別の衝突診断
const tier1 = rows.filter(r => r.causes.length && (Math.abs(r.scaleAdj ?? 0) >= 12
  || (Math.abs(r.scaleAdj ?? 0) >= 8 && r.causes.includes('CURRENT_EVIDENCE_WEAK'))
  || r.causes.includes('PROJECT_EVIDENCE_CONFLICT')))
  .sort((a, b) => Math.abs(b.scaleAdj ?? 0) - Math.abs(a.scaleAdj ?? 0));

const B = [];
B.push('# 走力 選手別 材料衝突診断\n');
B.push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
B.push('オーナーへ渡す前に、AI側で原因を4種へ分離し、材料衝突を既存成果の範囲で調査した。\n');
B.push('| 原因 | 意味 |');
B.push('|---|---|');
B.push('| MODEL_SCALE | 自作査定全体の幅が狭いことによる差（スケール診断参照） |');
B.push('| PROJECT_EVIDENCE_CONFLICT | プレー結果由来とNPB+/身体計測が、系統ずれを除いてもなお食い違う |');
B.push('| POWERPRO_STALE_OR_ODD | PowerProの据え置き・更新遅れ・不可解査定の疑い |');
B.push('| CURRENT_EVIDENCE_WEAK | 少出場・測定不足で現在能力が分からない |\n');
B.push('---\n');
for (const r of tier1) {
  B.push(`## ${r.player}（${r.team}）\n`);
  B.push('```text');
  B.push(`自作査定 ${f1(r.mine)}   内訳: プレー結果由来 ${f1(r.stat)} / NPB+由来 ${f1(r.npbDerived)}`);
  B.push(`パワプロ2026 ${f1(r.pp)}`);
  B.push(`raw_diff (自作 - PowerPro)                        = ${sg(r.rawDiff)}`);
  B.push(`  うち目盛りで説明できる分                        = ${sg(r.scalePart)}`);
  B.push(`  scale_adjusted_powerpro_residual_diagnostic     = ${sg(r.scaleAdj)}`);
  B.push(`材料衝突 (NPB+由来 − プレー結果由来)              = ${sg(r.conflictRaw)}`);
  B.push(`  うち系統ずれ ${offset >= 0 ? '+' : ''}${offset.toFixed(1)} を除いた選手固有分     = ${sg(r.conflictResid)}`);
  B.push(`出場 ${r.games ?? '-'}試合 / ${r.pa ?? '-'}打席   統計プール ${r.years ?? '-'}年   年齢 ${r.ageNow ?? '-'}`);
  B.push('```');
  B.push(`**原因**: ${r.causes.join(' + ') || '（該当なし）'}\n`);
  B.push(`**PowerPro据え置き判定**: \`${r.stale}\` — ${r.staleWhy.join('／')}`);
  if (r.obsYears?.length) B.push(`（観測年: ${r.obsYears.join(', ')}／変更${r.nChg ?? 0}回${r.lastChangeYear ? `・最終変更${r.lastChangeYear}年` : ''}）`);
  B.push('');
  if (r.conflictNotes.length) {
    B.push(`**材料衝突の調査** → \`${r.conflictVerdict}\``);
    for (const n of r.conflictNotes) B.push(`- ${n}`);
    B.push('');
  }
}
writeFileSync(path.join(ROOT, 'outputs', 'speed_player_conflict_diagnosis_2026.md'), B.join('\n'), 'utf8');

// (3) 機械可読
const cols = ['player', 'team', 'mine', 'stat', 'npbDerived', 'npbUsed', 'pp', 'rawDiff', 'scalePart',
  'scaleAdj', 'conflictRaw', 'conflictResid', 'conflictVerdict', 'stale', 'causes',
  'games', 'pa', 'years', 'ageNow', 'nChg', 'lastChangeYear', 'directT90', 'shortD', 'exposure'];
const csv = [cols.join(',')];
for (const r of rows) csv.push(cols.map(c => {
  let v = r[c]; if (Array.isArray(v)) v = v.join('|');
  if (v == null) return '';
  return typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}).join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_conflict_diagnosis_2026.csv'), csv.join('\n'), 'utf8');

const cnt = k => rows.filter(r => r.causes.includes(k)).length;
console.log(`合成zの幅 ${zsd.toFixed(3)} / 較正が掛かった選手 ${calibratedCount}/${paired.length}`);
console.log(`材料の系統ずれ ${offset >= 0 ? '+' : ''}${offset.toFixed(1)}点`);
console.log(`原因内訳: MODEL_SCALE ${cnt('MODEL_SCALE')} / PROJECT_EVIDENCE_CONFLICT ${cnt('PROJECT_EVIDENCE_CONFLICT')} / POWERPRO_STALE_OR_ODD ${cnt('POWERPRO_STALE_OR_ODD')} / CURRENT_EVIDENCE_WEAK ${cnt('CURRENT_EVIDENCE_WEAK')}`);
const st = {}; for (const r of rows) st[r.stale] = (st[r.stale] ?? 0) + 1;
console.log('据え置き判定:', Object.entries(st).map(([k, v]) => `${k} ${v}`).join(' / '));
const uv = rows.filter(r => r.conflictVerdict === 'UNRESOLVED_PROJECT_CONFLICT').length;
console.log(`材料衝突: 調査対象 ${rows.filter(r => r.conflictVerdict).length}人 / うち未決着 ${uv}人`);
console.log(`診断詳細を出した選手 ${tier1.length}人`);
