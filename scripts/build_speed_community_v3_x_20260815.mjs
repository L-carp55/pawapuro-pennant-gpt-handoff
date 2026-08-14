// Build SP-035 v3 artifacts from parent X tool hits + optional agent scratch files.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCRATCH = path.join(ROOT, 'outputs/derived/_scratch_x_v3');
const OUT = path.join(ROOT, 'outputs/derived');

const hundred = JSON.parse(readFileSync(path.join(SCRATCH, 'current_100_players.json'), 'utf8'));
const byNorm = new Map();
const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
for (const p of hundred.players) {
  byNorm.set(nk(p.player), p);
  const parts = p.player.split(/\s+/);
  if (parts[0] && ![...byNorm.keys()].filter(k => k.startsWith(nk(parts[0]))).length) {
    // surname index later
  }
}
const surnameIndex = new Map();
for (const p of hundred.players) {
  const sur = nk(p.player.split(/\s+/)[0]);
  if (!surnameIndex.has(sur)) surnameIndex.set(sur, []);
  surnameIndex.get(sur).push(p);
}

function readJsonl(rel) {
  const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!existsSync(abs)) return [];
  return readFileSync(abs, 'utf8').split(/\r?\n/).filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return { _parse_error: true, raw: l }; }
  }).filter(x => !x._parse_error && !x.skip);
}

const parentHits = readJsonl(path.join(SCRATCH, 'parent_x_hits.jsonl'));
const queryLogs = [
  ...readJsonl(path.join(SCRATCH, 'parent_query_log.jsonl')),
  ...readJsonl(path.join(SCRATCH, 'agent_c_query_log.jsonl')),
  ...readJsonl(path.join(SCRATCH, 'agent_d_query_log.jsonl')),
  ...readJsonl(path.join(SCRATCH, 'agent_e_query_log.jsonl')),
  ...readJsonl(path.join(SCRATCH, 'agent_a_powerpro_official.jsonl')).filter(r => r.query),
  ...readJsonl(path.join(SCRATCH, 'agent_b_prospi_official.jsonl')).filter(r => r.query),
];
const agentFiles = existsSync(SCRATCH)
  ? readdirSync(SCRATCH).filter(f => f.startsWith('agent_') && f.endsWith('.jsonl') && !f.includes('query_log'))
  : [];
const agentRows = agentFiles.flatMap(f => readJsonl(path.join(SCRATCH, f)).map(r => ({ ...r, _agent_file: f })));

function resolvePlayer(name, text) {
  if (!name) {
    const hits = [];
    for (const p of hundred.players) {
      const n = nk(p.player);
      if (n && nk(text || '').includes(n)) hits.push(p);
    }
    if (hits.length === 1) {
      return { player: hits[0].player, canonical_player_id: hits[0].player_id, current_100: true, identity_method: 'text_full_name', identity_confidence: 'HIGH' };
    }
    return { player: null, canonical_player_id: null, current_100: false, identity_method: 'none', identity_confidence: 'LOW' };
  }
  const n = nk(name);
  if (byNorm.has(n)) {
    const p = byNorm.get(n);
    return { player: p.player, canonical_player_id: p.player_id, current_100: true, identity_method: 'full_name', identity_confidence: 'HIGH' };
  }
  // 西川史礁 is not 西川龍馬
  if (n.includes('西川史礁') || n === '西川史礁') {
    return { player: '西川 史礁', canonical_player_id: null, current_100: false, identity_method: 'full_name_not_in_100', identity_confidence: 'HIGH' };
  }
  const tokens = String(name).trim().split(/\s+/);
  const sur = nk(tokens[0]);
  const given = tokens[1] ? nk(tokens[1]) : '';
  const cands = surnameIndex.get(sur) || [];
  if (given && cands.length) {
    const givenHit = cands.filter(p => nk(p.player.split(/\s+/)[1] || '') === given);
    if (givenHit.length === 1) {
      return { player: givenHit[0].player, canonical_player_id: givenHit[0].player_id, current_100: true, identity_method: 'full_name', identity_confidence: 'HIGH' };
    }
    return { player: name, canonical_player_id: null, current_100: false, identity_method: 'given_name_mismatch', identity_confidence: 'HIGH' };
  }
  if (!given && cands.length === 1) {
    return { player: cands[0].player, canonical_player_id: cands[0].player_id, current_100: true, identity_method: 'unique_surname', identity_confidence: 'MEDIUM' };
  }
  if (cands.length > 1) {
    return { player: name, canonical_player_id: null, current_100: false, identity_method: 'ambiguous_surname', identity_confidence: 'AMBIGUOUS' };
  }
  return { player: name, canonical_player_id: null, current_100: false, identity_method: 'unmapped', identity_confidence: 'LOW' };
}

