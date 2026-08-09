// Assemble target-season evidence for the T90 speed model.
//
// Pure functions only: callers load DB/manual files and pass records in.
// Key rules:
// - use year-level physical observations, not a multi-year average detached from the target season;
// - measurement type (Tier) and time gap are separate axes;
// - physical observations 5+ years away remain historical evidence but do not automatically drive T90
//   until an age/trajectory model is calibrated;
// - single-event home-to-first records are QA only, never disguised as season-average H->1.
// - NPB+ officially calls its running metric "Sprint Speed". The local DB column `top_speed_kmh`
//   is retained as a storage compatibility detail; evidence uses `npb_plus_sprint_speed_kmh` as the
//   canonical name and also emits the old key temporarily for model compatibility.

import { describeSpeedEvidenceTime } from './speed_temporal.mjs';

const finite = Number.isFinite;
const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

export function parseMlbSprintDetail(detail) {
  if (!detail) return [];
  try {
    const d = typeof detail === 'string' ? JSON.parse(detail) : detail;
    return (d?.sprint_speed ?? []).map(x => ({
      year: Number(x?.year),
      sprint_speed_ftps: Number(x?.sprint_speed),
      hp_to_1b_avg_sec: finite(Number(x?.hp_to_1b)) ? Number(x.hp_to_1b) : null,
    })).filter(x => finite(x.year) && finite(x.sprint_speed_ftps));
  } catch { return []; }
}

export function closestYearObservation(observations, targetSeason) {
  if (!Array.isArray(observations) || !finite(targetSeason)) return null;
  const a = observations.filter(x => finite(x?.year));
  if (!a.length) return null;
  const minGap = Math.min(...a.map(x => Math.abs(x.year - targetSeason)));
  const tied = a.filter(x => Math.abs(x.year - targetSeason) === minGap);
  if (tied.length === 1) return tied[0];
  // Deterministic tie-break: prefer the earlier measurement for a target exactly between two years.
  // Do not average across years silently.
  return [...tied].sort((x, y) => x.year - y.year)[0];
}

/** Build MLB Sprint evidence from mlb_bridge.detail. */
export function buildMlbSprintEvidence(bridgeRow, targetSeason, temporalConfig = null) {
  const obs = closestYearObservation(parseMlbSprintDetail(bridgeRow?.detail), targetSeason);
  if (!obs) return { evidence: {}, metadata: null };
  const temporal = describeSpeedEvidenceTime(obs.year, targetSeason, temporalConfig, {
    measuredValue: obs.sprint_speed_ftps,
  });
  const usable = temporal.gap_years != null && temporal.gap_years <= 4;
  return {
    evidence: usable ? {
      mlb_sprint_speed_ftps: obs.sprint_speed_ftps,
      // Season-average MLB H->1 is allowed as contextual evidence only when actually present.
      ...(finite(obs.hp_to_1b_avg_sec) ? {
        hp_to_1b_avg_sec: obs.hp_to_1b_avg_sec,
        hp_to_1b_condition: 'season_average_mlb_statcast',
      } : {}),
    } : {},
    metadata: {
      source: 'MLB Statcast',
      measured_year: obs.year,
      target_season: targetSeason,
      sprint_speed_ftps: obs.sprint_speed_ftps,
      hp_to_1b_avg_sec: obs.hp_to_1b_avg_sec,
      temporal,
      auto_t90_usable: usable,
      historical_only: !usable,
      reason: usable ? null : '査定年から5年以上離れるため、age/trajectory model確定まで自動T90推定には使わない',
    },
  };
}

function npbPlusSeason(row) {
  const m = String(row?.season_label ?? '').match(/(20\d\d)/);
  return m ? Number(m[1]) : null;
}

/**
 * Build NPB+ Sprint Speed evidence.
 *
 * Official NPB+ naming is Sprint Speed / スプリントスピード. Existing snapshots store the value
 * in `top_speed_kmh`; a future importer may store `sprint_speed_kmh`. Both are accepted here.
 * The public NPB+ material does not establish that its formula/window/aggregation is numerically
 * identical to MLB Statcast Sprint Speed, so this function does not mark cross-system equivalence.
 */
export function buildNpbPlusEvidence(row, targetSeason, temporalConfig = null) {
  const year = npbPlusSeason(row);
  const sprintSpeedKmh = finite(row?.sprint_speed_kmh) ? row.sprint_speed_kmh : row?.top_speed_kmh;
  if (!row || !finite(sprintSpeedKmh) || !finite(year)) return { evidence: {}, metadata: null };
  const temporal = describeSpeedEvidenceTime(year, targetSeason, temporalConfig, {
    measuredValue: sprintSpeedKmh,
  });
  const usable = temporal.gap_years != null && temporal.gap_years <= 4;
  return {
    evidence: usable ? {
      npb_plus_sprint_speed_kmh: sprintSpeedKmh,
      // Temporary compatibility alias. New calibration/model work should use the canonical key above.
      npb_plus_top_speed_kmh: sprintSpeedKmh,
    } : {},
    metadata: {
      source: 'NPB+', measured_year: year, target_season: targetSeason,
      metric_name: 'Sprint Speed',
      sprint_speed_kmh: sprintSpeedKmh,
      legacy_storage_field: finite(row?.sprint_speed_kmh) ? null : 'top_speed_kmh',
      legacy_evidence_alias_emitted: usable,
      public_formula_equivalent_to_mlb_statcast_verified: false,
      cross_system_numeric_equivalence_assumed: false,
      // Fastest H->1 is deliberately metadata only. Never place it into model evidence.
      hp_to_1b_fastest_sec: finite(row.hp_to_1b_sec) ? row.hp_to_1b_sec : null,
      temporal,
      auto_t90_usable: usable,
      historical_only: !usable,
      fastest_hp1b_excluded_from_model: true,
    },
  };
}

