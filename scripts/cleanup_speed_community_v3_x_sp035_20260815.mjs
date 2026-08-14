// SP-035 deterministic integrity cleanup.
// Reads the existing Grok artifacts only. It never searches, fetches, or edits raw evidence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'outputs', 'derived');
const RAW_PATH = path.join(OUT, 'speed_community_v3_x_raw_20260815.jsonl');
const CLASSIFIED_PATH = path.join(OUT, 'speed_community_v3_x_classified_20260815.jsonl');
const QUERY_PATH = path.join(OUT, 'speed_community_v3_x_query_coverage_20260815.csv');
const MASTER_CSV_PATH = path.join(OUT, 'speed_2026_100_owner_review_master_20260813.csv');
const MASTER_JSON_PATH = path.join(OUT, '_scratch_x_v3', 'current_100_players.json');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'state', 'speed_task_registry.tsv');

const canonicalPath = path.join(OUT, 'speed_community_v3_x_canonical_20260815.jsonl');
const supplementalPath = path.join(OUT, 'speed_community_v3_x_supplemental_web_20260815.jsonl');
const officialInventoryPath = path.join(OUT, 'speed_community_v3_x_official_post_inventory_20260815.jsonl');
const officialInventoryCsvPath = path.join(OUT, 'speed_community_v3_x_official_post_inventory_20260815.csv');
const summaryPath = path.join(OUT, 'speed_community_v3_x_player_summary_20260815.csv');
const coveragePath = path.join(OUT, 'speed_community_v3_x_query_coverage_20260815.csv');
const qaPath = path.join(OUT, 'speed_community_v3_x_qa_20260815.json');
const integrityQaPath = path.join(OUT, 'speed_community_v3_x_integrity_qa_20260815.json');
const auditPath = path.join(ROOT, 'docs', 'audits', 'speed_community_v3_x_recollection_20260815.md');

function assert(condition, message) {
  if (!condition) throw new Error(`SP-035 cleanup assertion failed: ${message}`);
}