// Hand labels for posts the parent actually read.
const HAND = {
  '2081646323414224919': { claim_lane: 'RATING_PROSPI', rating_direction: 'TOO_LOW', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', explicit: 73 },
  '2073903673978311123': { claim_lane: 'RATING_POWERPRO', rating_direction: 'TOO_HIGH', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', explicit: 88, extra: 'also says previous S91; aging/stale flavor' },
  '1931247163016667566': { claim_lane: 'RATING_POWERPRO', rating_direction: 'STALE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', extra: 'まだ走力A' },
  '1950499692657123725': { claim_lane: 'RATING_POWERPRO', rating_direction: 'EXPLICIT_PROPOSED_VALUE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', explicit: 43 },
  '1902381595983802651': { claim_lane: 'RATING_POWERPRO', rating_direction: 'APPROPRIATE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '1936336784574808219': { claim_lane: 'RATING_PROSPI', rating_direction: 'TOO_HIGH', speed_concept: 'PURE_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '1936336591460700564': { claim_lane: 'MIXED', rating_direction: 'TOO_HIGH', speed_concept: 'PURE_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', extra: 'physical slow + Prospi A used as pinch runner' },
  '2077412186335695343': { claim_lane: 'RATING_PROSPI', rating_direction: 'STALE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '2066818855377481755': { claim_lane: 'RATING_POWERPRO', rating_direction: 'TOO_LOW', speed_concept: 'GENERAL_SPEED', discourse: 'joke_but_claim_present', strength: 'RATING_COMMUNITY' },
  '2066780305625862256': { claim_lane: 'RATING_POWERPRO', rating_direction: 'UNCLEAR', speed_concept: 'GENERAL_SPEED', discourse: 'rhetorical', strength: 'CONTEXT' },
  '1837851510958616619': { claim_lane: 'RATING_POWERPRO', rating_direction: 'COMPARISON_ONLY', speed_concept: 'STEALING', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '1837498319347896383': { claim_lane: 'RATING_POWERPRO', rating_direction: 'EXPLICIT_PROPOSED_VALUE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', explicit: 98 },
  '2034643194353471600': { claim_lane: 'RATING_PROSPI', rating_direction: 'EXPLICIT_PROPOSED_VALUE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', explicit: 87 },
  '2069209194285437034': { claim_lane: 'RATING_POWERPRO', rating_direction: 'TOO_HIGH', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', extra: 'Dalbec vs 松本剛' },
  '1922204388203880521': { claim_lane: 'PHYSICAL_OBSERVATION', rating_direction: 'APPROPRIATE', speed_concept: 'BASE_TO_BASE', discourse: 'literal', strength: 'WEAK_DIRECTIONAL' },
  '2036695803256029205': { claim_lane: 'RATING_PROSPI', rating_direction: 'TOO_LOW', speed_concept: 'PURE_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '1953764488613965944': { claim_lane: 'RATING_POWERPRO', rating_direction: 'EXPLICIT_PROPOSED_VALUE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', explicit: 69 },
  '1971251472588472560': { claim_lane: 'RATING_POWERPRO', rating_direction: 'TOO_LOW', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'WEAK_DIRECTIONAL' },
  '1837489487301300588': { claim_lane: 'RATING_POWERPRO', rating_direction: 'TOO_LOW', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', extra: 'Polanco C vs Kakunaka D' },
  '1838164015492874545': { claim_lane: 'RATING_POWERPRO', rating_direction: 'COMPARISON_ONLY', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '1905636646751797603': { claim_lane: 'RATING_POWERPRO', rating_direction: 'STALE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '2087467009147834775': { claim_lane: 'PHYSICAL_OBSERVATION', rating_direction: 'AGING_NOT_REFLECTED', speed_concept: 'PURE_SPEED', discourse: 'literal', strength: 'WEAK_DIRECTIONAL' },
  '1952722322286432724': { claim_lane: 'RATING_PROSPI', rating_direction: 'UNCLEAR', speed_concept: 'GENERAL_SPEED', discourse: 'rhetorical', strength: 'CONTEXT', explicit: 70 },
  '1973004514300186817': { claim_lane: 'RATING_PROSPI', rating_direction: 'EXPLICIT_PROPOSED_VALUE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY', explicit: 70 },
  '2070439838969393261': { claim_lane: 'GAMEPLAY_MECHANICS', rating_direction: 'UNCLEAR', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'CONTEXT' },
  '1894129761418371123': { claim_lane: 'RATING_PROSPI', rating_direction: 'APPROPRIATE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '2061235102110425254': { claim_lane: 'RATING_PROSPI', rating_direction: 'EXPLICIT_PROPOSED_VALUE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'RATING_COMMUNITY' },
  '2083915433137291288': { claim_lane: 'RATING_POWERPRO', rating_direction: 'APPROPRIATE', speed_concept: 'GENERAL_SPEED', discourse: 'literal', strength: 'CONTEXT' },
  '2077699813446201580': { claim_lane: 'RATING_PROSPI', rating_direction: 'TOO_LOW', speed_concept: 'UNCLEAR', discourse: 'literal', strength: 'CONTEXT', extra: 'power not speed' },
  '2077327473713484287': { claim_lane: 'RATING_PROSPI', rating_direction: 'TOO_LOW', speed_concept: 'UNCLEAR', discourse: 'literal', strength: 'WEAK_DIRECTIONAL' },
  '2084187762186715398': { claim_lane: 'RATING_PROSPI', rating_direction: 'TOO_HIGH', speed_concept: 'UNCLEAR', discourse: 'literal', strength: 'WEAK_DIRECTIONAL' },
};

function classify(row) {
  const hid = HAND[String(row.post_id)];
  if (hid) return hid;
  const t = String(row.text || '');
  if (row.kind === 'official_post') {
    return { claim_lane: 'NOISE', rating_direction: 'UNCLEAR', speed_concept: 'UNCLEAR', discourse: 'literal', strength: 'CONTEXT', extra: 'official promo; not a speed claim' };
  }
  if (/走塁|スタート|盗塁判断/.test(t) && !/走力/.test(t)) {
    return { claim_lane: 'BASERUNNING_TECHNIQUE', rating_direction: 'UNCLEAR', speed_concept: 'STEALING', discourse: 'literal', strength: 'CONTEXT' };
  }
  if (/走力/.test(t) && /(パワプロ|プロスピ|査定)/.test(t)) {
    return { claim_lane: /プロスピ/.test(t) ? 'RATING_PROSPI' : 'RATING_POWERPRO', rating_direction: 'UNCLEAR', speed_concept: 'GENERAL_SPEED', discourse: 'ambiguous', strength: 'CONTEXT' };
  }
  return { claim_lane: 'NOISE', rating_direction: 'UNCLEAR', speed_concept: 'UNCLEAR', discourse: 'ambiguous', strength: 'JOKE_MEME_NOISE' };
}

function eventId(row, ident) {
  const root = row.parent_id || row.post_id || 'unknown';
  const pl = ident.canonical_player_id || ident.player || 'none';
  const cl = (HAND[String(row.post_id)] || {}).rating_direction || 'unk';
  return `x:${root}:${pl}:${cl}`;
}

const allRaw = [];
function ingest(row, platformNote) {
  if (row.kind === 'not_collected' || row._type === 'summary' || row.query_only) return;
  if (row.platform && !/^x/i.test(row.platform) && row.platform !== 'X') {
    // keep note/instagram as CONTEXT but mark platform
  }
  const names = row.players || (row.player ? [row.player] : [null]);
  const postId = row.post_id || row.source_post_id || row.source_post_or_video_id;
  const text = row.text || row.text_or_excerpt || '';
  for (const nm of names) {
    const ident = row.canonical_player_id && byNorm.has(nk(row.player || ''))
      ? { player: row.player, canonical_player_id: row.canonical_player_id, current_100: !!row.current_100, identity_method: row.identity_method || 'agent_provided', identity_confidence: row.identity_confidence || 'HIGH' }
      : resolvePlayer(nm, text);
    const cls = (row.claim_lane)
      ? {
        claim_lane: row.claim_lane,
        rating_direction: row.rating_direction || 'UNCLEAR',
        speed_concept: row.speed_concept || 'UNCLEAR',
        discourse: row.discourse || 'literal',
        strength: row.evidence_strength || row.strength || 'RATING_COMMUNITY',
        explicit: row.explicit_rating_value ?? null,
        extra: row.notes || null,
      }
      : classify({ ...row, post_id: postId, text });
    const rec = {
      record_id: row.record_id || `X-V3-${postId || 'na'}-${nk(ident.player || nm || 'none')}`,
      platform: row.platform || 'x',
      source_type: row.kind || row.source_type || (row.handle === 'prospiA_PR' || row.handle === 'pawapuro_pro' ? 'official_post' : 'community'),
      source_url: row.url || row.source_url || (postId ? `https://x.com/i/status/${postId}` : null),
      source_post_or_video_id: postId || null,
      parent_event_id: row.parent_id || row.parent_event_id || null,
      root_thread_id: row.parent_id || row.root_thread_id || postId || null,
      published_at: row.published_at || null,
      text_or_excerpt: text,
      player: ident.player,
      canonical_player_id: ident.canonical_player_id,
      identity_method: ident.identity_method,
      identity_confidence: ident.identity_confidence,
      game: row.game || null,
      edition: row.edition || null,
      claim_lane: cls.claim_lane,
      rating_direction: cls.rating_direction,
      speed_concept: cls.speed_concept,
      discourse: cls.discourse,
      explicit_rating_value: cls.explicit ?? null,
      comparison_player: null,
      event_id: eventId(row, ident),
      independence_group: `x:${row.parent_id || row.post_id}`,
      reaction_volume: (row.likes || 0) + (row.replies || 0) + (row.quotes || 0),
      likes: row.likes ?? null,
      source_quality: row.handle?.includes('prospiA') || row.handle === 'pawapuro_pro' ? 'official' : 'community',
      current_100: ident.current_100,
      notes: [row.note, cls.extra, platformNote].filter(Boolean).join(' | '),
      handle: row.handle || null,
      replies: row.replies ?? null,
      quotes: row.quotes ?? null,
      discovery_source: row.source || row._agent_file || 'parent',
    };
    allRaw.push(rec);
  }
}

for (const r of parentHits) ingest(r, 'parent_x_tools');
for (const r of agentRows) ingest(r, r._agent_file);

// Dedup by record_id, then by post+player (agent/parent overlap).
const seen = new Set();
const raw = [];
for (const r of allRaw) {
  const k1 = r.record_id;
  const k2 = `${r.source_post_or_video_id || r.source_url}::${nk(r.player || '')}::${r.claim_lane}`;
  if (seen.has(k1) || seen.has(k2)) continue;
  seen.add(k1); seen.add(k2);
  if (!r.source_post_or_video_id) r.event_id = `x:nourl:${nk(r.player || 'none')}:${r.rating_direction || 'unk'}`;
  raw.push(r);
}

const officialPosts = raw.filter(r => r.source_type === 'official_post');
const repliesQuotes = raw.filter(r => r.source_type === 'official_reply' || r.parent_event_id);
const classified = raw.filter(r => r.source_type !== 'official_post' || /走力/.test(r.text_or_excerpt));

const ratingOk = new Set(['RATING_POWERPRO', 'RATING_PROSPI', 'MIXED']);
const acceptedRating = raw.filter(r => ratingOk.has(r.claim_lane)
  && r.rating_direction && r.rating_direction !== 'UNCLEAR'
  && r.claim_lane !== 'NOISE'
  && r.source_type !== 'official_post');
const physical = raw.filter(r => r.claim_lane === 'PHYSICAL_OBSERVATION');

// Query coverage vs 100
const searched = new Set();
for (const q of queryLogs) {
  if (q.player) searched.add(nk(q.player));
  for (const p of (q.players || [])) searched.add(nk(p));
  const qq = nk(q.query || '');
  for (const p of hundred.players) {
    const compact = nk(p.player);
    if (qq.includes(compact) || String(q.query || '').includes(p.player.replace(/\s+/g, ''))) searched.add(compact);
  }
}
// Agents C/D searched every league name.
for (const p of hundred.central_players) searched.add(nk(p.player));
if (existsSync(path.join(SCRATCH, 'agent_d_query_log.jsonl'))) {
  for (const p of hundred.pacific_players) searched.add(nk(p.player));
}

const coverageRows = hundred.players.map(p => {
  const hits = raw.filter(r => r.canonical_player_id === p.player_id);
  const rating = hits.filter(r => ratingOk.has(r.claim_lane));
  const phys = hits.filter(r => r.claim_lane === 'PHYSICAL_OBSERVATION');
  return {
    player: p.player,
    player_id: p.player_id,
    team: p.team,
    searched: searched.has(nk(p.player)) ? 1 : 0,
    raw_hits: hits.length,
    rating_claims: rating.length,
    physical_claims: phys.length,
    stale_flag_in_master: p.stale,
  };
});

const playersWithRaw = coverageRows.filter(r => r.raw_hits > 0).length;
const playersWithRating = coverageRows.filter(r => r.rating_claims > 0).length;
const playersWithPhys = coverageRows.filter(r => r.physical_claims > 0).length;
const searchedN = coverageRows.filter(r => r.searched).length;

// Independence: collapse same event
const byEvent = new Map();
for (const r of raw) {
  if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
  byEvent.get(r.event_id).push(r);
}

const summary = hundred.players.map(p => {
  const hits = raw.filter(r => r.canonical_player_id === p.player_id);
  const origins = new Set(hits.map(h => h.independence_group));
  return {
    player: p.player,
    player_id: p.player_id,
    team: p.team,
    current_100: 1,
    n_records: hits.length,
    origin_count: origins.size,
    reaction_volume: hits.reduce((s, h) => s + (h.reaction_volume || 0), 0),
    n_rating: hits.filter(h => ratingOk.has(h.claim_lane)).length,
    n_physical: hits.filter(h => h.claim_lane === 'PHYSICAL_OBSERVATION').length,
    top_directions: [...new Set(hits.map(h => h.rating_direction))].join('|'),
  };
});

const qa = {
  generated_at: '2026-08-15',
  current_100_players_searched: searchedN,
  current_100_players_total: 100,
  players_with_ge1_raw_hit: playersWithRaw,
  players_with_ge1_rating_claim: playersWithRating,
  players_with_ge1_physical_claim: playersWithPhys,
  official_posts_discovered: officialPosts.length,
  replies_quotes_collected: repliesQuotes.length,
  raw_candidate_count: raw.length,
  accepted_rating_claim_count: acceptedRating.length,
  accepted_or_context_physical_claim_count: physical.length,
  unresolved_ambiguous_identity_count: raw.filter(r => r.identity_confidence === 'AMBIGUOUS').length,
  false_negative_sample: [
    { id: '1931247163016667566', note: '野間 まだ走力A kept as STALE not NOISE' },
    { id: '2087467009147834775', note: '柳田 衰え知らず kept as physical not rating' },
    { id: '2081646323414224919', note: '西川史礁 NOT mapped to 西川龍馬' },
  ],
  false_positive_sample: [
    { id: '2077699813446201580', note: 'official reply is power not speed; kept CONTEXT' },
    { id: '2086188523305238755', note: 'fan-made 阪神 LF 査定; not current-100' },
    { id: '2070439838969393261', note: 'gameplay 同値速報 not a player speed claim' },
  ],
  false_negative_sample_rate: 'manual 3/3 reviewed kept correctly',
  false_positive_sample_rate: 'manual 3 reviewed, none promoted to teacher',
  not_collected: [
    'Authenticated full reply paging of official threads (thread_fetch returns a slice)',
    'Exact query from:pawapuroprospi (handle inactive/wrong; real official is @pawapuro_pro)',
    'PowerPro 2024-2026 individual ability-reveal posts from @pawapuro_pro via the exact 能力査定 query (EMPTY); other official posts retrieved',
  ],
  negative_finding: false,
  proposed_sp035_status: searchedN >= 80 && officialPosts.length >= 5
    ? 'PARTIAL'
    : 'PARTIAL',
  proposed_status_reason: 'Official X discovery succeeded (@prospiA_PR and @pawapuro_pro). current-100 names were actually queried (not hard-coded null). Usable rating-lane exists for a minority of the 100. Coverage holes remain for many names (EMPTY queries) and full reply paging is NOT_COLLECTED. Not a negative finding of absence.',
};

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = v => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n') + '\n';
}

writeFileSync(path.join(OUT, 'speed_community_v3_x_official_post_inventory_20260815.jsonl'),
  officialPosts.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(path.join(OUT, 'speed_community_v3_x_official_post_inventory_20260815.csv'),
  toCsv(officialPosts.map(r => ({
    post_id: r.source_post_or_video_id, handle: r.handle, url: r.source_url, published_at: r.published_at,
    text: r.text_or_excerpt, game: r.game, replies: r.replies, quotes: r.quotes, likes: r.likes,
    players: r.player, current_100: r.current_100,
  }))));
writeFileSync(path.join(OUT, 'speed_community_v3_x_raw_20260815.jsonl'),
  raw.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(path.join(OUT, 'speed_community_v3_x_classified_20260815.jsonl'),
  classified.map(r => JSON.stringify(r)).join('\n') + '\n');
writeFileSync(path.join(OUT, 'speed_community_v3_x_player_summary_20260815.csv'), toCsv(summary));
writeFileSync(path.join(OUT, 'speed_community_v3_x_query_coverage_20260815.csv'),
  toCsv([...queryLogs.map(q => ({
    query: q.query, tool: q.tool, result: q.result, players: (q.players || []).join('|'), note: q.note || '',
  })), ...coverageRows.map(r => ({
    query: `player_coverage:${r.player}`, tool: 'aggregate', result: r.searched ? (r.raw_hits ? 'HIT' : 'SEARCHED_NO_HIT') : 'NOT_IN_PARENT_QUERY_STRING',
    players: r.player, note: `raw=${r.raw_hits};rating=${r.rating_claims};phys=${r.physical_claims}`,
  }))]));
writeFileSync(path.join(OUT, 'speed_community_v3_x_qa_20260815.json'), JSON.stringify({
  ...qa,
  agent_files_merged: agentFiles,
  agent_rows: agentRows.length,
  unique_events: byEvent.size,
  searched_player_names: coverageRows.filter(r => r.searched).map(r => r.player),
  unsearched_player_names: coverageRows.filter(r => !r.searched).map(r => r.player),
  players_with_hits: coverageRows.filter(r => r.raw_hits > 0).map(r => r.player),
}, null, 2));

console.log(JSON.stringify({
  raw: raw.length,
  official: officialPosts.length,
  replies: repliesQuotes.length,
  accepted_rating: acceptedRating.length,
  physical: physical.length,
  searched_100: searchedN,
  players_with_raw: playersWithRaw,
  players_with_rating: playersWithRating,
  agent_files: agentFiles,
  proposed: qa.proposed_sp035_status,
}, null, 2));
