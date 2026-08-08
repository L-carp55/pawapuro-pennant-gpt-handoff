// Thin production adapter: existing card appraisal -> T90 speed resolution.
//
// The large card pipeline remains untouched. This adapter applies the redesigned
// speed model at the card boundary, records why a fallback was used, and keeps the
// change easy to remove/review. Optional acceleration-profile research is NOT part
// of this production path.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appraiseCard, normName } from './pipeline.mjs';
import { toRank } from './ability_sheet.mjs';
import { buildTargetSpeedEvidence } from '../ratings/speed_evidence.mjs';
import { appraiseSpeedT90 } from '../ratings/speed_appraisal.mjs';
import { resolveProductionSpeed } from '../ratings/speed_production.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const finite = Number.isFinite;
const r1 = v => finite(v) ? Math.round(v * 10) / 10 : null;

const loadJson = rel => {
  try {
    const p = path.join(ROOT, rel);
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
  } catch { return null; }
};

const SPEED_MODELS = loadJson('configs/speed_t90_models.json') ?? { models: {} };
const SPEED_TEMPORAL = loadJson('configs/speed_t90_temporal.json') ?? {};
const SPRINT30 = loadJson('data/manual/sprint_30m_measurements_curated.json') ?? { records: [] };
const HP1B = loadJson('data/manual/hp_to_1b_measurements_curated.json') ?? { records: [] };

function loadFrozenReference() {
  for (const rel of ['outputs/derived/t90_npb_reference.json', 'configs/t90_npb_reference.json']) {
    const j = loadJson(rel);
    if (!j) continue;
    if (Array.isArray(j)) return { reference: j, source: rel };
    if (Array.isArray(j.reference_entries)) return { reference: j.reference_entries, source: rel };
    if (Array.isArray(j.reference_times)) return { reference: j.reference_times, source: rel };
    if (Array.isArray(j.t90_sec)) return { reference: j.t90_sec, source: rel };
  }
  return { reference: [], source: null };
}

const FROZEN_REFERENCE = loadFrozenReference();
const plusCache = new WeakMap();

function npbPlusMap(ctx) {
  if (plusCache.has(ctx)) return plusCache.get(ctx);
  const m = new Map();
  try {
    for (const r of ctx.db.prepare('SELECT * FROM npb_plus_measurement').all()) {
      if (r?.name) m.set(normName(r.name), r);
    }
  } catch { /* table is optional */ }
  plusCache.set(ctx, m);
  return m;
}

function bridgeRow(ctx, playerId) {
  try {
    return ctx.db.prepare('SELECT * FROM mlb_bridge WHERE proeye_id=?').get(playerId) ?? null;
  } catch { return null; }
}

function unresolvedT90(targetSeason, reason) {
  return {
    rating: null, t90_sec: null, tier: null, source: null,
    is_estimated: true, status: 'UNAPPRAISED_NO_T90', unresolved: reason,
    target_season: targetSeason,
  };
}

/** Same arguments/return shape as appraiseCard(), with production speed resolved at the end. */
export function appraiseCardT90(ctx, opts = {}) {
  const out = appraiseCard(ctx, opts);
  if (out?.error || !out?.card) return out;

  const card = out.card;
  const cfg = opts.cfg;
  const existingSpeed = card.abilities?.基礎能力?.走力 ?? null;
  const targetSeason = card.card_type === 'peak_single_year' && finite(Number(card.season_label))
    ? Number(card.season_label) : null;

  let built = { evidence: {}, provenance: {} };
  let t90 = unresolvedT90(targetSeason,
    targetSeason == null
      ? 'prime_compositeは複数年を含むため、T90 production v1では単年値へ自動置換しない'
      : 'T90 evidence assembly not run');

  if (targetSeason != null) {
    built = buildTargetSpeedEvidence({
      targetSeason,
      playerName: card.name_ja,
      mlbBridgeRow: bridgeRow(ctx, card.player_id),
      npbPlusRow: npbPlusMap(ctx).get(normName(card.name_ja)) ?? null,
      sprint30Records: SPRINT30.records ?? [],
      hp1bRecords: HP1B.records ?? [],
      temporalConfig: SPEED_TEMPORAL,
      // Production v1 deliberately does not add outcome proxies here. If no physical/contextual
      // evidence can produce T90, the resolver uses an explicit legacy fallback instead.
      proxyEvidence: {},
    });
    t90 = appraiseSpeedT90(built.evidence, SPEED_MODELS, FROZEN_REFERENCE.reference);
  }

  const resolved = resolveProductionSpeed({ t90Appraisal: t90, existingSpeed });
  const speedCell = resolved.value != null
    ? {
        ...(existingSpeed ?? {}),
        value: resolved.value,
        rank: toRank(resolved.value, cfg),
        speed_model_status: resolved.status,
        speed_model_source: resolved.source,
        t90_sec: resolved.t90_sec,
        provisional_speed: resolved.provisional,
        legacy_fallback: resolved.legacy_fallback,
        ...(resolved.status === 'T90_PRIMARY' ? { from_t90: true } : {}),
        _note: [existingSpeed?._note, resolved.note,
          resolved.legacy_fallback ? 'T90 production未較正部分を理由に旧走力を暫定使用。完成を止めず、改善タスクとして残す。' : null]
          .filter(Boolean).join(' '),
      }
    : null;

  if (card.abilities?.基礎能力) card.abilities.基礎能力.走力 = speedCell;
  if (card.ratings) card.ratings.speed = resolved.value;

  card.speed_model = {
    target: 'T90_90ft_physical_speed',
    production: resolved,
    t90_appraisal: {
      status: t90.status ?? null,
      rating: r1(t90.rating),
      t90_sec: t90.t90_sec ?? null,
      tier: t90.tier ?? null,
      source: t90.source ?? null,
      unresolved: t90.unresolved ?? null,
    },
    reference: {
      frozen_reference_loaded: FROZEN_REFERENCE.reference.length > 0,
      count: FROZEN_REFERENCE.reference.length,
      source: FROZEN_REFERENCE.source,
      candidate_reference_is_not_used: true,
    },
    evidence_keys: Object.keys(built.evidence ?? {}),
    provenance: built.provenance ?? {},
    _rule: 'T90 A-D > scouting > T90 Tier-E > explicit legacy fallback. Optional 30m/50m profile research cannot block production completion.',
  };

  card.calc_log ??= {};
  card.calc_log.speed_t90 = card.speed_model;

  if (resolved.legacy_fallback) {
    card.unresolved ??= [];
    const msg = '走力: T90 production経路は接続済みだが、較正済みT90または凍結NPB基準CDFが不足するため旧走力を暫定fallback。走塁・盗塁技術と完全分離した最終値への置換は改善タスク。';
    if (!card.unresolved.includes(msg)) card.unresolved.push(msg);
  }

  return { ...out, speedProduction: resolved, speedT90: t90, speedEvidence: built };
}