function readJsonl(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${filePath}:${index + 1} is not valid JSON: ${error.message}`); }
  });
}

function readCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell.length === 0) quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function readCsvFile(filePath) {
  return readCsv(fs.readFileSync(filePath, 'utf8'));
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows, columns) {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  const body = [cols.join(','), ...rows.map(row => cols.map(column => csvEscape(row[column])).join(','))].join('\n') + '\n';
  writeAtomic(filePath, body);
}

function writeAtomic(filePath, contents) {
  const tmpPath = `${filePath}.sp035-tmp`;
  fs.writeFileSync(tmpPath, contents, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function writeJsonl(filePath, rows) {
  writeAtomic(filePath, rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function clean(value) {
  if (value == null) return '';
  return String(value).trim();
}

function normalizeName(value) {
  return clean(value).normalize('NFKC').replace(/[\s　]+/g, '');
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isX(row) {
  return clean(row.platform).toLowerCase() === 'x';
}

function extractPostId(row) {
  const field = clean(row.source_post_or_video_id);
  if (field) return field;
  const match = clean(row.source_url).match(/(?:x\.com|twitter\.com)\/[^/]+\/status\/(\d+)/i);
  return match?.[1] ?? null;
}

function isRatingLane(lane) {
  return /^RATING_(POWERPRO|PROSPI)$/.test(lane) || lane === 'MIXED';
}

function isDirectionalDirection(direction) {
  return Boolean(clean(direction)) && clean(direction).toUpperCase() !== 'UNCLEAR';
}

// These markers are deliberately narrower than a generic "走力" or game-grade mention.
// They capture direct physical observations while leaving theft/baserunning technique separate.
const directPhysicalPattern = /(俊足|足(?:が|は|も)?(?:速|早|遅)|足速|足早|足おっそ|足めっちゃ(?:速|早)|全力疾走|一塁到達|直線速度|スプリント|(?:30|50)\s*(?:m|メートル)|km\/?h|走れ(?:な|て)|走り方|走力(?:が|は|も|ともに)?(?:落|遅|速|向上|きつ|な(?:い|く)|変わ|衰))/i;
const techniquePattern = /(走塁|盗塁|ベーラン|代走|スタート|タッチアップ|内野安打|走塁死)/i;
const contextPattern = /(怪我(?![A-GＳＡ-Ｇ])|ケガ(?![A-GＳＡ-Ｇ])|故障|手術|前十字|ACL|アキレス|衰え|衰退|年齢|全盛期|劣化|減衰|攻守で.{0,8}きつ|スタメン.{0,8}きつ|きつい|老い)/i;
const gamePattern = /(パワプロ|プロスピ|査定|能力(?:値|予想)|走力\s*[A-GＳＡ-Ｇ]\s*\d*)/i;
const realWorldPhysicalCue = /(俊足|足(?:が|は|も)(?:速|早|遅)|足速|(?<!逃げ)足早|足おっそ|足めっちゃ(?:速|早)|全力疾走|一塁到達|直線速度|スプリント|(?:30|50)\s*(?:m|メートル)|km\/?h|走り方)/i;

function gameKey(row) {
  const value = `${clean(row.game)} ${clean(row.edition)} ${clean(row.text_or_excerpt)}`;
  if (/プロスピA|ProspiA/i.test(value)) return 'PROSPI_A';
  if (/プロスピ|Prospi/i.test(value)) return 'PROSPI_CONSOLE_OR_UNSPECIFIED';
  if (/パワプロ|PowerPro/i.test(value)) return 'POWERPRO';
  return clean(row.game) || null;
}

function classifyFacets(row) {
  const lane = clean(row.claim_lane).toUpperCase();
  const direction = clean(row.rating_direction).toUpperCase();
  const text = clean(row.text_or_excerpt);
  const game = gameKey(row);
  const explicitGameContext = Boolean(clean(row.game) || clean(row.edition)) || gamePattern.test(text);
  const ratingEvidence = isRatingLane(lane)
    || (isDirectionalDirection(direction) && explicitGameContext);
  const directionalRating = ratingEvidence && isDirectionalDirection(direction);
  const ratingContext = ratingEvidence && !directionalRating;
  const directPhysical = directPhysicalPattern.test(text);
  const technique = techniquePattern.test(text) || clean(row.speed_concept).toUpperCase() === 'STEALING';
  // "ベーランが速い" and similar records are retained as technique context unless
  // they also contain a direct body-speed/measurement phrase.
  const gameOnlyLane = isRatingLane(lane) || lane === 'GAMEPLAY_MECHANICS';
  const gameOnlySpeedPhrase = explicitGameContext && gameOnlyLane && (lane === 'GAMEPLAY_MECHANICS' || !realWorldPhysicalCue.test(text));
  const speedSpecificPhysical = directPhysical && !gameOnlySpeedPhrase;
  const generalContext = contextPattern.test(text) && !speedSpecificPhysical;
  const contextTags = [];
  if (/(怪我|ケガ|故障|手術|前十字|ACL|アキレス)/i.test(text)) contextTags.push('INJURY_OR_RECOVERY');
  if (/(衰え|衰退|年齢|全盛期|昔|劣化|減衰|老い)/i.test(text)) contextTags.push('AGING');
  const facets = [];
  if (directionalRating) facets.push('RATING_DIRECTIONAL');
  else if (ratingContext) facets.push('RATING_CONTEXT');
  if (speedSpecificPhysical) facets.push('SPEED_SPECIFIC_PHYSICAL');
  if (generalContext) facets.push('GENERAL_AGING_INJURY_CONTEXT');
  if (technique) facets.push('BASERUNNING_TECHNIQUE');
  if (lane === 'GAMEPLAY_MECHANICS') facets.push('GAMEPLAY_MECHANICS');
  if (!facets.length) facets.push('NOISE_OR_UNCLEAR');
  const clusterTokens = [];
  if (ratingEvidence) clusterTokens.push('rating');
  if (speedSpecificPhysical) clusterTokens.push('speed_physical');
  if (generalContext) clusterTokens.push('general_context');
  if (technique) clusterTokens.push('technique');
  if (lane === 'GAMEPLAY_MECHANICS') clusterTokens.push('gameplay');
  if (!clusterTokens.length) clusterTokens.push('noise');
  let evidenceSubtype = 'NOISE_OR_UNCLEAR';
  if (facets.length === 1) evidenceSubtype = facets[0];
  else if ((facets.includes('RATING_DIRECTIONAL') || facets.includes('RATING_CONTEXT')) && facets.includes('SPEED_SPECIFIC_PHYSICAL')) evidenceSubtype = facets.includes('RATING_DIRECTIONAL') ? 'RATING_AND_SPEED_SPECIFIC_PHYSICAL' : 'RATING_CONTEXT_WITH_SPEED_SPECIFIC_PHYSICAL';
  else if (facets.includes('RATING_DIRECTIONAL') || facets.includes('RATING_CONTEXT')) {
    evidenceSubtype = facets.includes('GENERAL_AGING_INJURY_CONTEXT') ? 'RATING_WITH_CONTEXT' : 'RATING_CONTEXT_WITH_TECHNIQUE_CONTEXT';
  } else if (facets.includes('SPEED_SPECIFIC_PHYSICAL')) {
    evidenceSubtype = facets.includes('GAMEPLAY_MECHANICS') ? 'SPEED_SPECIFIC_PHYSICAL_WITH_GAMEPLAY_CONTEXT' : 'SPEED_SPECIFIC_PHYSICAL_WITH_TECHNIQUE_CONTEXT';
  } else if (facets.includes('GENERAL_AGING_INJURY_CONTEXT')) evidenceSubtype = 'GENERAL_AGING_INJURY_CONTEXT_WITH_TECHNIQUE_CONTEXT';
  return {
    source_claim_lane: lane || null,
    canonical_claim_lane: lane || 'UNCLEAR',
    claim_cluster: clusterTokens.join('+'),
    claim_facets: facets,
    evidence_subtype: evidenceSubtype,
    game_key: game,
    has_rating_claim: ratingEvidence,
    has_directional_rating_claim: directionalRating,
    has_speed_specific_physical_claim: speedSpecificPhysical,
    has_general_aging_injury_context: generalContext,
    has_baserunning_technique_context: technique,
    context_tags: contextTags,
  };
}

function identityFor(row, byId, byName) {
  const sourceId = clean(row.canonical_player_id);
  const sourcePlayer = clean(row.player);
  if (sourceId && byId.has(sourceId)) {
    const master = byId.get(sourceId);
    return {
      player: master.player,
      canonical_player_id: sourceId,
      player_key: sourceId,
      current_100: true,
      identity_method: 'master_canonical_player_id',
      identity_confidence: 'HIGH',
      identity_status: 'CURRENT_100_MASTER',
      source_player: sourcePlayer || null,
      source_canonical_player_id: sourceId,
      source_current_100: row.current_100 ?? null,
    };
  }
  const nameKey = normalizeName(sourcePlayer);
  if (nameKey && byName.has(nameKey)) {
    const master = byName.get(nameKey);
    return {
      player: master.player,
      canonical_player_id: master.player_id,
      player_key: master.player_id,
      current_100: true,
      identity_method: 'master_exact_name',
      identity_confidence: 'HIGH',
      identity_status: 'CURRENT_100_MASTER',
      source_player: sourcePlayer || null,
      source_canonical_player_id: sourceId || null,
      source_current_100: row.current_100 ?? null,
    };
  }
  return {
    player: sourcePlayer || null,
    canonical_player_id: null,
    player_key: nameKey ? `name:${nameKey}` : 'unresolved',
    current_100: false,
    identity_method: nameKey ? 'named_non_current_or_unmapped' : 'no_player_name',
    identity_confidence: sourcePlayer ? (clean(row.identity_confidence) || 'LOW') : 'UNRESOLVED',
    identity_status: sourcePlayer ? 'NAMED_NON_CURRENT_OR_UNMAPPED' : 'UNRESOLVED_NO_PLAYER',
    source_player: sourcePlayer || null,
    source_canonical_player_id: sourceId || null,
    source_current_100: row.current_100 ?? null,
  };
}

function normalizedRecord(row, lane, identity, postId, platform) {
  const facets = classifyFacets(row);
  const eventId = `${platform.toLowerCase()}:${postId}:${identity.player_key}:${facets.claim_cluster}`;
  const independenceGroup = `${platform.toLowerCase()}:${postId}:${identity.player_key}`;
  return {
    ...row,
    platform,
    source_platform: clean(row.platform) || null,
    source_record_id: clean(row.record_id) || null,
    record_id: clean(row.record_id) || `${platform}-${postId}-${identity.player_key}`,
    player: identity.player,
    canonical_player_id: identity.canonical_player_id,
    current_100: identity.current_100,
    identity_method: identity.identity_method,
    identity_confidence: identity.identity_confidence,
    identity_status: identity.identity_status,
    player_key: identity.player_key,
    source_player: identity.source_player,
    source_canonical_player_id: identity.source_canonical_player_id,
    source_current_100: identity.source_current_100,
    post_id: postId,
    source_post_or_video_id: clean(row.source_post_or_video_id) || postId,
    source_claim_lane: facets.source_claim_lane,
    canonical_claim_lane: facets.canonical_claim_lane,
    claim_cluster: facets.claim_cluster,
    claim_facets: facets.claim_facets,
    evidence_subtype: facets.evidence_subtype,
    game_key: facets.game_key,
    has_rating_claim: facets.has_rating_claim,
    has_directional_rating_claim: facets.has_directional_rating_claim,
    has_speed_specific_physical_claim: facets.has_speed_specific_physical_claim,
    has_general_aging_injury_context: facets.has_general_aging_injury_context,
    has_baserunning_technique_context: facets.has_baserunning_technique_context,
    context_tags: facets.context_tags,
    event_id: eventId,
    independence_group: independenceGroup,
    canonical_event_key: eventId,
    canonical_independence_group: independenceGroup,
    source_record_ids: [clean(row.record_id) || null].filter(Boolean),
    source_discovery_sources: [clean(row.discovery_source) || null].filter(Boolean),
    collapsed_duplicate_count: 0,
  };
}

function chooseRepresentative(rows) {
  return [...rows].sort((a, b) => {
    const textDelta = clean(b.text_or_excerpt).length - clean(a.text_or_excerpt).length;
    if (textDelta) return textDelta;
    const idDelta = clean(a.record_id).localeCompare(clean(b.record_id), 'ja');
    return idDelta;
  })[0];
}

function dedupe(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.event_id)) groups.set(row.event_id, []);
    groups.get(row.event_id).push(row);
  }
  const output = [];
  let collapsed = 0;
  for (const group of groups.values()) {
    const representative = chooseRepresentative(group);
    const sourceRecordIds = [...new Set(group.flatMap(row => row.source_record_ids))].sort();
    const sourceDiscoverySources = [...new Set(group.flatMap(row => row.source_discovery_sources))].sort();
    const merged = {
      ...representative,
      source_record_ids: sourceRecordIds,
      source_discovery_sources: sourceDiscoverySources,
      collapsed_duplicate_count: group.length - 1,
      dedupe_status: group.length > 1 ? 'COLLAPSED_SAME_POST_PLAYER_CLAIM' : 'UNIQUE_CANONICAL_CLAIM',
    };
    output.push(merged);
    collapsed += group.length - 1;
  }
  return { rows: output.sort((a, b) => a.event_id.localeCompare(b.event_id)), collapsed };
}

function canonicalPlayerMetrics(rows, masterRows) {
  return masterRows.map(player => {
    const hits = rows.filter(row => row.canonical_player_id === player.player_id);
    const origins = new Set(hits.map(row => row.independence_group));
    return {
      player: player.player,
      player_id: player.player_id,
      team: player.team,
      current_100: 1,
      n_records: hits.length,
      origin_count: origins.size,
      reaction_volume: hits.reduce((sum, row) => sum + numberOrZero(row.reaction_volume), 0),
      n_rating: hits.filter(row => row.has_rating_claim).length,
      n_directional_rating: hits.filter(row => row.has_directional_rating_claim).length,
      n_speed_specific_physical: hits.filter(row => row.has_speed_specific_physical_claim).length,
      n_general_context: hits.filter(row => row.has_general_aging_injury_context).length,
      top_directions: [...new Set(hits.map(row => clean(row.rating_direction)).filter(Boolean))].join('|'),
    };
  });
}

function unique(values) {
  return [...new Set(values.filter(value => value != null && value !== ''))];
}

function buildCoverageRows(originalCoverage, masterRows, canonicalRows) {
  const queryLogs = originalCoverage.filter(row => !clean(row.query).startsWith('player_coverage:'));
  const oldCoverage = new Map(originalCoverage.filter(row => clean(row.query).startsWith('player_coverage:')).map(row => [clean(row.players || clean(row.query).replace(/^player_coverage:/, '')), row]));
  const coverageRows = masterRows.map(player => {
    const old = oldCoverage.get(player.player);
    const hits = canonicalRows.filter(row => row.canonical_player_id === player.player_id);
    const searched = old && ['HIT', 'SEARCHED_NO_HIT'].includes(clean(old.result));
    return {
      query: `player_coverage:${player.player}`,
      tool: 'aggregate',
      result: searched ? (hits.length ? 'HIT' : 'SEARCHED_NO_HIT') : 'SEARCH_STATUS_UNVERIFIED',
      players: player.player,
      note: `canonical_x_rows=${hits.length};directional_rating=${hits.filter(row => row.has_directional_rating_claim).length};speed_specific_physical=${hits.filter(row => row.has_speed_specific_physical_claim).length};general_context=${hits.filter(row => row.has_general_aging_injury_context).length}`,
      canonical_x_rows: hits.length,
      canonical_directional_rating: hits.filter(row => row.has_directional_rating_claim).length,
      canonical_speed_specific_physical: hits.filter(row => row.has_speed_specific_physical_claim).length,
      canonical_general_context: hits.filter(row => row.has_general_aging_injury_context).length,
    };
  });
  return { queryLogs, coverageRows, rows: [...queryLogs.map(row => ({ ...row, canonical_x_rows: '', canonical_directional_rating: '', canonical_speed_specific_physical: '', canonical_general_context: '' })), ...coverageRows] };
}

function isCanonicalXIdentity(row) {
  const playerKey = clean(row.player_key);
  return Boolean(playerKey)
    && row.event_id === `x:${row.post_id}:${playerKey}:${row.claim_cluster}`
    && row.independence_group === `x:${row.post_id}:${playerKey}`;
}

function reviewRow(row, masterById) {
  const errors = [];
  if (row.platform !== 'X') errors.push('platform_not_x');
  if (!isCanonicalXIdentity(row)) errors.push('event_id_shape');
  if (/x:(unknown|nourl|undefined)/i.test(`${row.event_id} ${row.independence_group}`)) errors.push('legacy_identity_token');
  if (!row.post_id) errors.push('missing_post_id');
  if (row.current_100 !== masterById.has(row.canonical_player_id)) errors.push('current_100_not_master_derived');
  if (row.has_directional_rating_claim !== (row.has_rating_claim && isDirectionalDirection(row.rating_direction))) errors.push('rating_direction_mismatch');
  if (row.has_speed_specific_physical_claim && !directPhysicalPattern.test(clean(row.text_or_excerpt))) errors.push('physical_subtype_without_direct_marker');
  if (row.has_general_aging_injury_context && (!contextPattern.test(clean(row.text_or_excerpt)) || directPhysicalPattern.test(clean(row.text_or_excerpt)))) errors.push('general_context_subtype_mismatch');
  if (row.discourse === 'joke_but_claim_present' && isDirectionalDirection(row.rating_direction) && !row.has_directional_rating_claim) errors.push('joke_claim_dropped');
  if (row.canonical_player_id && !masterById.has(row.canonical_player_id)) errors.push('non_master_canonical_id');
  return errors;
}

function deterministicSample(rows, limit) {
  return [...rows].sort((a, b) => a.event_id.localeCompare(b.event_id)).slice(0, Math.min(limit, rows.length));
}

function buildStratum(name, eligibleRows, masterById) {
  const sampleRows = eligibleRows.length <= 20 ? [...eligibleRows].sort((a, b) => a.event_id.localeCompare(b.event_id)) : deterministicSample(eligibleRows, 20);
  const reviewed = sampleRows.map(row => ({ event_id: row.event_id, record_id: row.record_id, errors: reviewRow(row, masterById) }));
  const errorCount = reviewed.reduce((sum, item) => sum + item.errors.length, 0);
  return {
    stratum: name,
    eligible_count: eligibleRows.length,
    sample_count: reviewed.length,
    sampled_event_ids: reviewed.map(item => item.event_id),
    error_count: errorCount,
    corrected_count: 0,
    errors: reviewed.filter(item => item.errors.length).map(item => ({ event_id: item.event_id, record_id: item.record_id, errors: item.errors })),
  };
}

function buildAudit(metrics, missingness, input) {
  const m = metrics;
  const table = [
    ['raw input rows (preserved)', input.raw_rows],
    ['classified input rows (preserved)', input.classified_rows],
    ['X primary canonical rows', m.x_primary_rows],
    ['unique X post IDs', m.unique_x_post_ids],
    ['unique independence groups / origins', m.unique_origin_count],
    ['duplicate rows collapsed', m.duplicate_rows_collapsed],
    ['current-100 searched', `${m.current_100_searched} / ${m.current_100_total}`],
    ['current-100 with raw X hit', m.current_100_with_raw_x_hit],
    ['current-100 with directional rating claim', m.current_100_with_directional_rating_claim],
    ['current-100 with speed-specific physical claim', m.current_100_with_speed_specific_physical_claim],
    ['directional rating claim rows', m.directional_rating_claim_count],
    ['speed-specific physical rows', m.speed_specific_physical_count],
    ['general aging/injury context rows', m.general_context_count],
    ['official X post IDs', m.official_x_post_count],
    ['known reply/quote rows', m.reply_quote_count_known],
    ['unique origins', m.unique_origin_count],
    ['supplemental WEB rows', m.supplemental_web_rows],
    ['unresolved identity rows', m.unresolved_identity_count],
    ['X no-post non-evidence rows excluded from canonical', m.x_non_evidence_excluded],
  ].map(([key, value]) => `| ${key} | **${value}** |`).join('\n');
  const missing = missingness.map(item => `- ${item}`).join('\n');
  return `# SP-035 X recollection v3 — integrity cleanup（2026-08-15）

担当: Luna cleanup。新規X検索・Web検索は実施していない。Grok Buildの既存artifactを読み、raw evidenceを保持したまま canonical X lane と supplemental WEB lane を分離した。

## 1. authoritative input / boundary

- raw evidence: \`outputs/derived/speed_community_v3_x_raw_20260815.jsonl\`（${input.raw_rows}行、未変更）
- classified evidence: \`outputs/derived/speed_community_v3_x_classified_20260815.jsonl\`（${input.classified_rows}行、未変更）
- current-100 mapping: \`outputs/derived/speed_2026_100_owner_review_master_20260813.csv\` と同scratch masterの一致を確認
- 新規検索、Web取得、YouTube、SP-033 / SP-034 / SP-075、Speed Gate、肩力は実施していない

## 2. canonical counts

数字は古いGrok途中集計ではなく、canonical X datasetから再計算した。

| 項目 | canonical値 |
| --- | ---: |
${table}

X primary は platform=X/x かつ X投稿IDを復元できる post/reply/quote recordだけを対象にした。投稿IDのない検索クエリ、アカウントメタデータ、空の入口recordは raw に残し、evidence originとして数えていない。WEBは別artifactに保存し、X countへ混ぜていない。

## 3. event identity / dedupe

- event key: \`x:<post_id>:<canonical_player_id-or-player-key>:<claim_cluster>\`
- independence group: \`x:<post_id>:<canonical_player_id-or-player-key>\`
- X canonicalで \`x:unknown:*\`、\`x:nourl:*\`、\`x:undefined\` は0件
- 同一post/player/claimの重複は canonical側で ${m.duplicate_rows_collapsed}行をcollapseし、source record IDsをcanonical rowに保持した
- raw / classifiedは削除・上書きしていない

## 4. classification hygiene

- directional rating、speed-specific physical、general aging/injury context、baserunning/stealing techniqueを別facetで保持した
- \`evidence_subtype=SPEED_SPECIFIC_PHYSICAL\` または複合claim用の明示subtypeを付与した
- 走塁・盗塁・ベーラン・スタート判断だけの記録をpure speedへ昇格していない
- joke markerがあっても、本文に方向付きratingまたは直接physical claimがあれば捨てていない
- ACL/手術/年齢/一般的な衰えだけで走力を直接述べない記録は \`GENERAL_AGING_INJURY_CONTEXT\` として分離した

## 5. current-100 / identity regression

- current_100はsource flagを信じず、masterのcanonical player_idから再計算した
- 西川史礁は西川龍馬へ結び付けていない
- 山本大斗は山本祐大へ結び付けていない
- current-100 mapping regression、WEB混入、duplicate canonical key、legacy event tokenをQAで検査した

## 6. QA

既存canonical datasetのみを使った層別sample reviewを実施した。strataは directional rating、speed-specific physical、general context、rejected/noise/unclear、identity edge cases。各stratumは可能なら20件、件数不足は全件をreviewした。sample count / error count / corrected countは machine-readable QA JSON に保存した。

## 7. official discovery / evidence limits

既存Grok artifactには公式X投稿、公式投稿へのreply/quote、community X recordが含まれる。今回のcleanupは取得範囲を広げていない。

残る欠損は「存在しない」というnegative findingではなく、このbounded artifactで未取得・未同定・current-100 hitなしだった範囲として扱う。

${missing}

## 8. SP-035 status

**PARTIAL**

bounded X laneとして canonical化・current-100 mapping・分類衛生・QAは完了した。一方、公式スレッドの全返信ページングは NOT_COLLECTED のままで、current-100の一部にはこのartifact内のX post hitがない。これは取得不能を証拠不存在へ変換する理由ではないため、SP-035は PARTIAL を維持する。

Canonical artifacts:

- \`outputs/derived/speed_community_v3_x_canonical_20260815.jsonl\`
- \`outputs/derived/speed_community_v3_x_supplemental_web_20260815.jsonl\`
- \`outputs/derived/speed_community_v3_x_integrity_qa_20260815.json\`
- \`outputs/derived/speed_community_v3_x_qa_20260815.json\`
`;
}

