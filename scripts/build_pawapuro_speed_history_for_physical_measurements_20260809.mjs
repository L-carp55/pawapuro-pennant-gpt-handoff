import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json');
const DB = path.join(ROOT, 'data', 'pennant.db');
const OUT_CSV = path.join(ROOT, 'outputs', 'derived', 'pawapuro_speed_history_for_physical_measurements_20260809.csv');
const OUT_JSON = path.join(ROOT, 'outputs', 'derived', 'pawapuro_speed_history_for_physical_measurements_20260809.json');
const OUT_MD = path.join(ROOT, 'docs', 'audits', 'pawapuro_speed_history_vs_physical_measurements_20260809.md');

const norm = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, '');
const unique = values => [...new Set(values.filter(Boolean))];
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const seconds = value => value === null || value === undefined ? 'null' : Number(value).toFixed(2).replace(/\.00$/, '');
const archiveUrl = (work, teamCode, version = null) => 'https://www.baseless.org/data/source/' + work + '/dat_' + teamCode + (version ? '_' + version.replace('.', '_') : '') + '.html';
const workUrl = work => 'https://www.baseless.org/data/source/' + work + '/work.html';
const gapDays = (from, to) => Math.abs(Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000));

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

const TARGETS = [
  { cluster: 'mlb_statcast_running_splits_筒香嘉智_2022', key: 'tsutsugo_2022', teamCode: 'BA', pawaTeam: '横浜DeNAベイスターズ', aliases: ['筒香嘉智', '筒香'], timing: 'Statcast_running_split', nearest: 'pp2024v101' },
  { cluster: 'standardized_50m_2022-06-19_林琢真', key: 'hayashi_2022', teamCode: 'BA', pawaTeam: '横浜DeNAベイスターズ', aliases: ['林琢真', '林'], timing: 'electronic_photoelectric', date: '2022-06-19', event: '侍ジャパン大学代表選考合宿', nearest: 'pp2022v109' },
  { cluster: 'mlb_statcast_running_splits_モンテロ_2024', key: 'montero_2024', teamCode: 'C', pawaTeam: '広島東洋カープ', aliases: ['モンテロ'], timing: 'Statcast_running_split', nearest: 'pp2024v108' },
  { cluster: 'mlb_statcast_running_splits_秋山翔吾_2021', key: 'akiyama_2021', teamCode: 'C', pawaTeam: '広島東洋カープ', aliases: ['秋山翔吾', '秋山'], timing: 'Statcast_running_split', nearest: 'pp2022v107' },
  { cluster: 'existing_30m_佐藤輝明_2020', key: 'sato_2020', teamCode: 'T', pawaTeam: '阪神タイガース', aliases: ['佐藤輝明', '佐藤輝'], timing: 'team_physical_test_protocol_unspecified', nearest: 'pp2020v109' },
  { cluster: 'existing_30m_小幡竜平_2018', key: 'obata_2018', teamCode: 'T', pawaTeam: '阪神タイガース', aliases: ['小幡竜平', '小幡'], timing: 'team_physical_test_protocol_unspecified', nearest: 'pp2018v110' },
  { cluster: 'mlb_statcast_running_splits_ポランコ_2021', key: 'polanco_2021', teamCode: 'M', pawaTeam: '千葉ロッテマリーンズ', aliases: ['ポランコ'], timing: 'Statcast_running_split', nearest: 'pp2022default' },
  { cluster: 'standardized_50m_2022-06-19_友杉篤輝', key: 'tomosugi_2022', teamCode: 'M', pawaTeam: '千葉ロッテマリーンズ', aliases: ['友杉篤輝', '友杉'], timing: 'electronic_photoelectric', date: '2022-06-19', event: '侍ジャパン大学代表選考合宿', nearest: 'pp2022v109' },
  { cluster: 'mlb_statcast_running_splits_カリステ_2017', key: 'calixte_2017', teamCode: 'D', pawaTeam: '中日ドラゴンズ', aliases: ['カリステ'], timing: 'Statcast_running_split', nearest: 'pp2022v109' },
  { cluster: 'okabayashi_komono_50m_profile', key: 'okabayashi_2019', teamCode: 'D', pawaTeam: '中日ドラゴンズ', aliases: ['岡林勇希', '岡林'], timing: 'profile_50m_protocol_unspecified', nearest: 'pp2020default' },
  { cluster: 'mlb_statcast_running_splits_サンタナ_2020', key: 'santana_2020', teamCode: 'S', pawaTeam: '東京ヤクルトスワローズ', aliases: ['サンタナ'], timing: 'Statcast_running_split', nearest: 'pp2020v109' },
  { cluster: 'existing_30m_塩見泰隆_2018', key: 'shiomi_2018', teamCode: 'S', pawaTeam: '東京ヤクルトスワローズ', aliases: ['塩見泰隆', '塩見'], timing: 'team_physical_test_protocol_unspecified', nearest: 'pp2018default' },
  { cluster: 'existing_outlier_並木秀尊_50m_5.32', key: 'namiki_2019', teamCode: 'S', pawaTeam: '東京ヤクルトスワローズ', aliases: ['並木秀尊', '並木'], timing: 'special_first_step_start', nearest: 'pp2022default' },
  { cluster: 'existing_outlier_並木秀尊_50m_6.06', key: 'namiki_2022', teamCode: 'S', pawaTeam: '東京ヤクルトスワローズ', aliases: ['並木秀尊', '並木'], timing: 'tv_50m_protocol_unspecified', nearest: 'pp2022default' },
  { cluster: 'existing_outlier_村林一輝_50m_6.2', key: 'murabayashi_2015', teamCode: 'E', pawaTeam: '東北楽天ゴールデンイーグルス', aliases: ['村林一輝', '村林'], timing: 'scouting_profile_protocol_unspecified', nearest: 'pp2016default' },
  { cluster: 'standardized_50m_2022-06-19_奈良間大己', key: 'narama_2022', teamCode: 'F', pawaTeam: '北海道日本ハムファイターズ', aliases: ['奈良間大己', '奈良間'], timing: 'electronic_photoelectric', date: '2022-06-19', event: '侍ジャパン大学代表選考合宿', nearest: 'pp2022v109' },
];