/** Select the closest curated 30m physical test. Protocol remains a separate issue. */
export function buildSprint30Evidence(records, playerName, targetSeason, temporalConfig = null) {
  const key = norm(playerName);
  const a = (records ?? []).filter(r => norm(r.player) === key && finite(r.seconds_30m));
  if (!a.length) return { evidence: {}, metadata: null };
  const withYear = a.filter(r => finite(r.season));
  const chosen = withYear.length ? closestYearObservation(withYear.map(r => ({ ...r, year: r.season })), targetSeason) : a[0];
  const year = finite(chosen.season) ? chosen.season : null;
  const temporal = year != null
    ? describeSpeedEvidenceTime(year, targetSeason, temporalConfig, { measuredValue: chosen.seconds_30m })
    : null;
  const usableByTime = temporal?.gap_years != null && temporal.gap_years <= 4;
  // Curated team 30m tests are Tier D by default because timing/start protocol is usually unknown.
  // Even with a calibrated sprint30_to_t90 protocol bridge, a 5+ year-old measurement must not
  // automatically drive the target season until an age/trajectory model exists.
  return {
    evidence: usableByTime ? { sprint_30m_sec: chosen.seconds_30m } : {},
    metadata: {
      source: chosen.source_name ?? 'curated 30m',
      measured_year: year,
      target_season: targetSeason,
      seconds_30m: chosen.seconds_30m,
      protocol_class: chosen.protocol_class ?? 'unknown',
      temporal,
      tier: 'D',
      auto_t90_usable: usableByTime,
      historical_only: !usableByTime,
      reason: usableByTime ? null : (year == null
        ? '測定年不明のため、履歴証拠としてのみ保持'
        : '査定年から5年以上離れるため、age/trajectory model確定まで自動T90推定には使わない'),
      note: '距離はT90に近いがプロトコル不明。絶対秒数はsprint30_to_t90のprotocol較正なしに直接T90扱いしない。',
    },
  };
}

/**
 * Single-event H->1 records are kept for QA/context only.
 * This intentionally returns NO model evidence.
 */
export function contextualHp1bQa(records, playerName, targetSeason) {
  const key = norm(playerName);
  return (records ?? []).filter(r => norm(r.player) === key && (!finite(targetSeason) || r.season === targetSeason))
    .map(r => ({
      seconds: r.seconds ?? r.value ?? null,
      season: r.season ?? null,
      condition_class: r.condition_class ?? null,
      speed_use: r.speed_use ?? 'qa_only',
      source_name: r.source_name ?? null,
      note: '単発イベントの一塁到達。T90モデル入力にはしない。',
    }));
}

/** Merge physical evidence sources while preserving provenance metadata. */
export function buildTargetSpeedEvidence(args) {
  const {
    targetSeason, playerName,
    mlbBridgeRow = null, npbPlusRow = null,
    sprint30Records = [], hp1bRecords = [],
    temporalConfig = null,
    proxyEvidence = {},
  } = args ?? {};

  // Numerical temporal uncertainty is metric/unit-specific.
  // MLB Sprint Speed is ft/s; NPB+ Sprint Speed is km/h with an unpublished public formula; team 30m
  // is seconds under heterogeneous protocols. Never reuse MLB's ft/s variance for the other two metrics.
  const mlbTemporal = temporalConfig?.mlb_sprint_speed ?? null;
  const npbTemporal = temporalConfig?.npb_plus_sprint_speed ?? temporalConfig?.npb_plus_top_speed ?? null;
  const sprint30Temporal = temporalConfig?.sprint30 ?? null;

  const mlb = buildMlbSprintEvidence(mlbBridgeRow, targetSeason, mlbTemporal);
  const npb = buildNpbPlusEvidence(npbPlusRow, targetSeason, npbTemporal);
  const m30 = buildSprint30Evidence(sprint30Records, playerName, targetSeason, sprint30Temporal);
  return {
    evidence: { ...proxyEvidence, ...m30.evidence, ...mlb.evidence, ...npb.evidence },
    provenance: {
      mlb_sprint: mlb.metadata,
      npb_plus: npb.metadata,
      sprint30: m30.metadata,
      hp_to_1b_single_event_qa: contextualHp1bQa(hp1bRecords, playerName, targetSeason),
    },
  };
}
