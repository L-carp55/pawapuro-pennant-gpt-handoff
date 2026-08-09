// Build and validate the owner-requested NPB short-distance physical-evidence pack.
//
// Scope: evidence collection only. This script never changes ratings, models, DB tables,
// or production paths. It rejects silent target omissions and evidence that lacks a source.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = 'data/manual/npb_speed_physical_evidence_full_20260809.json';
const COVERAGE_OUT = 'outputs/derived/npb_speed_evidence_coverage_20260809.csv';
const AUDIT_OUT = 'docs/audits/npb_speed_physical_evidence_full_20260809.md';
const TARGET_SEASON = 2026;

const USAGE = new Set([
  'NUMERIC_T90_CANDIDATE',
  'STANDARDIZED_PRIOR',
  'HISTORICAL_PROFILE_HINT',
  'QUALITATIVE_PROFILE_ONLY',
  'CONTEXT_ONLY',
  'REJECTED_FOR_SPEED',
]);
const TIERS = new Set(['A', 'B', 'C', 'D']);
const RANK = { A: 1, B: 2, C: 3, D: 4, unknown: 99 };
const norm = value => (value ?? '').normalize('NFKC').replace(/\s+/g, '');
const J = rel => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));

function fail(message) {
  throw new Error(`Evidence-pack validation failed: ${message}`);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function atomicWrite(rel, content) {
  const full = path.join(ROOT, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(`${full}.tmp`, content, 'utf8');
  renameSync(`${full}.tmp`, full);
}

function fmtNumber(value) {
  if (!Number.isFinite(value)) return 'unknown';
  return String(value);
}

function compactRecord(record) {
  const value = Number.isFinite(record.seconds)
    ? `${fmtNumber(record.seconds)}秒`
    : Number.isFinite(record.value)
      ? `${fmtNumber(record.value)}${record.unit ? ` ${record.unit}` : ''}`
      : typeof record.value_text === 'string' && record.value_text.trim()
        ? record.value_text
      : Array.isArray(record.seconds_range)
        ? `${record.seconds_range.map(fmtNumber).join('–')}秒`
        : '数値なし';
  return `${record.metric} ${value}`;
}

function sourceMarkdown(records) {
  const seen = new Set();
  const links = [];
  for (const record of records) {
    const key = `${record.source_name}|${record.source_url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push(`[${record.source_name}](${record.source_url})`);
  }
  return links.join('<br>');
}

function metricCount(records, aliases) {
  return records.filter(record => aliases.has(record.metric)).length;
}

function uniqueClusters(records) {
  return new Set(records.map(record => record.same_measurement_cluster_id)).size;
}

function validateRecord(record, player, index) {
  requireObject(record, `${player}.records[${index}]`);
  const label = `${player}.records[${index}]`;
  const required = [
    'metric', 'measurement_year', 'age', 'affiliation', 'timing_method', 'start_protocol',
    'surface', 'shoe', 'indoor_outdoor', 'cohort',
    'source_tier', 'source_name', 'source_url', 'published_date', 'source_provenance',
    'source_verification', 'same_measurement_cluster_id', 'usage_class', 'confidence',
    'numeric_t90_usable', 'reason',
  ];
  for (const key of required) if (!(key in record)) fail(`${label} is missing ${key}`);
  if (typeof record.metric !== 'string' || !record.metric.trim()) fail(`${label}.metric must be a non-empty string`);
  for (const key of ['age', 'affiliation', 'timing_method', 'start_protocol', 'surface', 'shoe', 'indoor_outdoor', 'cohort', 'published_date', 'source_provenance', 'source_verification', 'confidence', 'reason']) {
    if (typeof record[key] !== 'string' || !record[key].trim()) {
      fail(`${label}.${key} must be a non-empty string; use "unknown" when unavailable`);
    }
  }
  if (!(Number.isFinite(record.measurement_year) || record.measurement_year === 'unknown')) {
    fail(`${label}.measurement_year must be a year or "unknown"`);
  }
  if (!TIERS.has(record.source_tier)) fail(`${label}.source_tier must be A-D`);
  if (!USAGE.has(record.usage_class)) fail(`${label}.usage_class is not allowed`);
  if (typeof record.source_name !== 'string' || !record.source_name.trim()) fail(`${label}.source_name is required`);
  if (typeof record.source_url !== 'string' || !/^https?:\/\//.test(record.source_url)) {
    fail(`${label}.source_url must be an HTTP(S) URL`);
  }
  if (typeof record.same_measurement_cluster_id !== 'string' || !record.same_measurement_cluster_id.trim()) {
    fail(`${label}.same_measurement_cluster_id is required`);
  }
  if (typeof record.numeric_t90_usable !== 'boolean') fail(`${label}.numeric_t90_usable must be boolean`);
  if (record.numeric_t90_usable && record.usage_class !== 'NUMERIC_T90_CANDIDATE') {
    fail(`${label} may be numeric-T90-usable only as NUMERIC_T90_CANDIDATE`);
  }
  if (record.usage_class === 'NUMERIC_T90_CANDIDATE' && !record.numeric_t90_usable) {
    fail(`${label} labels a numeric candidate but numeric_t90_usable is false`);
  }
  if (record.metric === 'hp_to_1b') {
    if (record.usage_class !== 'CONTEXT_ONLY' || record.numeric_t90_usable) {
      fail(`${label} home-to-first evidence must be CONTEXT_ONLY and never numeric-T90-usable`);
    }
  }
  if (record.start_protocol === 'special_first_step_start' && record.numeric_t90_usable) {
    fail(`${label} uses a post-first-step clock as a numeric T90 candidate`);
  }
}

function validateInput(raw, targetByName) {
  requireObject(raw, INPUT);
  if (raw.target_season !== TARGET_SEASON) fail(`target_season must be ${TARGET_SEASON}`);
  if (!Array.isArray(raw.players)) fail('players must be an array');
  if (raw.players.length !== targetByName.size) {
    fail(`players must contain all ${targetByName.size} targets; received ${raw.players.length}`);
  }

  const supplied = new Set();
  const recordKeys = new Set();
  for (const [index, row] of raw.players.entries()) {
    requireObject(row, `players[${index}]`);
    const expected = targetByName.get(norm(row.player));
    if (!expected) fail(`players[${index}] has a non-target player: ${row.player}`);
    if (supplied.has(norm(row.player))) fail(`duplicate target player: ${row.player}`);
    supplied.add(norm(row.player));
    if (row.team !== expected.team) fail(`${row.player} team must match DB (${expected.team})`);
    if (!Number.isFinite(row.npb_plus_sprint_speed_kmh)) fail(`${row.player} needs DB Sprint Speed`);
    if (Math.abs(row.npb_plus_sprint_speed_kmh - expected.speed) > 1e-9) {
      fail(`${row.player} NPB+ Sprint Speed differs from DB`);
    }
    requireObject(row.search, `${row.player}.search`);
    if (row.search.completed !== true) fail(`${row.player} has not been marked search-complete`);
    if (!Array.isArray(row.search.query_log) || row.search.query_log.length < 3) {
      fail(`${row.player} must retain at least three executed query entries`);
    }
    for (const [queryIndex, query] of row.search.query_log.entries()) {
      requireObject(query, `${row.player}.search.query_log[${queryIndex}]`);
      for (const key of ['query', 'search_family', 'result']) {
        if (typeof query[key] !== 'string' || !query[key].trim()) {
          fail(`${row.player}.search.query_log[${queryIndex}].${key} must be a non-empty string`);
        }
      }
    }
    if (!Array.isArray(row.records)) fail(`${row.player}.records must be an array`);
    for (const [recordIndex, record] of row.records.entries()) {
      validateRecord(record, row.player, recordIndex);
      const key = `${norm(row.player)}|${record.metric}|${record.same_measurement_cluster_id}`;
      if (recordKeys.has(key)) fail(`duplicate metric/cluster evidence: ${key}`);
      recordKeys.add(key);
    }
  }
  const missing = [...targetByName.values()].filter(row => !supplied.has(norm(row.name))).map(row => row.name);
  if (missing.length) fail(`missing target players: ${missing.join(', ')}`);
}

function toCoverageRow(row) {
  const records = row.records;
  const years = records.map(record => record.measurement_year).filter(Number.isFinite);
  const tiers = records.map(record => record.source_tier);
  const bestTier = tiers.length ? tiers.sort((a, b) => RANK[a] - RANK[b])[0] : 'unknown';
  return {
    team: row.team,
    player: row.player,
    npb_plus_sprint_speed: row.npb_plus_sprint_speed_kmh,
    direct_t90_count: metricCount(records, new Set(['T90', 'T90ft'])),
    '10m_count': metricCount(records, new Set(['10m'])),
    '20m_count': metricCount(records, new Set(['20m'])),
    '30m_count': metricCount(records, new Set(['30m'])),
    '50m_count': metricCount(records, new Set(['50m'])),
    '60yd_count': metricCount(records, new Set(['60yd'])),
    t10ft_count: metricCount(records, new Set(['T10ft'])),
    t30ft_count: metricCount(records, new Set(['T30ft'])),
    t90ft_count: metricCount(records, new Set(['T90ft'])),
    hp_to_1b_count: metricCount(records, new Set(['hp_to_1b'])),
    standardized_numeric_usable_count: records.filter(record => record.numeric_t90_usable && ['T90', 'T90ft'].includes(record.metric)).length,
    standardized_prior_count: records.filter(record => record.usage_class === 'STANDARDIZED_PRIOR').length,
    historical_profile_count: records.filter(record => record.usage_class === 'HISTORICAL_PROFILE_HINT').length,
    qualitative_profile_count: records.filter(record => record.usage_class === 'QUALITATIVE_PROFILE_ONLY').length,
    context_only_count: records.filter(record => record.usage_class === 'CONTEXT_ONLY').length,
    physical_measurement_count: records.filter(record => record.metric !== 'hp_to_1b').length,
    pure_physical_no_data: !records.some(record => record.metric !== 'hp_to_1b'),
    best_evidence_tier: bestTier,
    best_measurement_year: years.length ? Math.max(...years) : '',
    search_completed: row.search.completed,
    search_query_count: row.search.query_log.length,
    independent_measurement_count: uniqueClusters(records),
    raw_record_count: records.length,
    no_data_found: records.length === 0,
  };
}

function buildMarkdown(raw, coverage, summary) {
  const byTeam = new Map();
  for (const row of raw.players) {
    const list = byTeam.get(row.team) ?? [];
    list.push(row);
    byTeam.set(row.team, list);
  }
  const lines = [
    '# NPB全選手・短距離身体データ証拠台帳',
    '',
    `- 対象: 2026途中のNPB+ Sprint Speedを持つ全${raw.players.length}人`,
    `- 収集日: ${raw.retrieved_at ?? '2026-08-09'}`,
    '- 範囲: 身体的な短距離・加速の根拠のみ。盗塁、走塁判断、守備、最終走力査定は含めない。',
    '- 数値T90候補は、計時・スタート・年代の条件を満たす記録だけ。ホーム→一塁は別枠のCONTEXT_ONLY。',
    '',
    '## QA集計',
    '',
    `- 追加データあり: ${summary.players_with_any_record}/${raw.players.length}`,
    `- 数値T90候補あり: ${summary.players_with_numeric_candidate}/${raw.players.length}`,
    `- 30mあり: ${summary.players_with_30m}/${raw.players.length}`,
    `- 50mあり: ${summary.players_with_50m}/${raw.players.length}`,
    `- 標準化/電子計時の記録あり: ${summary.players_with_standardized_prior}/${raw.players.length}`,
    `- 履歴プロフィールのみ: ${summary.historical_profile_only}`,
    `- 純粋短距離の根拠なし（HP→1Bだけを除外）: ${summary.players_without_pure_physical}`,
    `- Sprint Speed以外の記録なし: ${summary.no_data_found}`,
    `- 一次情報（Tier A）率: ${summary.tier_a_ratio_pct}%`,
    `- 独立測定クラスター数: ${summary.independent_measurement_count}`,
  ];
  for (const [team, players] of [...byTeam.entries()].sort(([a], [b]) => a.localeCompare(b, 'ja'))) {
    lines.push('', `## ${team}`, '', '| 選手 | Sprint Speed | 追加データ | 年 | 計測方式 | 利用区分 | 信頼度 | 出典 |', '| --- | ---: | --- | --- | --- | --- | --- | --- |');
    for (const row of players.sort((a, b) => a.player.localeCompare(b.player, 'ja'))) {
      const records = row.records;
      const additional = records.length ? records.map(compactRecord).join('<br>') : '追加データなし（検索済み）';
      const years = [...new Set(records.map(record => Number.isFinite(record.measurement_year) ? record.measurement_year : 'unknown'))].join('<br>') || '—';
      const methods = [...new Set(records.map(record => `${record.timing_method}/${record.start_protocol}`))].join('<br>') || '—';
      const uses = [...new Set(records.map(record => record.usage_class))].join('<br>') || '—';
      const confidence = [...new Set(records.map(record => record.confidence))].join('<br>') || '—';
      lines.push(`| ${row.player} | ${row.npb_plus_sprint_speed_kmh} km/h | ${additional} | ${years} | ${methods} | ${uses} | ${confidence} | ${sourceMarkdown(records) || '—'} |`);
    }
  }
  lines.push('', '## 検索・判定の注意', '', '- 「追加データなし」は、記録が存在しないという断言ではなく、指定した検索手順で確認可能な根拠を発見できなかった状態を意味する。', '- 同じドラフト・選手紹介数値の転載は、`same_measurement_cluster_id`で1つの独立測定として扱う。', '- 年代差・計測方式不明・一歩目後開始のタイムは、今回保存するが現在T90へ勝手に換算しない。');
  return `${lines.join('\n')}\n`;
}

function buildSummary(coverage, raw) {
  const allRecords = raw.players.flatMap(row => row.records);
  const has = predicate => coverage.filter(predicate).length;
  return {
    target_players: raw.players.length,
    searched_players: coverage.filter(row => row.search_completed).length,
    players_with_any_record: has(row => row.raw_record_count > 0),
    players_with_numeric_candidate: has(row => row.standardized_numeric_usable_count > 0),
    players_with_30m: has(row => row['30m_count'] > 0),
    players_with_50m: has(row => row['50m_count'] > 0),
    players_with_standardized_prior: has(row => row.standardized_prior_count > 0),
    historical_profile_only: has(row => row.raw_record_count > 0 && row.historical_profile_count > 0 && row.standardized_numeric_usable_count === 0 && row.standardized_prior_count === 0 && row.context_only_count === 0 && row.qualitative_profile_count === 0),
    players_without_pure_physical: has(row => row.pure_physical_no_data),
    no_data_found: has(row => row.no_data_found),
    tier_a_ratio_pct: allRecords.length ? Number((allRecords.filter(record => record.source_tier === 'A').length / allRecords.length * 100).toFixed(1)) : 0,
    independent_measurement_count: new Set(raw.players.flatMap(row => row.records.map(record => `${norm(row.player)}|${record.same_measurement_cluster_id}`))).size,
    raw_record_count: allRecords.length,
  };
}

const raw = J(INPUT);
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));
const targets = db.prepare(`
  SELECT name, team, top_speed_kmh
  FROM npb_plus_measurement
  WHERE top_speed_kmh IS NOT NULL
  ORDER BY team, name
`).all();
const targetByName = new Map(targets.map(row => [norm(row.name), { name: row.name, team: row.team, speed: row.top_speed_kmh }]));

validateInput(raw, targetByName);
const coverage = raw.players.map(toCoverageRow).sort((a, b) => a.team.localeCompare(b.team, 'ja') || a.player.localeCompare(b.player, 'ja'));
const summary = buildSummary(coverage, raw);
const headers = Object.keys(coverage[0]);
const csv = `${headers.join(',')}\n${coverage.map(row => headers.map(header => csvCell(row[header])).join(',')).join('\n')}\n`;
atomicWrite(COVERAGE_OUT, csv);
atomicWrite(AUDIT_OUT, buildMarkdown(raw, coverage, summary));

console.log(JSON.stringify({
  status: 'PASS',
  input: INPUT,
  coverage_output: COVERAGE_OUT,
  audit_output: AUDIT_OUT,
  ...summary,
}, null, 2));
db.close();