const SNAP = {
  pp2016default: { title: '実況パワフルプロ野球2016', version: 'default initial player data', date: '2016-04-28', work: '2016', archiveVersion: null, official: 'https://www.konami.com/pawa/2016/', basis: 'title release date', label: '2016 opening/default' },
  pp2018default: { title: '実況パワフルプロ野球2018', version: 'default initial player data', date: '2018-04-26', work: '2018', archiveVersion: null, official: 'https://www.konami.com/pawa/2018/update/180412', basis: 'official first-update effective date / title opening data', label: '2018 opening/default' },
  pp2018v110: { title: '実況パワフルプロ野球2018', version: '1.10', date: '2019-04-23', work: '2018', archiveVersion: '1.10', official: 'https://www.konami.com/pawa/2018/update/190418', basis: 'official update effective date', label: '2019-04-23 v1.10' },
  pp2020default: { title: 'eBASEBALLパワフルプロ野球2020', version: 'default initial player data', date: '2020-07-09', work: '2020', archiveVersion: null, official: 'https://www.konami.com/pawa/2020/', basis: 'title release date', label: '2020 opening/default' },
  pp2020v109: { title: 'eBASEBALLパワフルプロ野球2020', version: '1.09', date: '2021-04-08', work: '2020', archiveVersion: '1.09', official: 'https://www.konami.com/pawa/2020/update/210408', basis: 'official update effective date', label: '2021-04-08 v1.09 (2021 player data)' },
  pp2022default: { title: 'eBASEBALLパワフルプロ野球2022', version: 'default initial player data', date: '2022-04-21', work: '2022', archiveVersion: null, official: 'https://www.konami.com/pawa/2022/', basis: 'title release date', label: '2022 opening/default' },
  pp2022v107: { title: 'eBASEBALLパワフルプロ野球2022', version: '1.07', date: '2022-09-29', work: '2022', archiveVersion: '1.07', official: 'https://www.konami.com/pawa/2022/update/220929', basis: 'official update effective date', label: '2022-09-29 v1.07' },
  pp2022v109: { title: 'eBASEBALLパワフルプロ野球2022', version: '1.09', date: '2023-03-30', work: '2022', archiveVersion: '1.09', official: 'https://www.konami.com/pawa/2022/update/230330', basis: 'official update effective date', label: '2023-03-30 v1.09 (2023 player data)' },
  pp2024v101: { title: 'パワフルプロ野球2024-2025', version: '1.01', date: '2024-07-18', work: '2024', archiveVersion: '1.01', official: 'https://www.konami.com/pawa/2024-2025/update/240718', basis: 'official first-update effective date', label: '2024-07-18 v1.01' },
  pp2024v107: { title: 'パワフルプロ野球2024-2025', version: '1.07', date: '2024-11-26', work: '2024', archiveVersion: '1.07', official: 'https://www.konami.com/pawa/2024-2025/update/241126', basis: 'official 2024 regular-season-end update', label: '2024 end / 2024-11-26 v1.07' },
  pp2024v108: { title: 'パワフルプロ野球2024-2025', version: '1.08', date: '2025-03-27', work: '2024', archiveVersion: '1.08', official: 'https://www.konami.com/pawa/2024-2025/update/250327', basis: 'official 2025 opening update', label: '2025 opening / 2025-03-27 v1.08' },
  pp2024v114: { title: 'パワフルプロ野球2024-2025', version: '1.14', date: '2025-11-20', work: '2024', archiveVersion: '1.14', official: 'https://www.konami.com/pawa/2024-2025/update/251120', basis: 'official 2025 regular-season-end update', label: '2025 end / 2025-11-20 v1.14' },
  pp2026opening: { title: 'パワフルプロ野球2026-2027', version: 'default initial player data', date: '2026-06-11', work: '2026', archiveVersion: null, official: 'https://www.konami.com/pawa/2026-2027/', basis: 'title release date', label: '2026 opening/default' },
};

