// SP-052 option B only: same-player + same-year overlap census.
// No cross-time interpolation. Live/normal cards only.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]+/g, ' ').trim().toLowerCase();

function mlbNameToKey(name) {
  const s = String(name ?? '').trim();
  const m = s.match(/^([^,]+),\s*(.+)$/);
  if (m) return nk(`${m[2]} ${m[1]}`);
  return nk(s);
}

function editionYear(ed) {
  const m = String(ed).match(/(\d{2})\s*$/);
  return m ? 2000 + Number(m[1]) : null;
}

function median(xs) {
  const a = [...xs].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function band(speed, scale) {
  if (scale === 'show') {
    if (speed >= 80) return 'fast';
    if (speed >= 50) return 'mid';
    return 'slow';
  }
  if (speed >= 70) return 'fast';
  if (speed >= 45) return 'mid';
  return 'slow';
}

const ho = JSON.parse(readFileSync(path.join(ROOT, 'configs', 'holdout_mlb_bridge.json'), 'utf8'));
const sealed = new Set((ho.test_players ?? []).map(p => p.proeye_id).filter(Boolean));

// The Show Live hitters with speed.
const showRows = db.prepare(`
  SELECT edition, name, name_key, team, series, speed, uuid
  FROM the_show_rating
  WHERE is_hitter=1 AND speed IS NOT NULL AND series='Live'
`).all();
const showByKeyYear = new Map();
for (const r of showRows) {
  const y = editionYear(r.edition);
  if (!y) continue;
  const key = nk(r.name_key || r.name);
  const k = `${key}|${y}`;
  if (!showByKeyYear.has(k)) showByKeyYear.set(k, []);
  showByKeyYear.get(k).push(r);
}

// PowerPro panel.
const pp = JSON.parse(readFileSync(path.join(ROOT, 'outputs', 'derived', 'sp041_powerpro_normalized.json'), 'utf8'));
const ppByPidYear = new Map();
for (const t of pp.trajectories) {
  const pid = String(t.pid).replace(/^proeye:/, '');
  const m = new Map();
  for (const seg of String(t.text_raw ?? '').split('→')) {
    const mm = seg.trim().match(/^(\d{4}):(\d+)/);
    if (mm) m.set(Number(mm[1]), Number(mm[2]));
  }
  if (m.size) ppByPidYear.set(pid, { years: m, name: t.name || null });
}

// Identity maps → proeye_id.
const identities = [];
const keyToPid = new Map();

for (const b of db.prepare(`SELECT proeye_id, npb_name, mlb_name, name_key FROM the_show_bridge`).all()) {
  const key = nk(b.name_key || b.mlb_name);
  if (!key || !b.proeye_id) continue;
  keyToPid.set(key, { pid: b.proeye_id, name: b.npb_name, via: 'the_show_bridge' });
  identities.push({ key, pid: b.proeye_id, via: 'the_show_bridge' });
}

for (const b of db.prepare(`SELECT npb_name, mlb_name, proeye_id FROM mlb_bridge`).all()) {
  const key = mlbNameToKey(b.mlb_name);
  const pid = b.proeye_id;
  if (!key) continue;
  if (!keyToPid.has(key) && pid) {
    keyToPid.set(key, { pid, name: b.npb_name, via: 'mlb_bridge' });
    identities.push({ key, pid, via: 'mlb_bridge' });
  } else if (!pid) {
    identities.push({ key, pid: null, via: 'mlb_bridge_no_proeye', npb_name: b.npb_name });
  }
}

const pairs = [];
const playerYears = new Map();
for (const [k, recs] of showByKeyYear) {
  const [key, ys] = k.split('|');
  const y = Number(ys);
  const ident = keyToPid.get(key);
  if (!ident?.pid) continue;
  const ppRec = ppByPidYear.get(ident.pid);
  if (!ppRec?.years.has(y)) continue;
  const showSpeed = median(recs.map(r => r.speed));
  const pair = {
    pid: ident.pid,
    name: ident.name,
    year: y,
    identity_via: ident.via,
    show_live_speed: showSpeed,
    show_live_n: recs.length,
    powerpro_speed: ppRec.years.get(y),
    show_band: band(showSpeed, 'show'),
    powerpro_band: band(ppRec.years.get(y), 'pp'),
    sealed_holdout: sealed.has(ident.pid),
  };
  pairs.push(pair);
  if (!playerYears.has(ident.pid)) playerYears.set(ident.pid, []);
  playerYears.get(ident.pid).push(y);
}

const players = [...playerYears.keys()];
const years = [...new Set(pairs.map(p => p.year))].sort((a, b) => a - b);
const bandN = { fast: 0, mid: 0, slow: 0 };
for (const p of pairs) bandN[p.show_band] += 1;
const holdoutPairs = pairs.filter(p => p.sealed_holdout);
const holdoutPlayers = new Set(holdoutPairs.map(p => p.pid));

// Population sizes for honesty.
const showKeys = new Set(showRows.map(r => nk(r.name_key || r.name)));
const unmatchedShowWithPpYear = [];
// do not invent fuzzy JP/EN matches

const out = {
  generated_at: '2026-08-13',
  option: 'B',
  constraints: {
    same_year_only: true,
    cross_time_interpolation: false,
    the_show_series: 'Live',
    boosted_special_excluded: true,
    powerpro_source: 'SP-041 2,972-player long panel',
  },
  search_universe: {
    the_show_live_hitter_rows: showRows.length,
    the_show_live_name_keys: showKeys.size,
    powerpro_panel_players: pp.trajectories.length,
    identity_links_with_proeye: [...keyToPid.values()].length,
    identity_sources: ['the_show_bridge', 'mlb_bridge with proeye_id'],
    not_used: 'fuzzy Japanese-English name matching; WBC/special The Show series; cross-year pairing',
  },
  overlap_player_count: players.length,
  overlap_pair_count: pairs.length,
  years,
  speed_band_coverage: bandN,
  player_holdout: {
    sealed_test_players_with_same_year_pair: holdoutPlayers.size,
    sealed_test_pairs: holdoutPairs.length,
    player_holdout_possible: holdoutPlayers.size >= 8 && pairs.length - holdoutPairs.length >= 20,
  },
  sample_size_by_band: bandN,
  pairs: pairs.sort((a, b) => a.year - b.year || String(a.name).localeCompare(String(b.name))),
  restart_sp052: players.length >= 30 && pairs.length >= 40 && holdoutPlayers.size >= 8,
};
out.verdict = out.restart_sp052
  ? 'SP-052再開可能'
  : 'same-time numeric bridge remains NOT_IDENTIFIABLE';

writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp052_option_b_same_year_census_20260813.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  players: out.overlap_player_count,
  pairs: out.overlap_pair_count,
  years: out.years,
  bands: out.speed_band_coverage,
  holdout_players: holdoutPlayers.size,
  verdict: out.verdict,
}, null, 2));