const rawRows = readJsonl(RAW_PATH);
const classifiedRows = readJsonl(CLASSIFIED_PATH);
const classifiedIds = new Set(classifiedRows.map(row => clean(row.record_id)));
const rawIds = new Set(rawRows.map(row => clean(row.record_id)));
assert(rawRows.length > 0, 'raw input is empty');
assert(classifiedRows.length > 0, 'classified input is empty');
assert([...classifiedIds].every(id => rawIds.has(id)), 'classified contains record IDs absent from raw');

const masterCsvRows = readCsvFile(MASTER_CSV_PATH).filter(row => clean(row.player));
const masterJson = JSON.parse(fs.readFileSync(MASTER_JSON_PATH, 'utf8'));
const masterRows = masterCsvRows.map(row => ({ player: clean(row.player), player_id: clean(row.player_id), team: clean(row.team) }));
const scratchRows = (masterJson.players ?? []).map(row => ({ player: clean(row.player), player_id: clean(row.player_id), team: clean(row.team) }));
assert(masterRows.length === 100, `master CSV player count is ${masterRows.length}, expected 100`);
assert(scratchRows.length === 100, `scratch master player count is ${scratchRows.length}, expected 100`);
assert(new Set(masterRows.map(row => row.player)).size === 100, 'master CSV has duplicate player names');
assert(new Set(masterRows.map(row => row.player_id).filter(Boolean)).size === 99, 'master CSV player ID count changed unexpectedly');
assert(JSON.stringify(masterRows) === JSON.stringify(scratchRows), 'master CSV and scratch current-100 mapping disagree');
const byId = new Map(masterRows.filter(row => row.player_id).map(row => [row.player_id, row]));
const byName = new Map(masterRows.map(row => [normalizeName(row.player), row]));