const TERMINAL = {
  '2016': { version: '1.11' },
  '2018': { version: '1.15' },
  '2020': { version: '1.16' },
  '2022': { version: '1.13' },
};

const SPEED = {
  tsutsugo_2022: { pp2024v101: 52, pp2024v107: 52, pp2024v108: 52, pp2024v114: 45, pp2026opening: 45 },
  hayashi_2022: { pp2022v109: 87, pp2024v107: 87, pp2024v108: 87, pp2024v114: 82, pp2026opening: 82 },
  montero_2024: { pp2024v108: 49, pp2024v114: 49, pp2026opening: 49 },
  akiyama_2021: { pp2022v107: 72, pp2024v107: 77, pp2024v108: 77, pp2024v114: 77, pp2026opening: 77 },
  sato_2020: { pp2020v109: 68, pp2024v107: 68, pp2024v108: 68, pp2024v114: 68, pp2026opening: 68 },
  obata_2018: { pp2018v110: 77, pp2024v107: 77, pp2024v108: 77, pp2024v114: 77, pp2026opening: 77 },
  polanco_2021: { pp2022default: 67, pp2024v107: 63, pp2024v108: 63, pp2024v114: 63, pp2026opening: 63 },
  tomosugi_2022: { pp2022v109: 81, pp2024v107: 87, pp2024v108: 87, pp2024v114: 87, pp2026opening: 87 },
  calixte_2017: { pp2022v109: 87, pp2024v107: 82, pp2024v108: 82, pp2024v114: 82, pp2026opening: 82 },
  okabayashi_2019: { pp2020default: 78, pp2024v107: 81, pp2024v108: 81, pp2024v114: 81, pp2026opening: 81 },
  santana_2020: { pp2020v109: 47, pp2024v107: 47, pp2024v108: 47, pp2024v114: 47, pp2026opening: 47 },
  shiomi_2018: { pp2018default: 69, pp2024v107: 83, pp2024v108: 83, pp2024v114: 83, pp2026opening: 83 },
  namiki_2019: { pp2022default: 95, pp2024v107: 95, pp2024v108: 95, pp2024v114: 97, pp2026opening: 97 },
  namiki_2022: { pp2022default: 95, pp2024v107: 95, pp2024v108: 95, pp2024v114: 97, pp2026opening: 97 },
  murabayashi_2015: { pp2016default: 60, pp2024v107: 69, pp2024v108: 69, pp2024v114: 69, pp2026opening: 69 },
  narama_2022: { pp2022v109: 64, pp2024v107: 64, pp2024v108: 64, pp2024v114: 64, pp2026opening: 64 },
};

