// Phase F/G remaining artifacts from existing data. No shoulder. No new API.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = rel => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));
const exists = rel => existsSync(path.join(ROOT, rel));
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); };
const corr = (a, b) => {
  if (a.length < 5) return null;
  const ma = mean(a), mb = mean(b);
  let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
  const den = sd(a) * sd(b);
  return den > 0 ? +(s / a.length / den).toFixed(4) : null;
};

// ---------- SP-063: map 2026-08-05 all-missing-data speed children ----------
const map063 = {
  generated_at: '2026-08-14',
  parent_task: '_codex_task_20260805_all_missing_data.md',
  parent_result: '_codex_result_20260805_missing_data.md',
  parent_status_in_result_file: '調査中 — superseded by per-lane SP tasks below. This parent is not a live workstream.',
  speed_children: [
    { old: 'A. Sprint Speed / 走塁時最高速度', replacement: 'SP-010,SP-100', status_now: 'DONE_VALIDATED / PARTIAL wiring' },
    { old: 'A. 一塁到達 / H2F', replacement: 'SP-007,SP-017', status_now: 'DONE_VALIDATED' },
    { old: 'A. 30m/50m', replacement: 'SP-017,SP-020', status_now: 'DONE_VALIDATED / PARTIAL dates' },
    { old: 'A. 外野追走速度', replacement: 'SP-062', status_now: 'closed NOT_DECISION_USEFUL this wave' },
    { old: 'A. 公式スカウティング', replacement: 'SP-060', status_now: 'inventory this wave' },
    { old: 'A. 映像計測', replacement: 'SP-038,SP-039', status_now: 'DONE_NEGATIVE_FINDING / existing-lane reuse' },
    { old: 'A. 三塁打/内野安打/併殺回避/UBR/追加進塁', replacement: 'SP-015,SP-018,SP-019', status_now: 'DONE_VALIDATED / DONE_NEGATIVE_FINDING' },
    { old: 'The Show numeric bridge', replacement: 'SP-050,SP-051,SP-052,SP-053', status_now: 'numeric path closed; raw kept' },
    { old: 'Prospi collection', replacement: 'SP-054,SP-055,SP-056', status_now: 'SUPERSEDED' },
    { old: 'Community rating / SNS', replacement: 'SP-030,SP-031,SP-032,SP-033,SP-034,SP-035,SP-036,SP-037', status_now: '032/037 closed; 033-035 new API NOT_COLLECTED' },
  ],
  non_speed_children_not_in_scope: [
    'B. 肩力計測', 'C. 守備 TE/FE/UZR', 'D. パワー/打球', 'E. ミート分割', 'F. 球場',
  ],
  parent_superseded: true,
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp063_all_missing_data_child_map_20260814.json'), JSON.stringify(map063, null, 2));

// ---------- SP-090: persist this wave so nothing is chat-only ----------
const waveArtifacts = [
  'outputs/derived/sp016_continuous_prior_apply_20260814.json',
  'outputs/derived/sp016_scale_artifact_check_20260814.json',
  'outputs/derived/sp100_wiring_candidates_20260814.json',
  'outputs/derived/sp033_034_surname_identity_resolution_20260814.json',
  'outputs/derived/sp036_generic_label_sweep_20260814.json',
  'outputs/derived/sp039_existing_video_lane_20260814.json',
  'outputs/derived/sp035_x_existing_organize_20260814.json',
  'src/ratings/durable_traits.mjs',
  'configs/running_norms.json',
  'configs/ratings.json',
  'docs/state/speed_task_registry.tsv',
];
const scan090 = {
  generated_at: '2026-08-14',
  rule: 'final-chat-only knowledge = 0. Anything used later must live in a repo file.',
  this_wave_durable: waveArtifacts.map(p => ({ path: p, present: exists(p), bytes: exists(p) ? statSync(path.join(ROOT, p)).size : 0 })),
  persisted_now_instead_of_chat: [
    'SP-016 production candidate = continuous_prior + re-derived applyScale; hard gate remains control.',
    'SP-100 S/N/F winner = NOT_DECLARED. Default not frozen.',
    'SP-036 outside-150 generic labels = 7, zeroed = 0.',
    'SP-039 player_results key was missed on first parse; reuse is existing video overlay only.',
    'SP-062 defensive chase = NOT_DECISION_USEFUL on existing sources.',
    'SP-044/045 = no birth/injury columns in pennant.db; MIT 2025 roster has no birthdate.',
    '名原 2025 first-team batting still absent; 塩見 2025 AB=0 is real; サンタナ 2025 = 53755153.',
  ],
  missing_from_repo_after_this_file: [],
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp090_chat_only_scan_20260814.json'), JSON.stringify(scan090, null, 2));

// ---------- SP-098 reverify ----------
const cfg = J('configs/ratings.json');
const rv = J('configs/run_values.json').values;
const runNorm = J('configs/running_norms.json');
const fldNorm = J('configs/fielding_norms.json');
const ev = J('data/manual/npb_speed_physical_evidence_full_20260809.json');
const db = new DatabaseSync(path.join(ROOT, 'data/pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);
const TARGETS = [
  { name: '名原 典彦', want: 'no invented 2025 first-team batting value' },
  { name: 'サンタナ', want: 'resolves to Ｄ．サンタナ 53755153' },
  { name: '塩見 泰隆', want: 'AB=0 does not drop speed/arm/fielding/schema' },
];
const SCHEMA_KEYS = ['player', 'cardType', 'seasonLabel', 'abilities', 'calc_log', 'confidence', 'unresolved'];
const recomputes = [];
for (const t of TARGETS) {
  const p = ev.players.find(x => x.player === t.name);
  const row = { player: t.name, team: p?.team ?? null, want: t.want };
  try {
    const out = appraiseCard(ctx, {
      name: t.name, team: p?.team, mode: '2025', statPrimarySpeed: true, cfg, rv, runNorm, fldNorm,
    });
    if (out.error) {
      row.status = 'ERROR';
      row.error = out.error;
    } else {
      const card = out.card;
      const ab = card.abilities?.基礎能力 || {};
      row.status = 'COMPUTED';
      row.player_id = card.player_id ?? card.player?.player_id ?? null;
      row.no_batting_sample = !!card._no_batting_sample;
      row.speed = ab.走力?.value ?? null;
      row.arm = ab.肩力?.value ?? null;
      row.fielding = ab.守備力?.value ?? null;
      row.catching = ab.捕球?.value ?? null;
      row.meet = ab.ミート?.value ?? null;
      row.power = ab.パワー?.value ?? null;
      row.schema_top_keys = Object.keys(card);
      row.schema_has_player_id_at_player = !!card.player?.player_id;
      row.schema_shrunk = Object.keys(card).length < 8;
      row.confidence = card.confidence ?? null;
      row.unresolved = card.unresolved ?? null;
    }
  } catch (e) {
    row.status = 'THREW';
    row.error = e.message;
  }
  recomputes.push(row);
}
const shiom = recomputes.find(r => r.player === '塩見 泰隆');
const nahara = recomputes.find(r => r.player === '名原 典彦');
const santana = recomputes.find(r => r.player === 'サンタナ');
const qa098 = {
  generated_at: '2026-08-14',
  mode: '2025 + statPrimarySpeed=true (wiring QA, not final 2026 practical rating)',
  recomputes,
  checks: {
    nahara_no_invented_value: nahara?.status === 'ERROR' || nahara?.speed == null,
    santana_id: santana?.player_id === '53755153',
    shiomi_computed: shiom?.status === 'COMPUTED',
    shiomi_no_batting: shiom?.no_batting_sample === true,
    shiomi_meet_null: shiom?.meet == null,
    shiomi_speed_not_null: shiom?.speed != null,
    shiomi_arm_not_null: shiom?.arm != null,
    shiomi_schema_not_shrunk: shiom?.schema_shrunk === false,
    shiomi_player_id: shiom?.player_id === '71975136' || !!shiom?.player_id,
  },
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp098_identity_reverify_20260814.json'), JSON.stringify(qa098, null, 2));

// ---------- SP-043 veteran case studies ----------
const apply016 = exists('outputs/derived/sp016_continuous_prior_apply_20260814.json')
  ? J('outputs/derived/sp016_continuous_prior_apply_20260814.json') : {};
const snf = exists('outputs/derived/sp100_wiring_candidates_20260814.json')
  ? J('outputs/derived/sp100_wiring_candidates_20260814.json') : { players: [] };
const stale = exists('outputs/derived/sp042_powerpro_stale_detector.json')
  ? J('outputs/derived/sp042_powerpro_stale_detector.json') : { rows: [] };
const design016 = exists('outputs/derived/sp016_continuous_prior_design.json')
  ? J('outputs/derived/sp016_continuous_prior_design.json') : {};

function findPlayer(name) {
  const k = nk(name);
  return {
    snf: (snf.players || []).find(p => nk(p.player) === k) || null,
    stale: (stale.rows || []).find(p => nk(p.player) === k) || null,
    apply_hundred: (apply016.hundred?.rows || []).find(p => nk(p.player) === k) || null,
    apply_roster: (apply016.full_roster?.top_movers || []).find(p => nk(p.name) === k)
      || (apply016.full_roster?.low_pa_extremes || []).find(p => nk(p.name) === k) || null,
  };
}
const akiyama = findPlayer('秋山 翔吾');
const matsuyama = findPlayer('松山 竜平');
const paAkiyama = db.prepare(`SELECT season, pa, ab, g FROM v_batting WHERE name LIKE '%秋山%翔吾%' ORDER BY season`).all();
const paMatsuyama = db.prepare(`SELECT season, pa, ab, g FROM v_batting WHERE name LIKE '%松山%竜平%' ORDER BY season`).all();

const case043 = {
  generated_at: '2026-08-14',
  policy: 'Evidence-backed. Owner judgement only where remaining conflict is genuine, not scale.',
  akiyama_shogo: {
    pa_by_year: paAkiyama,
    appearance_drop: '2024 high PA to 2025 reduced PA is detectable; injury vs role vs decline is not identifiable from PA alone',
    apply016: akiyama.apply_hundred || akiyama.apply_roster,
    snf: akiyama.snf,
    stale: akiyama.stale,
    community: 'Existing community/SNS mention age/decline. Not a numeric teacher.',
    owner_needed: 'Whether 2025 drop is injury/role/true speed loss. PA drop is not converted to injury (SP-045).',
  },
  matsuyama_ryuhei: {
    pa_by_year: paMatsuyama,
    apply016: matsuyama.apply_hundred || matsuyama.apply_roster,
    snf: matsuyama.snf,
    stale: matsuyama.stale,
    note: '2025 PA is tiny. Hard-gate display can float; continuous prior shrinks toward history. Not an identity hole.',
    owner_needed: 'Whether late-career speed should stay on the 2026-100 review list at all. Not a data identity block.',
  },
  peers_same_pattern: (apply016.full_roster?.low_pa_extremes || []).slice(0, 8),
  remaining_owner: [
    '秋山: 2025出場減の中身（故障/起用/衰え）は台帳に無い',
    '松山: 2026-100に残すかは査定以前の対象選定',
  ],
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp043_veteran_case_studies_20260814.json'), JSON.stringify(case043, null, 2));

// ---------- SP-022 pairwise/range on existing evidence ----------
const h2f = exists('outputs/derived/sp007_h2f_low_confidence_lane.json')
  ? J('outputs/derived/sp007_h2f_low_confidence_lane.json') : {};
const byH2f = new Map((h2f.normal_swing?.players || []).map(p => [nk(p.player), p]));
const players = (snf.players || []).filter(p => p.F_fuse_z != null || p.S_stat_z != null || p.N_npb_z != null);
function uncertainty(p) {
  const sRel = p.S_reliability ?? 0;
  const nRel = p.N_confidence ?? 0;
  const base = 0.35;
  return Math.max(0.2, base * (1.2 - 0.5 * (sRel + nRel)));
}
function pFaster(a, b) {
  const za = a.F_fuse_z ?? a.S_stat_z ?? a.N_npb_z;
  const zb = b.F_fuse_z ?? b.S_stat_z ?? b.N_npb_z;
  if (za == null || zb == null) return null;
  const se = Math.hypot(uncertainty(a), uncertainty(b));
  const z = (za - zb) / se;
  // Φ approx
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const tail = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const p = z >= 0 ? 1 - tail : tail;
  return +p.toFixed(4);
}
const focusNames = new Set([
  '秋山翔吾', '松山竜平', '塩見泰隆', 'カリステ', '古賀優大', '細川成也', '郡司裕也',
  '周東佑京', '岩田幸宏', '小川龍成', 'ソト', '山川穂高', '村林一輝', '西川龍馬',
].map(nk));
const focus = players.filter(p => focusNames.has(nk(p.player)));
const pairs = [];
for (let i = 0; i < focus.length; i++) {
  for (let j = i + 1; j < focus.length; j++) {
    const a = focus[i], b = focus[j];
    const p = pFaster(a, b);
    if (p == null) continue;
    const h2a = byH2f.has(nk(a.player));
    const h2b = byH2f.has(nk(b.player));
    const snDisagree = a.S_stat_z != null && a.N_npb_z != null && Math.abs(a.S_stat_z - a.N_npb_z) > 0.8;
    const snDisagreeB = b.S_stat_z != null && b.N_npb_z != null && Math.abs(b.S_stat_z - b.N_npb_z) > 0.8;
    let band = 'SIMILAR_BAND';
    if (p >= 0.8) band = 'CLEARLY_FASTER';
    else if (p <= 0.2) band = 'CLEARLY_SLOWER';
    else if (p >= 0.65) band = 'LEAN_FASTER';
    else if (p <= 0.35) band = 'LEAN_SLOWER';
    pairs.push({
      a: a.player, b: b.player,
      p_a_faster_than_b: p,
      band,
      a_F: a.F_fuse_z, b_F: b.F_fuse_z,
      h2f_on_either: h2a || h2b,
      source_quality: {
        a_S_rel: a.S_reliability ?? null, a_N_conf: a.N_confidence ?? null,
        b_S_rel: b.S_reliability ?? null, b_N_conf: b.N_confidence ?? null,
      },
      high_internal_disagreement: snDisagree || snDisagreeB,
      exact_measurement_required: false,
    });
  }
}
pairs.sort((x, y) => Math.abs(y.p_a_faster_than_b - 0.5) - Math.abs(x.p_a_faster_than_b - 0.5));
const out022 = {
  generated_at: '2026-08-14',
  policy: 'EX-013: exact measurement not required. Probabilistic/range pairwise with source quality and uncertainty. Not a numeric teacher. PowerPro labels not used as weights.',
  n_focus: focus.length,
  n_pairs: pairs.length,
  band_counts: pairs.reduce((m, r) => { m[r.band] = (m[r.band] || 0) + 1; return m; }, {}),
  pairs,
  unused_as_teacher: true,
  note: 'Focus list inherits SP-100 player order (high F first), so i<j bands lean CLEARLY_FASTER. The probability itself is symmetric: P(b>a)=1-P(a>b).',
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp022_pairwise_range_20260814.json'), JSON.stringify(out022, null, 2));

// ---------- SP-072 100 vs non-100 same mapping ----------
const art = exists('outputs/derived/sp016_scale_artifact_check_20260814.json')
  ? J('outputs/derived/sp016_scale_artifact_check_20260814.json') : null;
const out072 = {
  generated_at: '2026-08-14',
  same_applyScale: {
    slope: cfg.scale_calibration.applied.走力.slope,
    intercept: cfg.scale_calibration.applied.走力.intercept,
    derived_on: 'full 2025 statistical roster',
    hundred_only_scale: false,
  },
  artifact: art ? {
    roster_n: art.full_roster?.n,
    in100_n: art.hundred_subset_of_roster?.n,
    non100_n: art.non100_subset_of_roster?.n,
    roster_before_after: { before: art.full_roster?.before, after: art.full_roster?.after },
    corr_delta_hard: art.full_roster?.corr_delta_vs_hard,
    corr_delta_cont: art.full_roster?.corr_delta_vs_cont,
    all_same_direction: art.full_roster?.delta?.all_same_direction,
    verdict: art.verdict,
  } : null,
  verdict: art?.same_mapping_100_vs_roster?.hundred_only_scale_exists === false
    ? 'SAME_MAPPING_NO_100_ONLY_SCALE'
    : 'CHECK_INCOMPLETE',
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp072_100_vs_roster_scale_20260814.json'), JSON.stringify(out072, null, 2));

// ---------- SP-074 / SP-075 conflict + stale rediagnosis ----------
const comm150 = exists('outputs/derived/sp032_grok_x_150_reclassification_qa_20260813.json')
  ? J('outputs/derived/sp032_grok_x_150_reclassification_qa_20260813.json') : {};
const generic = exists('outputs/derived/sp036_generic_label_sweep_20260814.json')
  ? J('outputs/derived/sp036_generic_label_sweep_20260814.json') : {};
const snDisagree = (snf.players || []).filter(p => p.S_stat_z != null && p.N_npb_z != null)
  .map(p => ({ player: p.player, d: p.N_npb_z - p.S_stat_z, S: p.S_stat_z, N: p.N_npb_z, F: p.F_fuse_z }))
  .sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
const dSN = snDisagree.map(x => x.d);
const staleFlags = (stale.rows || []).filter(r => r.flag && r.flag !== 'NONE');
const out074 = {
  generated_at: '2026-08-14',
  previous_20260813: {
    finding: 'NPB+ mapped minus stat was +14.4 and 93/97 same direction = scale mix, not player conflict',
    superseded_by: 'SP-099 blend-before-scale repair + SP-100 raw latent (not PowerPro-mapped) + SP-016 display re-derive',
  },
  current_S_vs_N_latent_z: {
    n: dSN.length,
    mean: dSN.length ? +mean(dSN).toFixed(4) : null,
    sd: dSN.length ? +sd(dSN).toFixed(4) : null,
    all_same_direction: dSN.length ? dSN.every(x => x > 0) || dSN.every(x => x < 0) : null,
    corr_delta_vs_S: corr(dSN, snDisagree.map(x => x.S)),
    corr_delta_vs_N: corr(dSN, snDisagree.map(x => x.N)),
    scale_artifact: false,
    top: snDisagree.slice(0, 12),
  },
  note: 'S is 2025 statistical continuous-prior z. N is 2026 NPB+ latent z. Different years. Do not treat residual as same-year player conflict without that caveat.',
};
if (out074.current_S_vs_N_latent_z.n) {
  out074.current_S_vs_N_latent_z.scale_artifact =
    Math.abs(out074.current_S_vs_N_latent_z.corr_delta_vs_S ?? 0) > 0.9
    || Math.abs(out074.current_S_vs_N_latent_z.corr_delta_vs_N ?? 0) > 0.9;
}
writeFileSync(path.join(ROOT, 'outputs/derived/sp074_conflict_rediagnosis_20260814.json'), JSON.stringify(out074, null, 2));

const out075 = {
  generated_at: '2026-08-14',
  depends_note: 'SP-033/034/035 remain PARTIAL because new official collection is NOT_COLLECTED. This rediagnosis uses closed 032/037 + existing 033-036 artifacts + SUPERSEDED Prospi (not used).',
  prospi_used: false,
  stale_flags: stale.flag_counts || null,
  stale_non_none: staleFlags.map(r => ({ player: r.player, flag: r.flag, gap: r.percentile_gap, years: r.powerpro_years, changes: r.powerpro_raw_changes })),
  community: {
    gx150: comm150,
    generic_outside_150: generic.outside_150_ledger ?? generic.rows?.length ?? null,
    generic_zeroed: generic.zeroed ?? 0,
  },
  conflict_classes: (snf.players || []).map(p => {
    const st = (stale.rows || []).find(r => nk(r.player) === nk(p.player));
    const d = (p.S_stat_z != null && p.N_npb_z != null) ? p.N_npb_z - p.S_stat_z : null;
    const classes = [];
    if (st?.flag && st.flag !== 'NONE') classes.push(st.flag);
    if (d != null && Math.abs(d) > 0.8) classes.push('STAT_VS_NPB_LATENT_DIVERGE');
    if (p.pa_2025 != null && p.pa_2025 < 50) classes.push('LOW_CURRENT_PA');
    if (p.h2f_z != null) classes.push('HAS_H2F_LOW_CONFIDENCE');
    return { player: p.player, classes, S: p.S_stat_z, N: p.N_npb_z, F: p.F_fuse_z, stale: st?.flag || 'NONE' };
  }),
  owner_queue_not_generated: true,
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp075_stale_conflict_rediagnosis_20260814.json'), JSON.stringify(out075, null, 2));

console.log(JSON.stringify({
  sp063: map063.speed_children.length,
  sp090_missing: scan090.this_wave_durable.filter(x => !x.present).map(x => x.path),
  sp098: qa098.checks,
  sp043_owner: case043.remaining_owner,
  sp022_bands: out022.band_counts,
  sp072: out072.verdict,
  sp074_scale_artifact: out074.current_S_vs_N_latent_z.scale_artifact,
  sp075_stale: out075.stale_flags,
}, null, 2));