const originalCoverage = readCsvFile(QUERY_PATH);
const originalCoverageRows = originalCoverage.filter(row => clean(row.query).startsWith('player_coverage:'));
assert(originalCoverageRows.length === 100, `query coverage has ${originalCoverageRows.length} player rows, expected 100`);
const searchedCount = originalCoverageRows.filter(row => ['HIT', 'SEARCHED_NO_HIT'].includes(clean(row.result))).length;
assert(searchedCount === 100, `current-100 searched count is ${searchedCount}, expected 100`);

const rawSha256 = sha256(RAW_PATH);
const classifiedSha256 = sha256(CLASSIFIED_PATH);
const xActual = [];
const xNonEvidence = [];
const webRows = [];
for (const row of rawRows) {
  const postId = extractPostId(row);
  if (isX(row)) {
    if (postId) xActual.push({ row, postId });
    else xNonEvidence.push({
      record_id: clean(row.record_id),
      source_type: clean(row.source_type),
      source_url: clean(row.source_url) || null,
      reason: clean(row.source_type).toUpperCase() === 'X_SEARCH_QUERY' ? 'query_without_post_id' : 'non_evidence_x_record_without_post_id',
    });
  } else webRows.push({ row, postId });
}
assert(xActual.length + xNonEvidence.length + webRows.length === rawRows.length, 'platform partition does not conserve raw rows');