function directEntry(target, snapshotKey, speed, classes) {
  const source = SNAP[snapshotKey];
  const archive = archiveUrl(source.work, target.teamCode, source.archiveVersion);
  return {
    record_classes: unique(classes),
    title: source.title,
    version: source.version,
    date: source.date,
    release_or_update_date: source.date,
    date_precision: 'day',
    speed,
    source: 'BASELESS archived player-data page for speed; KONAMI official page for version and date',
    source_urls: [archive, source.official],
    archive_url: archive,
    official_update_url: source.official,
    source_date_basis: source.basis,
    archive_work: source.work,
  };
}

function terminalEntry(target, row) {
  const spec = TERMINAL[String(row.work)];
  const archive = archiveUrl(String(row.work), target.teamCode, spec.version);
  const title = String(row.work) === '2016' ? '実況パワフルプロ野球2016'
    : String(row.work) === '2018' ? '実況パワフルプロ野球2018'
      : 'eBASEBALLパワフルプロ野球' + row.work;
  return {
    record_classes: ['stored_title_terminal_snapshot'],
    title,
    version: spec.version + ' (terminal archive snapshot)',
    date: null,
    release_or_update_date: null,
    date_precision: 'not_retained_in_local_pawapuro_full',
    speed: row.speed,
    source: 'repository data/pennant.db pawapuro_full; exact update date is not retained in that local table',
    source_urls: [archive, workUrl(String(row.work))],
    archive_url: archive,
    official_update_url: null,
    source_date_basis: null,
    archive_work: String(row.work),
    archive_name: row.name,
    archive_team: row.team,
  };
}

function terminalRow(rows, target, work) {
  const aliases = target.aliases.map(norm);
  const candidates = rows
    .filter(row => String(row.work) === work && row.team === target.pawaTeam)
    .map(row => {
      const player = norm(row.name);
      const score = aliases.reduce((best, alias) => {
        if (player === alias) return Math.max(best, 1000 + alias.length);
        if (player.startsWith(alias) || alias.startsWith(player)) return Math.max(best, 100 + Math.min(player.length, alias.length));
        return best;
      }, 0);
      return { row, score };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || String(left.row.name).localeCompare(String(right.row.name), 'ja'));
  if (!candidates.length) return null;
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) {
    throw new Error('ambiguous local archive match for ' + target.key + ' / ' + work);
  }
  return candidates[0].row;
}

function addHistory(history, entry) {
  const key = entry.title + '|' + entry.version + '|' + (entry.date ?? 'undated') + '|' + entry.speed;
  const existing = history.get(key);
  if (existing) {
    existing.record_classes = unique(existing.record_classes.concat(entry.record_classes));
    existing.source_urls = unique(existing.source_urls.concat(entry.source_urls));
    return;
  }
  history.set(key, entry);
}

const input = readJson(INPUT);
const allPhysical = input.players.flatMap(player => (player.records ?? []).map(record => ({ ...record, player: player.player, team: player.team })));
const known = allPhysical.filter(record => ['T90ft', '30m', '50m'].includes(record.metric) && record.measurement_year !== null && record.measurement_year !== undefined && record.measurement_year !== 'unknown');
const unknown = allPhysical.filter(record => ['T90ft', '30m', '50m'].includes(record.metric) && (!record.measurement_year || record.measurement_year === 'unknown'));
const sourceClusters = unique(known.map(record => record.same_measurement_cluster_id)).sort();
const expectedClusters = TARGETS.map(target => target.cluster).sort();
if (JSON.stringify(sourceClusters) !== JSON.stringify(expectedClusters)) throw new Error('known-year clusters do not exactly match the target manifest');

