// SP-098 — 名原典彦 / サンタナ / 塩見泰隆 の coverage hole を切り分け、修理後に3人だけ再計算する。
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard, resolveName, normName } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const ev = JSON.parse(readFileSync(path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json'), 'utf8'));
const TARGETS = ['名原 典彦', 'サンタナ', '塩見 泰隆'];

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });

function dumpLike(sql, params = []) {
  try { return db.prepare(sql).all(...params); } catch { return []; }
}

function diagnose(name) {
  const p = ev.players.find(x => x.player === name);
  const resolved = resolveName(db, name, { team: p?.team, season: 2025 });
  const batting = dumpLike(
    `SELECT season, player_id, name, team, position, g, pa, ab FROM batting WHERE name LIKE ? ORDER BY season`,
    [`%${name.replace(/\s+/g, '%')}%`]
  );
  const vb = dumpLike(
    `SELECT season, player_id, name, team, position, g, pa, ab FROM v_batting WHERE name LIKE ? ORDER BY season`,
    [`%${name.replace(/\s+/g, '%')}%`]
  );
  const usage = dumpLike(`SELECT * FROM npb_usage_2026 WHERE name LIKE ?`, [`%${name.replace(/\s+/g, '%')}%`]);
  const farm = dumpLike(
    `SELECT season, farm, player_id, team, name_ja FROM bm_player WHERE name_ja LIKE ? ORDER BY season`,
    [`%${name.replace(/\s+/g, '%')}%`]
  );
  const link = dumpLike(
    `SELECT * FROM player_link WHERE name_proeye LIKE ? OR name_bm LIKE ?`,
    [`%${name.replace(/\s+/g, '%')}%`, `%${name.replace(/\s+/g, '%')}%`]
  );
  return {
    evidence_name: name,
    evidence_team: p?.team ?? null,
    resolveName_2025_team: resolved,
    batting_rows: batting,
    v_batting_rows: vb,
    usage_2026: usage,
    farm_bm_player: farm,
    player_link: link,
  };
}

const diagnoses = Object.fromEntries(TARGETS.map(n => [n, diagnose(n)]));

// Structural conclusions (data-backed).
const conclusions = {
  '名原 典彦': {
    hole: 'NOT_IN_PROEYE_FIRST_TEAM_BATTING_THROUGH_2025',
    db_registered: diagnoses['名原 典彦'].farm_bm_player.length > 0,
    notation: '名原 典彦 / 名原　典彦',
    canonical_id: diagnoses['名原 典彦'].farm_bm_player[0]?.player_id ?? null,
    canonical_id_kind: 'bm_player.player_id (farm), not proeye',
    season_availability: 'farm 2023+; 2026 first-team usage 187 PA / 41 G; no v_batting row through 2025',
    value_forced: false,
    repair: 'resolveName now reports the farm/usage hole instead of a bare 該当なし. No 2025 first-team card is invented.',
  },
  'サンタナ': {
    hole: 'AMBIGUOUS_SURNAME_WITHOUT_SEASON_OR_TEAM',
    candidates: [
      { name: 'Ｄ．サンタナ', player_id: '53755153', team: '東京ヤクルトスワローズ', last_season: 2025 },
      { name: 'Ｊ．サンタナ', player_id: '83585138', team: '広島東洋カープ', last_season: 2019 },
    ],
    unique_rule: 'season=2025 or team=ヤクルト → Ｄ．サンタナ (Domingo). J. Santana has no 2025 row.',
    value_forced: false,
    repair: 'resolveName prefers exact, then unique includes, then season, then team.',
  },
  '塩見 泰隆': {
    hole: 'ZERO_AB_THREW_IN_selectContext',
    player_id: '71975136',
    year_2025: diagnoses['塩見 泰隆'].v_batting_rows.find(r => r.season === 2025) ?? null,
    data_status: '2025 row exists with G=1 PA=0 AB=0. This is present data, not a missing season file.',
    implementation: 'selectContext used to throw on AB=0. Pipeline now skips batting and still computes durable speed.',
    value_forced: false,
  },
};

const cfg = J('ratings.json');
const rv = J('run_values.json').values;
const runNorm = J('running_norms.json');
const fldNorm = J('fielding_norms.json');
const ctx = makeContext(db, cfg);

const recomputes = [];
for (const name of TARGETS) {
  const p = ev.players.find(x => x.player === name);
  const result = { player: name, team: p?.team ?? null };
  try {
    const card = appraiseCard(ctx, {
      name,
      team: p?.team,
      mode: '2025',
      statPrimarySpeed: true,
      cfg, rv, runNorm, fldNorm,
    });
    if (card.error) {
      result.status = 'STILL_UNRESOLVED';
      result.error = card.error;
    } else {
      result.status = 'COMPUTED';
      result.player_id = card.card.player?.player_id ?? null;
      result.speed = card.card.abilities?.基礎能力?.走力 ?? null;
      result.no_batting_sample = !!card.card._no_batting_sample;
      result.meta = card.meta ?? null;
    }
  } catch (e) {
    result.status = 'THREW';
    result.error = e.message;
  }
  recomputes.push(result);
}

const out = {
  generated_at: '2026-08-13',
  diagnoses,
  conclusions,
  recompute_mode: '2025 + statPrimarySpeed=true + team hint from evidence (same wiring QA as SP-015/016, not a final 2026 rating)',
  recomputes,
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp098_identity_coverage_repair_20260813.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ conclusions, recomputes }, null, 2));