const normalizedX = xActual.map(({ row, postId }) => normalizedRecord(row, 'X', identityFor(row, byId, byName), postId, 'X'));
const normalizedWeb = webRows.map(({ row, postId }) => {
  const identity = identityFor(row, byId, byName);
  const facets = classifyFacets(row);
  const originKey = clean(row.record_id) || clean(row.source_url) || crypto.createHash('sha1').update(JSON.stringify(row)).digest('hex').slice(0, 16);
  const eventId = `web:${originKey}:${identity.player_key}:${facets.claim_cluster}`;
  const independenceGroup = `web:${originKey}:${identity.player_key}`;
  return {
    ...normalizedRecord(row, 'WEB', identity, postId || null, 'WEB'),
    event_id: eventId,
    independence_group: independenceGroup,
    canonical_event_key: eventId,
    canonical_independence_group: independenceGroup,
    source_record_ids: [clean(row.record_id) || null].filter(Boolean),
    source_discovery_sources: [clean(row.discovery_source) || null].filter(Boolean),
    collapsed_duplicate_count: 0,
    dedupe_status: 'WEB_SUPPLEMENTAL_ROW_PRESERVED',
  };
});

const deduped = dedupe(normalizedX);
const canonicalRows = deduped.rows;
assert(canonicalRows.length > 0, 'canonical X dataset is empty');
assert(new Set(canonicalRows.map(row => row.event_id)).size === canonicalRows.length, 'duplicate canonical event keys remain');
assert(canonicalRows.every(row => row.platform === 'X'), 'non-X row entered canonical X dataset');
assert(canonicalRows.every(row => row.post_id), 'canonical X row lacks a post ID');
assert(canonicalRows.every(row => isCanonicalXIdentity(row)), 'canonical event_id/independence_group does not match post/player/claim');
assert(canonicalRows.every(row => !row.current_100 || (row.canonical_player_id && byId.has(row.canonical_player_id))), 'current_100 row is not master-id derived');
assert(canonicalRows.every(row => !/x:(unknown|nourl|undefined)/i.test(`${row.event_id} ${row.independence_group}`)), 'legacy X identity token remains');
assert(normalizedWeb.length === webRows.length, 'WEB row count changed during separation');
assert(normalizedWeb.every(row => row.platform === 'WEB'), 'supplemental row is not WEB');