const db = new DatabaseSync(DB, { readOnly: true });
const pawaRows = db.prepare('SELECT work, team, name, speed FROM pawapuro_full WHERE work IN (?,?,?,?)').all('2016', '2018', '2020', '2022');
db.close();

function buildRecord(target) {
  const physical = known.find(record => record.same_measurement_cluster_id === target.cluster && record.metric === 'T90ft')
    ?? known.find(record => record.same_measurement_cluster_id === target.cluster);
  if (!physical) throw new Error('missing source physical record: ' + target.cluster);
  const speeds = SPEED[target.key];
  const nearestSpeed = speeds[target.nearest];
  if (nearestSpeed === null || nearestSpeed === undefined) throw new Error('nearest Pawa speed missing: ' + target.key);
  const nearestMeta = SNAP[target.nearest];
  const measurementDate = target.date ?? physical.measurement_date ?? null;
  const gapDayValue = measurementDate ? gapDays(measurementDate, nearestMeta.date) : null;
  const gapYearValue = measurementDate ? null : Math.abs(Number(nearestMeta.date.slice(0, 4)) - Number(physical.measurement_year));
  const history = new Map();
  addHistory(history, directEntry(target, target.nearest, nearestSpeed, ['nearest_to_measurement']));
  for (const work of ['2016', '2018', '2020', '2022']) {
    if (Number(work) < Number(physical.measurement_year)) continue;
    const row = terminalRow(pawaRows, target, work);
    if (row) addHistory(history, terminalEntry(target, row));
  }
  for (const key of ['pp2024v101', 'pp2024v107', 'pp2024v108', 'pp2024v114', 'pp2026opening']) {
    if (speeds[key] === null || speeds[key] === undefined) continue;
    const role = key === 'pp2024v107' ? '2024_end_exact'
      : key === 'pp2024v108' ? '2025_opening_exact'
        : key === 'pp2024v114' ? '2025_end_exact'
          : key === 'pp2026opening' ? '2026_opening_exact'
            : 'major_update_snapshot';
    addHistory(history, directEntry(target, key, speeds[key], [role]));
  }
  const list = [...history.values()].sort((left, right) => {
    const l = left.date ? Number(left.date.replaceAll('-', '')) : Number(left.archive_work) * 10000 + 9999;
    const r = right.date ? Number(right.date.replaceAll('-', '')) : Number(right.archive_work) * 10000 + 9999;
    return l - r || left.title.localeCompare(right.title, 'ja');
  });
  const terminalSpeed = work => {
    const item = list.find(entry => entry.record_classes.includes('stored_title_terminal_snapshot') && entry.archive_work === work);
    return item?.speed ?? null;
  };
  const components = allPhysical.filter(record => record.same_measurement_cluster_id === target.cluster).map(record => ({
    metric: record.metric,
    value: record.seconds ?? record.value ?? null,
    unit: record.metric === 'sprint_speed_kmh' ? 'km/h' : 'seconds',
  }));
  const end2024 = speeds.pp2024v107 ?? null;
  const opening2025 = speeds.pp2024v108 ?? null;
  const end2025 = speeds.pp2024v114 ?? null;
  const opening2026 = speeds.pp2026opening ?? null;
  return {
    player: physical.player,
    team: physical.team,
    measurement_cluster_id: target.cluster,
    measurement_metric: physical.metric,
    measurement_value: physical.seconds ?? physical.value ?? null,
    measurement_unit: 'seconds',
    measurement_components: components,
    measurement_year: Number(physical.measurement_year),
    measurement_date: measurementDate,
    measurement_year_inferred: false,
    inference_basis: null,
    measurement_timing_method: target.timing,
    measurement_event: target.event ?? null,
    measurement_usage_class: physical.usage_class,
    measurement_confidence: physical.confidence,
    measurement_source: physical.source_name,
    measurement_source_url: physical.source_url,
    nearest_pawapuro_title: nearestMeta.title,
    nearest_pawapuro_version: nearestMeta.version,
    nearest_pawapuro_date: nearestMeta.date,
    nearest_pawapuro_speed: nearestSpeed,
    nearest_pawapuro_source: 'BASELESS archived player-data page for speed; KONAMI official page for version and date',
    nearest_pawapuro_url: archiveUrl(nearestMeta.work, target.teamCode, nearestMeta.archiveVersion),
    nearest_pawapuro_official_update_url: nearestMeta.official,
    measurement_to_pawapuro_gap_days: gapDayValue,
    measurement_to_pawapuro_gap_years: gapYearValue,
    pawapuro_2016_terminal_speed: terminalSpeed('2016'),
    pawapuro_2018_terminal_speed: terminalSpeed('2018'),
    pawapuro_2020_terminal_speed: terminalSpeed('2020'),
    pawapuro_2022_terminal_speed: terminalSpeed('2022'),
    pawapuro_2024_end_speed: end2024,
    pawapuro_2025_opening_speed: opening2025,
    pawapuro_2025_end_speed: end2025,
    pawapuro_2026_opening_speed: opening2026,
    speed_change_nearest_to_2025_end: end2025 === null ? null : end2025 - nearestSpeed,
    speed_change_nearest_to_2026: opening2026 === null ? null : opening2026 - nearestSpeed,
    source_urls: unique([
      physical.source_url,
      archiveUrl(nearestMeta.work, target.teamCode, nearestMeta.archiveVersion),
      nearestMeta.official,
      archiveUrl('2024', target.teamCode, '1.07'),
      SNAP.pp2024v107.official,
      archiveUrl('2024', target.teamCode, '1.14'),
      SNAP.pp2024v114.official,
      archiveUrl('2026', target.teamCode, null),
      SNAP.pp2026opening.official,
    ]),
    confidence: physical.usage_class === 'REJECTED_FOR_SPEED'
      ? 'medium (record preserved as rejected-for-speed evidence; no numerical use)'
      : 'medium',
    pawapuro_history: list,
  };
}

