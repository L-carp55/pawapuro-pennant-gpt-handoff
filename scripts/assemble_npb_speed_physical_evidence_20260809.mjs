// Assemble the owner-requested, provenance-preserving NPB short-distance evidence file.
// This is a collection artifact only: it reads existing curated data and the 2026-08-09
// player-by-player research results, and never edits ratings, models, or the database.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'data/manual/npb_speed_physical_evidence_full_20260809.json';
const norm = value => (value ?? '').normalize('NFKC').replace(/\s+/g, '');
const loadJson = rel => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));

function atomicWrite(rel, content) {
  const full = path.join(ROOT, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(`${full}.tmp`, content, 'utf8');
  renameSync(`${full}.tmp`, full);
}

const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const targets = db.prepare(`
  SELECT name, team, top_speed_kmh
  FROM npb_plus_measurement
  WHERE top_speed_kmh IS NOT NULL
  ORDER BY team, name
`).all();
db.close();
const playersByName = new Map(targets.map(row => [norm(row.name), {
  player: row.name,
  team: row.team,
  npb_plus_sprint_speed_kmh: row.top_speed_kmh,
  search: {
    completed: true,
    outcome: 'searched_no_data',
    primary_search_destinations: [
      'Japanese web search',
      'newspaper / sports-media article bodies',
      'team, university, high-school, and draft-profile pages',
    ],
    query_log: [],
  },
  records: [],
}]));

function queryLog(player) {
  const name = norm(player);
  return [
    {
      query: `${name} 30m 50m`,
      search_family: 'pure_short_distance',
      result: '検索完了。本文確認できた記録だけをrecordsへ登録し、検索断片だけの候補は除外。',
    },
    {
      query: `${name} 足 速い タイム 身体能力`,
      search_family: 'physical_profile',
      result: '検索完了。計測方式・年代が欠けるプロフィール値はHISTORICAL_PROFILE_HINTへ分離。',
    },
    {
      query: `${name} 一塁到達 ドラフト`,
      search_family: 'home_to_first_and_draft',
      result: '検索完了。一塁到達はCONTEXT_ONLYとして、純粋なT90入力から除外。',
    },
  ];
}

for (const row of playersByName.values()) row.search.query_log = queryLog(row.player);

function record(fields) {
  return {
    measurement_year: 'unknown',
    age: 'unknown',
    affiliation: 'unknown',
    timing_method: 'unknown',
    start_protocol: 'unknown',
    surface: 'unknown',
    shoe: 'unknown',
    indoor_outdoor: 'unknown',
    cohort: 'unknown',
    source_tier: 'B',
    published_date: 'unknown',
    source_provenance: 'media profile; original measurement source not identified',
    source_verification: 'page body confirmed during 2026-08-09 research',
    usage_class: 'HISTORICAL_PROFILE_HINT',
    confidence: 'medium',
    numeric_t90_usable: false,
    ...fields,
  };
}

function add(player, fields) {
  const row = playersByName.get(norm(player));
  if (!row) throw new Error(`Non-target evidence supplied for ${player}`);
  row.records.push(record(fields));
}

function addExisting(player, fields) {
  add(player, {
    evidence_origin: 'existing_repository_evidence',
    source_verification: 'preserved existing curated record; not counted as a new independent measurement',
    ...fields,
  });
}

// Existing direct 30m reports. Their sources are credible media reports, but the physical-test
// protocol was not disclosed, so source reliability and measurement usability stay separate.
for (const row of loadJson('data/manual/sprint_30m_measurements_curated.json').records) {
  if (!playersByName.has(norm(row.player))) continue;
  addExisting(row.player, {
    metric: '30m',
    seconds: row.seconds_30m,
    measurement_year: Number.isFinite(row.season) ? row.season : 'unknown',
    affiliation: row.team ?? 'unknown',
    timing_method: row.timing_device ?? 'unknown',
    start_protocol: row.start_protocol ?? 'unknown',
    surface: row.surface ?? 'unknown',
    cohort: row.context ?? 'unknown',
    source_tier: 'B',
    source_name: row.source_name,
    source_url: row.source_url,
    source_provenance: 'contemporaneous media reporting of a team physical test; instrument details not published',
    same_measurement_cluster_id: `existing_30m_${norm(row.player)}_${row.season ?? 'unknown'}`,
    usage_class: 'HISTORICAL_PROFILE_HINT',
    confidence: row.confidence ?? 'medium',
    reason: row.note ?? '30m test with insufficient protocol details for current T90 conversion.',
  });
}

// Preserve the previously audited outlier cases once, rather than re-counting later media copies.
for (const row of loadJson('data/manual/speed_outlier_short_distance_evidence_20260809.json').records) {
  if (!playersByName.has(norm(row.player))) continue;
  const sourceUrl = row.source_url ?? row.source_urls?.[0];
  addExisting(row.player, {
    metric: row.metric,
    ...(Number.isFinite(row.seconds) ? { seconds: row.seconds } : {}),
    ...(Array.isArray(row.seconds_range) ? { seconds_range: row.seconds_range } : {}),
    measurement_year: Number.isFinite(row.measurement_year) ? row.measurement_year : 'unknown',
    affiliation: row.context?.includes('高校') ? 'high-school period' : 'unknown',
    timing_method: 'unknown',
    start_protocol: row.protocol_class === 'special_first_step_start' ? 'special_first_step_start' : 'unknown',
    cohort: row.context ?? 'unknown',
    source_tier: 'B',
    source_name: row.source_name,
    source_url: sourceUrl,
    ...(Array.isArray(row.source_urls) ? { corroborating_source_urls: row.source_urls.slice(1) } : {}),
    source_provenance: 'media/scouting profile; underlying measurement protocol not fully published',
    same_measurement_cluster_id: `existing_outlier_${norm(row.player)}_${row.metric}_${row.seconds ?? row.seconds_range?.join('_')}`,
    usage_class: row.protocol_class === 'special_first_step_start' ? 'REJECTED_FOR_SPEED' : 'HISTORICAL_PROFILE_HINT',
    confidence: row.protocol_class === 'special_first_step_start' ? 'high' : 'medium',
    reason: row.context ?? 'Existing short-distance profile evidence; not directly converted to current T90.',
  });
}

// The shared university representative-camp session is standardized, but 50m has no validated
// NPB+->T90 bridge. Retain it as a STANDARDIZED_PRIOR rather than a numeric current-season input.
const standardized50 = loadJson('data/manual/standardized_50m_electronic_reference.json');
for (const row of standardized50.records) {
  if (!playersByName.has(norm(row.player))) continue;
  const source = standardized50.sources.find(item => item.cohort === row.measurement_date);
  addExisting(row.player, {
    metric: '50m',
    seconds: row.seconds_50m,
    measurement_year: Number(row.measurement_date.slice(0, 4)),
    affiliation: 'university period',
    timing_method: row.protocol,
    start_protocol: 'unknown',
    cohort: row.event,
    source_tier: 'C',
    source_name: 'Existing standardized 50m reference',
    source_url: source.source_url,
    source_provenance: 'third-party reporting of a shared electronic/photoelectric camp test',
    same_measurement_cluster_id: `standardized_50m_${row.measurement_date}_${norm(row.player)}`,
    usage_class: 'STANDARDIZED_PRIOR',
    confidence: 'high',
    reason: 'Shared electronic/photoelectric 50m test is comparable within its cohort, but it is historical and has no validated NPB+ T90 bridge.',
  });
}

// Existing public in-game home-to-first records are deliberately preserved as contextual data.
// The NPB+ database column itself is not re-added: it is not independent evidence and lacks a
// public per-run protocol in the supplied source snapshot.
let hpIndex = 0;
for (const row of loadJson('data/manual/hp_to_1b_measurements_curated.json').records) {
  if (!playersByName.has(norm(row.player))) continue;
  hpIndex += 1;
  const condition = row.condition_class ?? 'unknown';
  addExisting(row.player, {
    metric: 'hp_to_1b',
    seconds: row.seconds,
    measurement_year: Number.isFinite(row.season) ? row.season : 'unknown',
    affiliation: row.team ?? 'unknown',
    timing_method: row.timing_origin ?? 'unknown',
    start_protocol: condition === 'bunt' ? 'swing_to_run_bunt' : condition === 'headslide' ? 'swing_to_run_headslide' : 'swing_to_run',
    cohort: row.context ?? 'unknown',
    source_tier: 'B',
    source_name: row.source_name,
    source_url: row.source_url,
    source_provenance: 'media reporting of an in-game home-to-first event',
    same_measurement_cluster_id: `existing_hp_to_1b_${norm(row.player)}_${row.season ?? 'unknown'}_${row.seconds}_${hpIndex}`,
    usage_class: 'CONTEXT_ONLY',
    confidence: row.confidence ?? 'medium',
    reason: row.reason ?? 'Home-to-first contains batting, run-start, and game-context effects; never use as direct T90.',
  });
}

// The earlier audit includes one non-MLB event speed that is not a controlled sprint test.
addExisting('周東 佑京', {
  metric: 'event_max_speed',
  value: 30.4,
  unit: 'ft/s',
  measurement_year: 2023,
  affiliation: 'Japan national team',
  timing_method: 'Statcast event tracking',
  start_protocol: 'in-game baserunning event',
  cohort: '2023 WBC semifinal, one event',
  source_tier: 'B',
  source_name: 'Full-Count',
  source_url: 'https://full-count.jp/2023/03/21/post1354277/',
  source_provenance: 'media report of a single Statcast-tracked game event',
  same_measurement_cluster_id: 'shuto_wbc_2023_event_max_speed',
  usage_class: 'HISTORICAL_PROFILE_HINT',
  confidence: 'medium',
  reason: 'A one-event maximum speed is not a season Sprint Speed or a controlled short-distance physical test.',
});

// Retain all six already-collected official MLB running-split sets. T10/T30/T90 are feet, not
// metres; only the two within the project\'s four-year temporal gate are current numeric candidates.
const mlbAudit = loadJson('outputs/derived/npb_plus_mlb_sprint_overlap_audit_20260809.json');
for (const row of mlbAudit.overlaps) {
  const targetRow = playersByName.get(norm(row.npb_name));
  const player = targetRow?.player;
  if (!player) throw new Error(`MLB audit player is not an NPB+ target: ${row.npb_name}`);
  targetRow.search.query_log.push(
    {
      query: `${row.name_en} running splits`,
      search_family: 'mlb_running_splits',
      result: 'Existing official Baseball Savant running-split audit retained in records; NPB+ numerical equivalence remains unestablished.',
    },
    {
      query: `${row.name_en} sprint speed`,
      search_family: 'mlb_sprint_speed',
      result: 'Existing official Baseball Savant seasonal Sprint Speed audit retained in records.',
    },
  );
  const year = row.mlb_latest_year;
  const cluster = `mlb_statcast_running_splits_${norm(player)}_${year}`;
  const runningUrl = `https://baseballsavant.mlb.com/running_splits?bats=&min=5&position=&team=&type=raw&year=${year}`;
  const sprintUrl = `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${year}&position=&team=&min=10`;
  const common = {
    measurement_year: year,
    affiliation: 'MLB',
    timing_method: 'Statcast official leaderboard',
    start_protocol: 'qualified home-to-first runs extrapolated to 90ft',
    surface: 'baseball field; exact surface unknown',
    indoor_outdoor: 'unknown',
    cohort: 'seasonal qualified MLB runs',
    source_tier: 'A',
    source_name: 'Baseball Savant / Statcast',
    source_provenance: 'official first-party leaderboard',
    source_verification: 'preserved from existing direct-overlap audit; official leaderboard URL retained',
    same_measurement_cluster_id: cluster,
    evidence_origin: 'existing_repository_evidence',
    confidence: 'high',
  };
  add(player, {
    ...common,
    metric: 'T10ft',
    seconds: row.mlb_latest_actual.t10_sec,
    source_url: runningUrl,
    usage_class: 'STANDARDIZED_PRIOR',
    numeric_t90_usable: false,
    reason: 'Official 10ft running split; retain separately from 10m and do not assume NPB+ equivalence.',
  });
  add(player, {
    ...common,
    metric: 'T30ft',
    seconds: row.mlb_latest_actual.t30_sec,
    source_url: runningUrl,
    usage_class: 'STANDARDIZED_PRIOR',
    numeric_t90_usable: false,
    reason: 'Official 30ft running split; retain separately from 30m and do not assume NPB+ equivalence.',
  });
  add(player, {
    ...common,
    metric: 'T90ft',
    seconds: row.mlb_latest_actual.t90_sec,
    source_url: runningUrl,
    usage_class: row.temporal_bridge_candidate ? 'NUMERIC_T90_CANDIDATE' : 'HISTORICAL_PROFILE_HINT',
    numeric_t90_usable: Boolean(row.temporal_bridge_candidate),
    reason: row.temporal_bridge_candidate
      ? 'Official direct 90ft value within the project\'s four-year temporal gate; candidate only for the individual appraisal, not an NPB+ bridge calibration.'
      : 'Official direct 90ft value retained as historical profile evidence; year gap exceeds the project\'s four-year current-use gate.',
  });
  add(player, {
    ...common,
    metric: 'MLB_Sprint_Speed',
    value: row.mlb_sprint_speed_ftps,
    unit: 'ft/s',
    source_url: sprintUrl,
    usage_class: row.temporal_bridge_candidate ? 'STANDARDIZED_PRIOR' : 'HISTORICAL_PROFILE_HINT',
    numeric_t90_usable: false,
    reason: 'Official MLB seasonal Sprint Speed; units and public aggregation equivalence with NPB+ are not established.',
  });
}

// A pre-existing, body-confirmed 50m report that would otherwise be duplicated by a 2026 repost.
addExisting('岡林 勇希', {
  metric: '50m',
  seconds: 5.8,
  measurement_year: 2019,
  affiliation: '菰野高校',
  source_tier: 'B',
  source_name: '日刊スポーツ',
  source_url: 'https://www.nikkansports.com/baseball/news/201910290000658.html',
  source_provenance: 'media draft profile; 2026 repost treated as the same profile claim',
  same_measurement_cluster_id: 'okabayashi_komono_50m_profile',
  usage_class: 'HISTORICAL_PROFILE_HINT',
  confidence: 'medium',
  reason: 'High-school profile value; timing, start, and surface are unknown.',
});

// New 2026-08-09 page-body-confirmed research. All ordinary 50m values remain historical
// profile hints unless a shared protocol and current temporal relevance are actually shown.
const newRecords = [
  ['名原 典彦', { metric: '50m', seconds: 6.2, affiliation: '瀬戸内高校', timing_method: 'manual', source_name: 'web Sportiva', source_url: 'https://sportiva.shueisha.co.jp/clm/baseball/hs_other/2022/10/02/post_85/?page=2', published_date: '2022-10-02', source_provenance: 'reported athlete measurement history', same_measurement_cluster_id: 'nabara_50m_setouchi_manual', confidence: 'high', reason: 'High-school manual 50m; measurement year, start rule, and surface are not published.' }],
  ['名原 典彦', { metric: '50m', seconds: 5.9, affiliation: '青森大学', timing_method: 'electronic', source_name: 'web Sportiva', source_url: 'https://sportiva.shueisha.co.jp/clm/baseball/hs_other/2022/10/02/post_85/?page=2', published_date: '2022-10-02', source_provenance: 'reported athlete measurement history', same_measurement_cluster_id: 'nabara_50m_aomoriu_electronic', confidence: 'high', reason: 'University electronic 50m; start rule, surface, and measurement date are not published.' }],
  ['坂倉 将吾', { metric: '50m', seconds: 6.4, affiliation: '日本大学第三高校', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/1737870.html', published_date: '2016-11-14', same_measurement_cluster_id: 'sakakura_50m_nichidai3_profile', confidence: 'high', reason: 'High-school profile value; test protocol is unknown.' }],
  ['小園 海斗', { metric: 'hp_to_1b', seconds: 4.05, measurement_year: 2016, affiliation: '報徳学園高校', start_protocol: 'swing_to_run_in_game', source_name: 'GOETHE', source_url: 'https://goetheweb.jp/person/article/20241128-star-kozonokaito', published_date: '2024-11-28', source_provenance: 'media retrospective of an in-game timing', same_measurement_cluster_id: 'kozono_hp_to_1b_2016', usage_class: 'CONTEXT_ONLY', reason: 'High-school game home-to-first time includes batting, batted-ball, and game context.' }],
  ['並木 秀尊', { metric: 'hp_to_1b', seconds: 3.96, affiliation: '獨協大学', start_protocol: 'swing_to_run_in_game', source_name: 'Number Web', source_url: 'https://number.bunshun.jp/articles/-/846891?page=2', published_date: '2021-02-04', source_provenance: 'media report of a university game event', same_measurement_cluster_id: 'namiki_hp_to_1b_dokkyo_game', usage_class: 'CONTEXT_ONLY', reason: 'University-game home-to-first time, not a pure sprint test.' }],
  ['丸山 和郁', { metric: '50m', seconds: 5.8, affiliation: '明治大学', source_name: '4years.（朝日新聞社）', source_url: 'https://4years.asahi.com/article/12432940', published_date: '2019-06-07', same_measurement_cluster_id: 'maruyama_50m_meiji_profile', confidence: 'high', reason: 'University profile value; test protocol is unknown.' }],
  ['丸山 和郁', { metric: 'hp_to_1b', seconds: 3.8, affiliation: '明治大学', start_protocol: 'swing_to_run_in_game', source_name: '4years.（朝日新聞社）', source_url: 'https://4years.asahi.com/article/12432940', published_date: '2019-06-07', source_provenance: 'media report of a university game event', same_measurement_cluster_id: 'maruyama_hp_to_1b_meiji_game', usage_class: 'CONTEXT_ONLY', reason: 'Home-to-first after batting is contextual, not a pure sprint test.' }],
  ['塩見 泰隆', { metric: 'hp_to_1b', seconds: 4.15, affiliation: 'JX-ENEOS', start_protocol: 'swing_to_run_in_game', source_name: 'Number Web', source_url: 'https://number.bunshun.jp/articles/-/833298?page=2', source_provenance: 'media retrospective of an in-game timing', same_measurement_cluster_id: 'shiomi_hp_to_1b_jxeneos_415', usage_class: 'CONTEXT_ONLY', reason: 'In-game home-to-first time; batted-ball and start conditions are part of the value.' }],
  ['塩見 泰隆', { metric: 'hp_to_1b', seconds: 4.26, affiliation: 'JX-ENEOS', start_protocol: 'swing_to_run_in_game', source_name: 'Number Web', source_url: 'https://number.bunshun.jp/articles/-/833298?page=2', source_provenance: 'media retrospective of an in-game timing', same_measurement_cluster_id: 'shiomi_hp_to_1b_jxeneos_426', usage_class: 'CONTEXT_ONLY', reason: 'In-game home-to-first time; batted-ball and start conditions are part of the value.' }],
  ['吉川 尚輝', { metric: '50m', seconds: 5.7, affiliation: '中京学院大学', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/1738288.html', published_date: '2016-11-15', same_measurement_cluster_id: 'yoshikawa_50m_chukyo_profile', confidence: 'high', reason: 'University profile value; test protocol is unknown.' }],
  ['吉川 尚輝', { metric: 'hp_to_1b', seconds: 4.36, measurement_year: 2016, affiliation: '中京学院大学', start_protocol: 'swing_to_run_in_game_triple', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/1658951.html', published_date: '2016-06-06', source_provenance: 'media game-event report', same_measurement_cluster_id: 'yoshikawa_hp_to_1b_2016_triple', usage_class: 'CONTEXT_ONLY', reason: 'First-base passage on a triple is not a controlled short-distance sprint.' }],
  ['吉川 尚輝', { metric: 'hp_to_1b', seconds: 3.97, measurement_year: 2016, affiliation: '中京学院大学', start_protocol: 'swing_to_run_in_game_grounder', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/1658951.html', published_date: '2016-06-06', source_provenance: 'media game-event report', same_measurement_cluster_id: 'yoshikawa_hp_to_1b_2016_grounder', usage_class: 'CONTEXT_ONLY', reason: 'Home-to-first after a ground ball is contextual, not a pure sprint test.' }],
  ['佐藤 輝明', { metric: '50m', seconds: 6.0, affiliation: '近畿大学', source_name: 'スポニチアネックス', source_url: 'https://www.sponichi.co.jp/baseball/news/2020/10/26/kiji/20201025s00001728678000c.html', published_date: '2020-10-26', same_measurement_cluster_id: 'sato_50m_kindai_profile', confidence: 'high', reason: 'University profile value; distinct report from the preserved 2020 30m test, but still protocol-unknown.' }],
  ['小幡 竜平', { metric: '50m', seconds: 6.1, affiliation: '阪神タイガース', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/201901100000575.html', published_date: '2019-01-10', same_measurement_cluster_id: 'obata_50m_hanshin_profile', reason: 'Post-draft profile value; distinct from the preserved 30m test but protocol-unknown.' }],

  ['大島 洋平', { metric: 'hp_to_1b', seconds: 3.96, measurement_year: 2007, affiliation: '駒澤大学', start_protocol: 'swing_to_run_in_game_second_base_grounder', source_name: 'GOETHE', source_url: 'https://goetheweb.jp/person/article/20230907-yohei-oshima', published_date: '2023-09-07', source_provenance: 'media retrospective of a university game event', same_measurement_cluster_id: 'oshima_hp_to_1b_2007_grounder', usage_class: 'CONTEXT_ONLY', reason: 'University-game home-to-first time includes batting and game conditions.' }],
  ['大島 洋平', { metric: 'hp_to_1b', seconds: 3.79, measurement_year: 2007, affiliation: '駒澤大学', start_protocol: 'swing_to_run_bunt_early_start', source_name: 'GOETHE', source_url: 'https://goetheweb.jp/person/article/20230907-yohei-oshima', published_date: '2023-09-07', source_provenance: 'media retrospective of a university game event', same_measurement_cluster_id: 'oshima_hp_to_1b_2007_bunt', usage_class: 'CONTEXT_ONLY', reason: 'Bunt and early-start advantage make this contextual only.' }],
  ['田中 幹也', { metric: '50m', seconds: 5.9, affiliation: '亜細亜大学', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/202210310000557.html', published_date: '2022-10-31', same_measurement_cluster_id: 'tanaka_mikiya_adai_50m_profile', reason: 'University draft profile value; timing conditions are unknown.' }],
  ['滝澤 夏央', { metric: '50m', seconds: 5.8, affiliation: '関根学園高校', source_name: 'Number Web', source_url: 'https://number.bunshun.jp/articles/-/851084?page=1', published_date: '2021-12-12', same_measurement_cluster_id: 'takizawa_sekinegakuen_50m_profile', reason: 'High-school profile value; timing conditions are unknown.' }],
  ['京田 陽太', { metric: '50m', seconds: 5.9, affiliation: '日本大学', source_name: '侍ジャパン公式', source_url: 'https://www.japan-baseball.jp/jp/news/press/20160710_5.html', published_date: '2016-07-10', source_provenance: 'official national-team profile; underlying test protocol not stated', same_measurement_cluster_id: 'kyoda_nihon_u_50m_profile', reason: 'University profile value; method is unknown. A conflicting media 5.8 claim is not treated as a second measurement.' }],
  ['林 琢真', { metric: '50m', seconds: 5.7, affiliation: '駒澤大学', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/202210270001023.html', published_date: '2022-10-28', source_provenance: 'media report of a self-best stated after the camp test', same_measurement_cluster_id: 'hayashi_komazawa_postcamp_selfbest_50m', reason: 'Reported self-best is distinct from the preserved 5.99 electronic camp result, but its own date, timing method, and start are unknown.' }],
  ['梶原 昂希', { metric: '50m', seconds: 5.8, source_name: 'テレビ朝日ニュース', source_url: 'https://news.tv-asahi.co.jp/news_sports/articles/900020068.html', published_date: '2025-03-12', same_measurement_cluster_id: 'kajihara_50m_profile', reason: 'Profile value; measurement date and conditions are not published.' }],
  ['梶原 昂希', { metric: 'hp_to_1b', seconds: 3.97, affiliation: '神奈川大学', start_protocol: 'swing_to_run_in_game', surface: 'rain-affected field; exact surface unknown', source_name: 'BASEBALL KING', source_url: 'https://baseballking.jp/ns/297434/', published_date: '2021-09-26', source_provenance: 'media game-event report', same_measurement_cluster_id: 'kajihara_hp_to_1b_2021', usage_class: 'CONTEXT_ONLY', reason: 'Full-swing infield-hit home-to-first on a rain-affected field is contextual only.' }],
  ['蝦名 達夫', { metric: '50m', seconds: 6.0, affiliation: '青森大学', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/201910280000575.html', published_date: '2019-10-28', same_measurement_cluster_id: 'ebina_aomori_u_50m_profile', reason: 'University draft profile value; timing conditions are unknown.' }],

  ['来田 涼斗', { metric: '50m', seconds: 5.9, affiliation: '明石商業高校', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/column/baseballcountry/news/202003140000249.html', published_date: '2020-03-15', same_measurement_cluster_id: 'kita_50m_profile', reason: 'High-school profile value; article date is not the measurement date, which remains unknown.' }],
  ['森 友哉', { metric: '50m', seconds: 6.2, affiliation: '大阪桐蔭高校', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/professional/draft/2013/news/p-bb-tp0-20131209-1228895.html', published_date: '2013-12-09', same_measurement_cluster_id: 'mori_50m_profile', reason: 'High-school profile value; timing conditions are unknown.' }],
  ['奈良間 大己', { metric: '50m', seconds: 5.8, affiliation: '立正大学', source_name: 'スポニチ', source_url: 'https://www.sponichi.co.jp/baseball/news/2022/11/15/kiji/20221115s00001173066000c.html', published_date: '2022-11-15', same_measurement_cluster_id: 'narama_50m_profile_claim', confidence: 'low-medium', reason: 'Profile claim differs from the preserved electronic 6.31 test; source does not establish whether this is a different session.' }],
  ['清宮 幸太郎', { metric: '50m', seconds: 6.5, affiliation: '早稲田実業高校', source_name: 'web Sportiva', source_url: 'https://sportiva.shueisha.co.jp/clm/baseball/hs_other/2016/04/05/post_726/?page=3', published_date: '2016-04-05', same_measurement_cluster_id: 'kiyomiya_50m_profile', reason: 'High-school profile value; timing conditions are unknown.' }],
  ['田宮 裕涼', { metric: '50m', value_text: '6秒台前半', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/202212100001143.html', published_date: '2022-12-11', same_measurement_cluster_id: 'tamiya_50m_profile_text', reason: 'Only a range expression is published; exact time and protocol are unknown.' }],
  ['佐藤 都志也', { metric: '50m', seconds: 5.9, affiliation: '東洋大学', source_name: 'スポニチ', source_url: 'https://www.sponichi.co.jp/baseball/news/2019/10/25/kiji/20191024s00001173410000c.html', published_date: '2019-10-25', same_measurement_cluster_id: 'sato_toshiya_50m_profile', reason: 'University profile value; timing conditions are unknown.' }],
  ['友杉 篤輝', { metric: '50m', seconds: 5.9, affiliation: '天理大学', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/202210170000769.html', published_date: '2022-10-20', same_measurement_cluster_id: 'tomosugi_50m_profile_claim', confidence: 'low-medium', reason: 'Profile claim differs from the preserved electronic 6.10 test; same-session status is unknown.' }],
  ['友杉 篤輝', { metric: 'hp_to_1b', seconds: 3.73, affiliation: '天理大学', start_protocol: 'swing_to_run_in_game', source_name: '4years.', source_url: 'https://4years.asahi.com/article/14723455', published_date: '2022-09-25', source_provenance: 'media report of a university game event', same_measurement_cluster_id: 'tomosugi_hp_to_1b_game', usage_class: 'CONTEXT_ONLY', reason: 'Reported home-to-first is not a controlled sprint test.' }],
  ['安田 尚憲', { metric: '50m', seconds: 6.7, affiliation: '履正社高校', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/201710250000038.html', published_date: '2017-10-25', same_measurement_cluster_id: 'yasuda_50m_profile', reason: 'High-school profile value; timing conditions are unknown.' }],
  ['山口 航輝', { metric: '50m', seconds: 6.3, affiliation: '明桜高校', source_name: '日刊スポーツ', source_url: 'https://www.nikkansports.com/baseball/news/201810310000259.html', published_date: '2018-10-31', same_measurement_cluster_id: 'yamaguchi_koki_50m_profile', reason: 'High-school profile value; timing conditions are unknown.' }],
  ['岡 大海', { metric: '50m', seconds: 6.1, affiliation: '倉敷商業高校', source_name: '明大スポーツ新聞部', source_url: 'https://meisupo.net/news/5690/', source_provenance: 'student-media profile; page display date is unreliable', same_measurement_cluster_id: 'oka_50m_profile', confidence: 'low-medium', reason: 'High-school profile value; timing conditions are unknown and page date was not reliable.' }],
  ['藤原 恭大', { metric: '50m', seconds: 5.7, affiliation: '大阪桐蔭高校', start_protocol: 'training repetition; exact start unknown', source_name: 'デイリースポーツ', source_url: 'https://www.daily.co.jp/baseball/2017/08/04/0010433505.shtml', published_date: '2017-08-04', source_provenance: 'reported athlete statement; later 2018 profile treated as the same claim', same_measurement_cluster_id: 'fujiwara_50m_5_7_highschool_profile', reason: 'Reported best in repeated 50m training, but timing method and start rule are unknown.' }],
  ['髙部 瑛斗', { metric: '50m', seconds: 5.8, affiliation: '千葉ロッテマリーンズ', source_name: 'テレビ東京スポーツ', source_url: 'https://www.tv-tokyo.co.jp/sports/articles/2022/03/022229.html', published_date: '2022-03-21', same_measurement_cluster_id: 'takabe_50m_profile', reason: 'Profile value; measurement date and conditions are not published.' }],
  ['周東 佑京', { metric: '50m', seconds: 5.7, affiliation: '東京農業大学北海道オホーツク', source_name: '東京農業大学', source_url: 'https://www.nodai.ac.jp/news/article/42017/', published_date: '2017-10-27', source_provenance: 'university official draft profile; underlying test protocol not stated', same_measurement_cluster_id: 'shuto_50m_profile', reason: 'University profile value; timing conditions are unknown.' }],
  ['周東 佑京', { metric: 'hp_to_1b', seconds: 3.95, measurement_year: 2013, affiliation: '東京農業大学第二高校', start_protocol: 'swing_to_run_in_game', source_name: 'GOETHE', source_url: 'https://goetheweb.jp/person/article/20230209-star-46', published_date: '2023-02-09', source_provenance: 'media retrospective of a high-school game event', same_measurement_cluster_id: 'shuto_hp_to_1b_highschool_game', usage_class: 'CONTEXT_ONLY', reason: 'High-school game home-to-first time is contextual only.' }],
  ['柳田 悠岐', { metric: '50m', seconds: 5.94, affiliation: '広島経済大学', source_name: 'web Sportiva', source_url: 'https://sportiva.shueisha.co.jp/clm/baseball/npb/2015/07/14/post_583/', published_date: '2015-07-14', source_provenance: 'media retrospective of a player statement', same_measurement_cluster_id: 'yanagita_50m_profile', reason: 'Historical profile claim with unknown test conditions.' }],
  ['柳田 悠岐', { metric: 'hp_to_1b', seconds: 3.98, measurement_year: 2009, affiliation: '広島経済大学', timing_method: 'author observation', start_protocol: 'swing_to_run_in_game', source_name: 'GOETHE', source_url: 'https://goetheweb.jp/person/article/20210610-yuki_yanagita', published_date: '2021-06-10', source_provenance: 'media retrospective of a university game event', same_measurement_cluster_id: 'yanagita_hp_to_1b_college_game', usage_class: 'CONTEXT_ONLY', reason: 'University-game home-to-first time is contextual only.' }],
  ['柳町 達', { metric: '50m', seconds: 6.2, affiliation: '慶應義塾高校', source_tier: 'D', source_name: 'ドラフト・レポート', source_url: 'https://draft-repo.com/blog-entry-3199.html', published_date: '2019-11-27', source_provenance: 'secondary scouting-profile aggregation; original measurement source not shown', same_measurement_cluster_id: 'yanagimachi_50m_profile', confidence: 'low', reason: 'Low-tier profile value, kept as historical hint only.' }],
  ['栗原 陵矢', { metric: '50m', seconds: 6.0, affiliation: '春江工業高校', source_tier: 'D', source_name: 'ドラフト・レポート', source_url: 'https://draft-repo.com/blog-entry-2032.html', published_date: '2015-01-29', source_provenance: 'secondary reprint of a newspaper claim; original URL unavailable', same_measurement_cluster_id: 'kurihara_50m_profile', confidence: 'low', reason: 'Low-tier reprint, kept as historical hint only.' }],
  ['牧原 大成', { metric: '50m', seconds: 5.8, affiliation: '城北高校', source_tier: 'C', source_name: '田尻耕太郎の鷹バン！', source_url: 'https://koutaro-tajiri.theletter.jp/posts/ea6a6ac0-a6b2-11ee-b571-5fc5ffed7957', published_date: '2023-12-30', source_provenance: 'long-time team reporter citing a contemporary high-school questionnaire; original form unavailable', same_measurement_cluster_id: 'makihara_50m_profile', reason: 'Historical profile value with unknown timing protocol.' }],
  ['牧原 大成', { metric: 'hp_to_1b', seconds: 3.69, measurement_year: 2019, affiliation: '福岡ソフトバンクホークス', timing_method: 'bat-ball contact to first-base touch', start_protocol: 'swing_to_run_safety_bunt', source_name: 'パ・リーグ.com', source_url: 'https://pacificleague.com/news/2019/8/18255', published_date: '2019-08-26', source_provenance: 'league media report of a safety-bunt event', same_measurement_cluster_id: 'makihara_hp_to_1b_bunt_2019', usage_class: 'CONTEXT_ONLY', confidence: 'high', reason: 'Safety-bunt timing is explicitly reported as substantially faster and remains context only.' }],
  ['山川 穂高', { metric: '50m', seconds: 6.2, affiliation: '中部商業高校', source_tier: 'D', source_name: 'ドラフト・レポート', source_url: 'https://draft-repo.com/blog-entry-1559.html', source_provenance: 'secondary scouting-profile aggregation; original measurement source not shown', same_measurement_cluster_id: 'yamakawa_50m_profile', confidence: 'low', reason: 'Low-tier profile value; page date was unreliable and protocol is unknown.' }],
  ['正木 智也', { metric: '50m', seconds: 6.6, affiliation: '慶應義塾高校', source_tier: 'D', source_name: 'ドラフト・レポート', source_url: 'https://draft-repo.com/blog-entry-3445.html', published_date: '2021-11-25', source_provenance: 'secondary scouting-profile aggregation; original measurement source not shown', same_measurement_cluster_id: 'masaki_50m_profile', confidence: 'low', reason: 'Low-tier profile value, kept as historical hint only.' }],
];

for (const [player, fields] of newRecords) add(player, { evidence_origin: 'new_2026_08_09_player_by_player_research', ...fields });

for (const row of playersByName.values()) {
  const physical = row.records.filter(item => !['hp_to_1b'].includes(item.metric));
  const contextual = row.records.filter(item => item.metric === 'hp_to_1b');
  row.search.outcome = physical.length
    ? 'physical_record_found'
    : contextual.length
      ? 'context_only'
      : 'searched_no_data';
}

const raw = {
  schema_version: '1.0',
  retrieved_at: '2026-08-09',
  target_season: 2026,
  purpose: 'Collect independent short-distance and acceleration evidence for every 2026 NPB+ Sprint Speed target without changing appraisal logic.',
  scope: {
    included: ['T90/90ft', 'short-distance splits', '30m', '50m', '60yd', 'Sprint Speed', 'home-to-first as contextual data', 'qualitative profile only when source-specific'],
    excluded_from_numeric_t90: ['steals', 'steal success', 'baserunning judgment', 'UBR', 'triples', 'home-to-first', 'protocol-unknown historical 30m/50m', 'special first-step starts'],
  },
  guardrails: [
    'NPB+ Sprint Speed is retained only as the target baseline in each player row; this file does not assert an NPB+ to T90 equivalence.',
    'Home-to-first stays CONTEXT_ONLY even when the reported time is fast.',
    'A post-first-step clock is never numeric-T90-usable.',
    'Historical or protocol-unknown profile values are stored without automatic current-season conversion.',
    'Identical profile transcriptions are represented by one same_measurement_cluster_id and are not counted as independent measurements.',
  ],
  players: [...playersByName.values()].sort((a, b) => a.team.localeCompare(b.team, 'ja') || a.player.localeCompare(b.player, 'ja')),
};

atomicWrite(OUT, `${JSON.stringify(raw, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', output: OUT, players: raw.players.length, records: raw.players.reduce((sum, row) => sum + row.records.length, 0) }, null, 2));