// Explicit regressions requested by the task. These names must remain non-current and unmapped.
const specialRows = canonicalRows.filter(row => ['西川史礁', '山本大斗'].includes(normalizeName(row.source_player || row.player)));
assert(specialRows.length >= 2, 'explicit current-100 identity regression rows are missing');
assert(specialRows.every(row => row.canonical_player_id == null && row.current_100 === false), 'special non-current names were mapped into current-100');
assert(!specialRows.some(row => normalizeName(row.source_player || row.player) === '西川史礁' && row.canonical_player_id === '71475132'), '西川史礁 mapped to 西川龍馬');
assert(!specialRows.some(row => normalizeName(row.source_player || row.player) === '山本大斗' && row.canonical_player_id === '23125136'), '山本大斗 mapped to 山本祐大');

const officialPostRows = canonicalRows.filter(row => ['OFFICIAL_POST', 'OFFICIAL_X_POST', 'TIER_B_CONTEXT_OFFICIAL_POST'].includes(clean(row.source_type).toUpperCase()));
const replyQuoteRows = canonicalRows.filter(row => ['OFFICIAL_REPLY', 'OFFICIAL_QUOTE', 'OFFICIAL_POST_REPLY'].includes(clean(row.source_type).toUpperCase()) || clean(row.parent_event_id));
const uniquePostIds = new Set(canonicalRows.map(row => row.post_id));
const uniqueOrigins = new Set(canonicalRows.map(row => row.independence_group));
const currentHits = canonicalRows.filter(row => row.current_100);
const currentRating = currentHits.filter(row => row.has_directional_rating_claim);
const currentPhysical = currentHits.filter(row => row.has_speed_specific_physical_claim);
const metrics = {
  x_primary_rows: canonicalRows.length,
  unique_x_post_ids: uniquePostIds.size,
  unique_independence_groups: uniqueOrigins.size,
  unique_origin_count: uniqueOrigins.size,
  duplicate_rows_collapsed: deduped.collapsed,
  current_100_searched: searchedCount,
  current_100_total: masterRows.length,
  current_100_with_raw_x_hit: new Set(currentHits.map(row => row.canonical_player_id)).size,
  current_100_with_directional_rating_claim: new Set(currentRating.map(row => row.canonical_player_id)).size,
  current_100_with_speed_specific_physical_claim: new Set(currentPhysical.map(row => row.canonical_player_id)).size,
  directional_rating_claim_count: canonicalRows.filter(row => row.has_directional_rating_claim).length,
  speed_specific_physical_count: canonicalRows.filter(row => row.has_speed_specific_physical_claim).length,
  general_context_count: canonicalRows.filter(row => row.has_general_aging_injury_context).length,
  official_x_post_count: new Set(officialPostRows.map(row => row.post_id)).size,
  official_x_post_row_count: officialPostRows.length,
  reply_quote_count_known: replyQuoteRows.length,
  reply_quote_unique_post_count: new Set(replyQuoteRows.map(row => row.post_id)).size,
  supplemental_web_rows: normalizedWeb.length,
  unresolved_identity_count: canonicalRows.filter(row => row.identity_status === 'UNRESOLVED_NO_PLAYER').length,
  named_non_current_rows: canonicalRows.filter(row => row.identity_status === 'NAMED_NON_CURRENT_OR_UNMAPPED').length,
  current_100_players_covered: new Set(currentHits.map(row => row.canonical_player_id)).size,
  x_non_evidence_excluded: xNonEvidence.length,
};

const playerSummary = canonicalPlayerMetrics(canonicalRows, masterRows);
const coverage = buildCoverageRows(originalCoverage, masterRows, canonicalRows);
const missingCurrentPlayers = playerSummary.filter(row => row.n_records === 0).map(row => row.player);
const missingness = [
  `公式スレッドの認証付き全返信ページングは NOT_COLLECTED（canonical known reply/quote rows=${metrics.reply_quote_count_known}）。`,
  `current-100 ${missingCurrentPlayers.length}人はこのbounded X artifactでcanonical post hitがない（${missingCurrentPlayers.join('、')}）。これは発言不存在のnegative findingではない。`,
  'PowerPro公式の個別走力本文は既存query結果で薄く、画像・公式サイト側の能力値取得は今回のcleanup範囲外。',
  'X_SEARCH_QUERYのNOT_FOUND/HITS_BUT_IRRELEVANT、account metadata、入口recordはrawに保持したがcanonical evidence originには数えていない。',
];