const records = TARGETS.map(buildRecord);
for (const record of records) {
  if (record.nearest_pawapuro_speed === null || record.pawapuro_2025_end_speed === null || record.pawapuro_2026_opening_speed === null) throw new Error('required timepoint missing: ' + record.measurement_cluster_id);
  if (record.measurement_year_inferred) throw new Error('unexpected inferred year');
}

const changes = records.filter(record => record.speed_change_nearest_to_2025_end !== null);
const maxUp = Math.max(...changes.map(record => record.speed_change_nearest_to_2025_end));
const maxDown = Math.min(...changes.map(record => record.speed_change_nearest_to_2025_end));
const within = years => records.filter(record => record.measurement_to_pawapuro_gap_days !== null
  ? record.measurement_to_pawapuro_gap_days <= years * 366
  : record.measurement_to_pawapuro_gap_years <= years).length;
const qa = {
  known_measurement_clusters: records.length,
  known_measurement_players: unique(records.map(record => record.player)).length,
  exact_measurement_dates_available: records.filter(record => record.measurement_date).length,
  nearest_pawapuro_speed_acquired: records.length,
  nearest_to_2025_end_change_calculable: changes.length,
  unknown_measurement_year_clusters_not_assigned: unique(unknown.map(record => record.same_measurement_cluster_id)).length,
  unknown_measurement_year_players_not_assigned: unique(unknown.map(record => record.player)).length,
  within_plus_minus_1_year: within(1),
  within_plus_minus_2_years: within(2),
  maximum_increase_nearest_to_2025_end: changes.filter(record => record.speed_change_nearest_to_2025_end === maxUp).map(record => ({ player: record.player, cluster: record.measurement_cluster_id, change: maxUp })),
  maximum_decline_nearest_to_2025_end: changes.filter(record => record.speed_change_nearest_to_2025_end === maxDown).map(record => ({ player: record.player, cluster: record.measurement_cluster_id, change: maxDown })),
  unchanged_nearest_to_2025_end: changes.filter(record => record.speed_change_nearest_to_2025_end === 0).map(record => ({ player: record.player, cluster: record.measurement_cluster_id, speed: record.nearest_pawapuro_speed })),
};