const strata = [
  buildStratum('directional_rating_claims', canonicalRows.filter(row => row.has_directional_rating_claim), byId),
  buildStratum('speed_specific_physical_claims', canonicalRows.filter(row => row.has_speed_specific_physical_claim), byId),
  buildStratum('general_aging_injury_context', canonicalRows.filter(row => row.has_general_aging_injury_context), byId),
  buildStratum('rejected_noise_unclear', canonicalRows.filter(row => row.claim_facets.every(facet => ['NOISE_OR_UNCLEAR', 'RATING_CONTEXT', 'BASERUNNING_TECHNIQUE', 'GAMEPLAY_MECHANICS'].includes(facet))), byId),
];
const identityEdgeEligible = canonicalRows.filter(row => row.canonical_player_id == null || row.identity_status !== 'CURRENT_100_MASTER' || ['西川史礁', '山本大斗'].includes(normalizeName(row.source_player || row.player)));
const identityEdge = buildStratum('identity_edge_cases', identityEdgeEligible, byId);
const reviewedRows = new Set([...strata, identityEdge].flatMap(stratum => stratum.sampled_event_ids));
const sampleErrorCount = [...strata, identityEdge].reduce((sum, stratum) => sum + stratum.error_count, 0);
const qaSummary = {
  sample_count: reviewedRows.size,
  error_count: sampleErrorCount,
  corrected_count: 0,
  review_scope: 'post-cleanup canonical X dataset only; no new search or Web retrieval',
};
assert(sampleErrorCount === 0, `QA sample has ${sampleErrorCount} errors`);

const checkResults = {
  raw_evidence_sha256_recorded: Boolean(rawSha256),
  classified_evidence_sha256_recorded: Boolean(classifiedSha256),
  classified_subset_of_raw: true,
  current_100_master_count_100: masterRows.length === 100,
  current_100_searched_100: searchedCount === 100,
  canonical_platform_all_x: canonicalRows.every(row => row.platform === 'X'),
  supplemental_web_separate: normalizedWeb.every(row => row.platform === 'WEB') && normalizedWeb.length === metrics.supplemental_web_rows,
  canonical_post_ids_present: canonicalRows.every(row => Boolean(row.post_id)),
  canonical_event_legacy_tokens_zero: canonicalRows.filter(row => /x:(unknown|nourl|undefined)/i.test(`${row.event_id} ${row.independence_group}`)).length === 0,
  duplicate_canonical_keys_zero: new Set(canonicalRows.map(row => row.event_id)).size === canonicalRows.length,
  current_100_mapping_master_derived: canonicalRows.every(row => row.current_100 === byId.has(row.canonical_player_id)),
  nishikawa_regression: specialRows.filter(row => normalizeName(row.source_player || row.player) === '西川史礁').every(row => row.canonical_player_id !== '71475132'),
  yamamoto_regression: specialRows.filter(row => normalizeName(row.source_player || row.player) === '山本大斗').every(row => row.canonical_player_id !== '23125136'),
  x_count_does_not_include_web: xActual.length + metrics.supplemental_web_rows + metrics.x_non_evidence_excluded === rawRows.length,
  raw_hash_inputs_captured: true,
};
assert(Object.values(checkResults).every(Boolean), `one or more integrity checks failed: ${JSON.stringify(Object.entries(checkResults).filter(([, value]) => !value).map(([key]) => key))}`);

const cleanupFixes = {
  x_actual_rows_before_dedupe: xActual.length,
  non_evidence_x_rows_excluded_from_canonical: xNonEvidence.length,
  web_rows_separated: normalizedWeb.length,
  canonical_event_ids_normalized: canonicalRows.length,
  canonical_independence_groups_normalized: canonicalRows.length,
  duplicate_rows_collapsed: deduped.collapsed,
  canonical_claim_facets_assigned: canonicalRows.length,
  current_100_flags_recomputed_from_master: canonicalRows.length,
};

const integrityQa = {
  generated_at: '2026-08-15',
  task: 'SP-035',
  mode: 'DETERMINISTIC_CLEANUP_ONLY',
  source_artifacts: {
    raw: 'outputs/derived/speed_community_v3_x_raw_20260815.jsonl',
    classified: 'outputs/derived/speed_community_v3_x_classified_20260815.jsonl',
    query_coverage: 'outputs/derived/speed_community_v3_x_query_coverage_20260815.csv',
    current_100_master: 'outputs/derived/speed_2026_100_owner_review_master_20260813.csv',
  },
  source_hashes: { raw_sha256: rawSha256, classified_sha256: classifiedSha256 },
  input_counts: { raw_rows: rawRows.length, classified_rows: classifiedRows.length, classified_rows_in_raw: classifiedRows.length },
  canonical_counts: metrics,
  cleanup_fixes: cleanupFixes,
  qa_summary: qaSummary,
  strata,
  identity_edge_cases: identityEdge,
  checks: checkResults,
  explicit_identity_regressions: {
    nishikawa_fumio: '西川史礁 remains unmapped/non-current; not 西川龍馬',
    yamamoto_hiroto: '山本大斗 remains unmapped/non-current; not 山本祐大',
  },
  missingness,
  status: 'PASS',
};

const qa = {
  generated_at: '2026-08-15',
  task: 'SP-035',
  status: 'PASS',
  proposed_sp035_status: 'PARTIAL',
  proposed_status_reason: 'Canonical X integrity is repaired, but full official reply paging remains NOT_COLLECTED and bounded current-100 hit coverage is incomplete. This is not a negative finding.',
  current_100_players_searched: metrics.current_100_searched,
  current_100_players_total: metrics.current_100_total,
  players_with_ge1_raw_hit: metrics.current_100_with_raw_x_hit,
  players_with_ge1_rating_claim: metrics.current_100_with_directional_rating_claim,
  players_with_ge1_physical_claim: metrics.current_100_with_speed_specific_physical_claim,
  official_posts_discovered: metrics.official_x_post_count,
  replies_quotes_collected: metrics.reply_quote_count_known,
  raw_candidate_count: rawRows.length,
  canonical_x_rows: metrics.x_primary_rows,
  accepted_rating_claim_count: metrics.directional_rating_claim_count,
  speed_specific_physical_claim_count: metrics.speed_specific_physical_count,
  general_aging_injury_context_count: metrics.general_context_count,
  supplemental_web_rows: metrics.supplemental_web_rows,
  unique_origin_count: metrics.unique_origin_count,
  unresolved_identity_count: metrics.unresolved_identity_count,
  duplicate_rows_collapsed: metrics.duplicate_rows_collapsed,
  false_negative_sample: [
    { id: '1931247163016667566', note: '野間のまだ走力A claim remains a rating claim; joke/stale wording was not discarded' },
    { id: '2087467009147834775', note: '柳田の全力疾走/衰え知らず claim remains speed-specific physical' },
    { id: '2081646323414224919', note: '西川史礁 remains unmapped and is not assigned to 西川龍馬' },
  ],
  false_positive_sample: [
    { id: '2077699813446201580', note: 'power-only official reply remains context and is not promoted to speed rating' },
    { id: '2070439838969393261', note: 'gameplay 同値速報 remains non-speed context' },
  ],
  qa_sample_count: qaSummary.sample_count,
  qa_error_count: qaSummary.error_count,
  qa_corrected_count: qaSummary.corrected_count,
  cleanup_fixes: cleanupFixes,
  missingness,
  canonical_artifacts: [
    'outputs/derived/speed_community_v3_x_canonical_20260815.jsonl',
    'outputs/derived/speed_community_v3_x_supplemental_web_20260815.jsonl',
    'outputs/derived/speed_community_v3_x_integrity_qa_20260815.json',
    'outputs/derived/speed_community_v3_x_qa_20260815.json',
    'outputs/derived/speed_community_v3_x_player_summary_20260815.csv',
    'outputs/derived/speed_community_v3_x_query_coverage_20260815.csv',
    'docs/audits/speed_community_v3_x_recollection_20260815.md',
    'docs/state/speed_task_registry.tsv',
  ],
};