const output = {
  schema_version: '1.0.0',
  generated_at: '2026-08-09',
  purpose: 'Collect only time-aligned PowerPro speed-rating history for prior short-distance physical measurements. No calibration, correlation analysis, or rating modification is performed.',
  scope: {
    included_measurement_metrics: ['T90ft / 90ft', '30m', 'electronic/photoelectric 50m', 'other 50m'],
    inclusion_rule: 'All records in npb_speed_physical_evidence_full_20260809.json with metric T90ft, 30m, or 50m and known measurement year.',
    excluded_rule: 'Unknown-year records receive no PowerPro timepoint.',
  },
  timepoint_rules: {
    nearest: 'Use the actual player-data version nearest to the measurement, not title year by itself.',
    pawa2024_2025: '2024 end = PS4 Ver.1.07 dated 2024-11-26; 2025 end = PS4 Ver.1.14 dated 2025-11-20. The work=2024 terminal table is never used as either endpoint.',
    pawa2026: '2026 opening = default player-data page at 2026-06-11 release, not later v1.10/v1.11 pages.',
    sources: 'KONAMI official pages establish version/date. BASELESS pages establish numeric speed. Local pawapuro_full terminal snapshots supplement past-title history only.',
  },
  qa,
  records,
  unassigned_year_unknown_records: unknown.map(record => ({
    player: record.player,
    team: record.team,
    measurement_cluster_id: record.same_measurement_cluster_id,
    measurement_metric: record.metric,
    measurement_value: record.seconds ?? record.value ?? null,
    measurement_year: 'unknown',
    measurement_source_url: record.source_url,
    reason: 'No PowerPro timepoint assigned because the source ledger does not identify the measurement year.',
  })),
};

const columns = [
  'player', 'team', 'measurement_cluster_id', 'measurement_metric', 'measurement_value',
  'measurement_year', 'measurement_date', 'measurement_year_inferred', 'inference_basis',
  'measurement_timing_method', 'measurement_usage_class', 'nearest_pawapuro_title',
  'nearest_pawapuro_version', 'nearest_pawapuro_date', 'nearest_pawapuro_speed',
  'measurement_to_pawapuro_gap_days', 'measurement_to_pawapuro_gap_years',
  'pawapuro_2016_terminal_speed', 'pawapuro_2018_terminal_speed',
  'pawapuro_2020_terminal_speed', 'pawapuro_2022_terminal_speed',
  'pawapuro_2024_end_speed', 'pawapuro_2025_opening_speed',
  'pawapuro_2025_end_speed', 'pawapuro_2026_opening_speed',
  'speed_change_nearest_to_2025_end', 'speed_change_nearest_to_2026',
  'source_urls', 'confidence',
];
const csv = [columns.join(',')].concat(records.map(record => columns.map(column => csvCell(column === 'source_urls' ? record.source_urls.join(';') : record[column])).join(','))).join('\n') + '\n';

function tableRow(record) {
  const gap = record.measurement_to_pawapuro_gap_days !== null ? record.measurement_to_pawapuro_gap_days + '日' : record.measurement_to_pawapuro_gap_years + '年';
  const delta = record.speed_change_nearest_to_2025_end >= 0 ? '+' + record.speed_change_nearest_to_2025_end : String(record.speed_change_nearest_to_2025_end);
  const nearest = record.nearest_pawapuro_title + ' ' + record.nearest_pawapuro_version + ' (' + record.nearest_pawapuro_date + ')';
  const sources = '[身体](' + record.measurement_source_url + ') / [値](' + record.nearest_pawapuro_url + ') / [版日](' + record.nearest_pawapuro_official_update_url + ')';
  return '| ' + [record.player, record.measurement_metric + ' ' + seconds(record.measurement_value) + '秒', record.measurement_year, nearest, record.nearest_pawapuro_speed, record.pawapuro_2025_end_speed, delta, gap, sources].map(value => String(value).replace(/\|/g, '\\|')).join(' | ') + ' |';
}

const markdown = [
  '# パワプロ走力履歴と身体測定の時点整合（2026-08-09）',
  '',
  '## 範囲',
  '',
  '前回台帳のうち、測定年が確定している T90ft・30m・50m の16測定クラスタ（15選手）だけを収集対象にした。身体値からパワプロ走力を逆算せず、相関分析・現在査定の変更も行っていない。',
  '',
  '年不明の50m等は34選手・35測定クラスタを確認したが、合理的な時点根拠を追加できないため、パワプロ年度を割り当てず JSON の unassigned_year_unknown_records にのみ保存した。',
  '',
  '## 時点の扱い',
  '',
  '- 2024年終了はパワプロ2024-2025 PS4 Ver.1.07（2024-11-26）。',
  '- 2025年終了は同 Ver.1.14（2025-11-20）。pawapuro_full の work=2024 終端値はこのどちらにも使っていない。',
  '- 2026開幕はパワプロ2026-2027の発売日（2026-06-11）時点のBASELESS defaultデータ。後発の v1.10 / v1.11 ではない。',
  '- 数値はBASELESSの該当選手・版ページ、版番号と配信日はKONAMI公式ページで確認した。過去作品のローカル終端スナップショットは補助履歴であり、日付がDBに残っていないため直近査定の決定には使っていない。',
  '',
  '## QA',
  '',
  '- 測定年が判明: ' + qa.known_measurement_clusters + '測定クラスタ / ' + qa.known_measurement_players + '選手（厳密な測定日あり ' + qa.exact_measurement_dates_available + '件）',
  '- 当時に最も近いパワプロ走力を取得: ' + qa.nearest_pawapuro_speed_acquired + '件',
  '- 当時から2025終了の変化を算出: ' + qa.nearest_to_2025_end_change_calculable + '件',
  '- 年不明のまま未割当: ' + qa.unknown_measurement_year_players_not_assigned + '選手 / ' + qa.unknown_measurement_year_clusters_not_assigned + '測定クラスタ',
  '- 査定時点が測定からプラスマイナス1年以内: ' + qa.within_plus_minus_1_year + '件、プラスマイナス2年以内: ' + qa.within_plus_minus_2_years + '件',
  '- 最大上昇（直近から2025終了）: ' + qa.maximum_increase_nearest_to_2025_end.map(item => item.player + ' +' + item.change).join('、'),
  '- 最大低下（直近から2025終了）: ' + qa.maximum_decline_nearest_to_2025_end.map(item => item.player + ' ' + item.change).join('、'),
  '- 据え置き（直近から2025終了）: ' + qa.unchanged_nearest_to_2025_end.map(item => item.player + ' (' + item.speed + ')').join('、'),
  '',
  '## 一覧',
  '',
  '| 選手 | 身体測定 | 測定年 | 直近パワプロ | 当時走力 | 2025終了 | 変化 | 時点差 | 出典 |',
  '| -- | -- | --: | -- | --: | --: | --: | --: | -- |',
  ...records.map(tableRow),
  '',
  '## データ上の限界',
  '',
  '- 測定日不明の行は日数差を作らず、年差のみを保存した。',
  '- 測定時点に選手がパワプロに存在しない場合は、その選手が初めて収録された実在の版を直近値にした。作品年だけを機械的に当てはめていない。',
  '- data/pennant.db を参照した。指定名の 07_pennant.db はワークツリー内に存在しなかった。',
  '- 本ファイルは時系列の収集結果であり、走力の妥当性や身体能力との対応の結論は含めない。',
  '',
].join('\n');

fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true });
fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
fs.writeFileSync(OUT_CSV, csv, 'utf8');
fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2) + '\n', 'utf8');
fs.writeFileSync(OUT_MD, markdown, 'utf8');
console.log(JSON.stringify({ csv: path.relative(ROOT, OUT_CSV), json: path.relative(ROOT, OUT_JSON), markdown: path.relative(ROOT, OUT_MD), qa }, null, 2));