const officialInventory = officialPostRows.map(row => ({
  post_id: row.post_id,
  record_id: row.record_id,
  handle: row.handle || null,
  url: row.source_url || null,
  published_at: row.published_at || null,
  text: row.text_or_excerpt || '',
  source_type: row.source_type || null,
  game: row.game || null,
  edition: row.edition || null,
  player: row.player || null,
  canonical_player_id: row.canonical_player_id || null,
  current_100: row.current_100,
  event_id: row.event_id,
  independence_group: row.independence_group,
})).sort((a, b) => `${a.post_id}:${a.record_id}`.localeCompare(`${b.post_id}:${b.record_id}`));

const officialInventoryCsv = officialInventory.map(row => ({ ...row, current_100: row.current_100 ? 1 : 0 }));

const registryText = fs.readFileSync(REGISTRY_PATH, 'utf8');
const registryLineMatch = registryText.match(/^SP-035\t[^\r\n]*/m);
assert(registryLineMatch, 'SP-035 registry row not found');
const registryFields = registryLineMatch[0].split('\t');
assert(registryFields.length === 10, `SP-035 registry field count is ${registryFields.length}`);
registryFields[1] = 'PARTIAL';
registryFields[8] = `Canonical X integrity cleanup complete: X-only canonical rows=${metrics.x_primary_rows}; directional rating=${metrics.directional_rating_claim_count}; speed-specific physical=${metrics.speed_specific_physical_count}; current-100 covered=${metrics.current_100_with_raw_x_hit}; unique origins=${metrics.unique_origin_count}; supplemental WEB rows=${metrics.supplemental_web_rows}. Full official reply paging remains NOT_COLLECTED; no negative finding. Proposed status=PARTIAL. Counts are recalculated from canonical X dataset.`;
const artifactPaths = [
  'scripts/cleanup_speed_community_v3_x_sp035_20260815.mjs',
  'outputs/derived/speed_community_v3_x_canonical_20260815.jsonl',
  'outputs/derived/speed_community_v3_x_supplemental_web_20260815.jsonl',
  'outputs/derived/speed_community_v3_x_official_post_inventory_20260815.jsonl',
  'outputs/derived/speed_community_v3_x_official_post_inventory_20260815.csv',
  'outputs/derived/speed_community_v3_x_integrity_qa_20260815.json',
  'outputs/derived/speed_community_v3_x_qa_20260815.json',
  'outputs/derived/speed_community_v3_x_player_summary_20260815.csv',
  'outputs/derived/speed_community_v3_x_query_coverage_20260815.csv',
  'docs/audits/speed_community_v3_x_recollection_20260815.md',
];
for (const artifact of artifactPaths) if (!registryFields[9].split(';').includes(artifact)) registryFields[9] += `;${artifact}`;
const updatedRegistryLine = registryFields.join('\t');
const updatedRegistryText = registryText.replace(registryLineMatch[0], updatedRegistryLine);

writeJsonl(canonicalPath, canonicalRows);
writeJsonl(supplementalPath, normalizedWeb.sort((a, b) => a.event_id.localeCompare(b.event_id)));
writeJsonl(officialInventoryPath, officialInventory);
writeCsv(officialInventoryCsvPath, officialInventoryCsv, ['post_id', 'record_id', 'handle', 'url', 'published_at', 'text', 'source_type', 'game', 'edition', 'player', 'canonical_player_id', 'current_100', 'event_id', 'independence_group']);
writeCsv(summaryPath, playerSummary, ['player', 'player_id', 'team', 'current_100', 'n_records', 'origin_count', 'reaction_volume', 'n_rating', 'n_directional_rating', 'n_speed_specific_physical', 'n_general_context', 'top_directions']);
writeCsv(coveragePath, coverage.rows, ['query', 'tool', 'result', 'players', 'note', 'canonical_x_rows', 'canonical_directional_rating', 'canonical_speed_specific_physical', 'canonical_general_context']);
writeAtomic(qaPath, JSON.stringify(qa, null, 2) + '\n');
writeAtomic(integrityQaPath, JSON.stringify(integrityQa, null, 2) + '\n');
writeAtomic(auditPath, buildAudit(metrics, missingness, { raw_rows: rawRows.length, classified_rows: classifiedRows.length }));
writeAtomic(REGISTRY_PATH, updatedRegistryText);

// Re-read the protected inputs after all writes to prove raw evidence was not changed.
assert(sha256(RAW_PATH) === rawSha256, 'raw evidence hash changed during cleanup');
assert(sha256(CLASSIFIED_PATH) === classifiedSha256, 'classified evidence hash changed during cleanup');

console.log(JSON.stringify({
  branch_expected: 'codex/luna-sp035-integrity-cleanup-20260815',
  input: { raw_rows: rawRows.length, classified_rows: classifiedRows.length, x_actual_rows: xActual.length, x_non_evidence: xNonEvidence.length, web_rows: webRows.length },
  canonical: metrics,
  qa: qaSummary,
  status: 'PASS',
}, null, 2));
