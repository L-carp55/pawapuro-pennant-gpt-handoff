import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

/*
 * PowerPro speed history panel builder.
 *
 * Scope: collect historical published ratings only.  It does not modify the
 * pennant database, derive a new rating, or analyse rating validity.
 *
 * Numeric abilities come from one archived BASELESS player-data page per
 * work/version/team.  Distribution dates and descriptions are kept in a
 * separate manifest sourced from KONAMI's official update pages.  This
 * deliberately avoids treating an update's roster-registration cutoff as a
 * universal player-rating date.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = path.join(ROOT, 'data', 'pennant.db');
const PHYSICAL_PATH = path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json');
const OUT_DIR = path.join(ROOT, 'outputs', 'derived');
const DOC_DIR = path.join(ROOT, 'docs', 'audits');
const OUT_PANEL_CSV = path.join(OUT_DIR, 'pawapuro_speed_history_panel_2015_2026.csv');
const OUT_PANEL_JSON = path.join(OUT_DIR, 'pawapuro_speed_history_panel_2015_2026.json');
const OUT_EVENTS_CSV = path.join(OUT_DIR, 'pawapuro_speed_change_events_2015_2026.csv');
const OUT_SUMMARY_CSV = path.join(OUT_DIR, 'pawapuro_speed_history_player_summary_2015_2026.csv');
const OUT_PHYSICAL_CSV = path.join(OUT_DIR, 'pawapuro_speed_history_physical_measurement_matches_20260809.csv');
const OUT_AUDIT = path.join(DOC_DIR, 'pawapuro_speed_history_2015_2026.md');

const BASELESS_ROOT = 'https://www.baseless.org/data/source';
const USER_AGENT = 'Mozilla/5.0 (compatible; pawapuro-speed-history-panel/1.0; personal, non-commercial)';
const TEAM_CODES = [
  ['G', '読売ジャイアンツ'], ['T', '阪神タイガース'], ['BA', '横浜DeNAベイスターズ'],
  ['D', '中日ドラゴンズ'], ['S', '東京ヤクルトスワローズ'], ['C', '広島東洋カープ'],
  ['H', '福岡ソフトバンクホークス'], ['OBU', 'オリックス・バファローズ'],
  ['M', '千葉ロッテマリーンズ'], ['E', '東北楽天ゴールデンイーグルス'],
  ['F', '北海道日本ハムファイターズ'], ['L', '埼玉西武ライオンズ'],
];
const TEAM_BY_CODE = Object.fromEntries(TEAM_CODES);
const WORKS = ['2013', '2014', '2016', '2018', '2020', '2022', '2024', '2026'];
const EXPECTED_VERSION_COUNT = { 2013: 2, 2014: 3, 2016: 9, 2018: 10, 2020: 9, 2022: 10, 2024: 12, 2026: 3 };
const OFFICIAL_UNARCHIVED = {
  2016: ['1.02', '1.04', '1.08'],
  2018: ['1.02', '1.03', '1.04', '1.06', '1.08', '1.13'],
  2020: ['1.01', '1.02', '1.04', '1.08', '1.10', '1.11', '1.14'],
  2022: ['1.01', '1.03', '1.05', '1.06', '1.14', '1.15'],
  2024: ['1.02', '1.03', '1.06', '1.13'],
  2026: [],
};

const TITLE = {
  2013: '実況パワフルプロ野球2013',
  2014: '実況パワフルプロ野球2014',
  2016: '実況パワフルプロ野球2016',
  2018: '実況パワフルプロ野球2018',
  2020: 'eBASEBALLパワフルプロ野球2020',
  2022: 'eBASEBALLパワフルプロ野球2022',
  2024: 'パワフルプロ野球2024-2025',
  2026: 'パワプロ2026-2027',
};

// `rating_reference_date` remains null unless KONAMI explicitly identifies a
// date as the all-player assessment reference.  The dates sometimes named in
// update notes are roster-registration cutoffs, not that claim.
const VERSION_METADATA = new Map();
function addMeta(work, archiveVersion, updateDate, referenceSeason, description, officialUrl, confidence = 'high', extra = {}) {
  VERSION_METADATA.set(`${work}|${archiveVersion}`, {
    game_title: TITLE[work],
    work: String(work),
    archive_version: archiveVersion,
    version: archiveVersion === 'default' ? 'archive_default_unversioned' : archiveVersion.replaceAll('_', '.'),
    official_version: archiveVersion === 'default' ? null : archiveVersion.replaceAll('_', '.'),
    update_date: updateDate,
    rating_reference_date: null,
    rating_reference_season: referenceSeason,
    rating_reference_description: description,
    official_update_url: officialUrl,
    source_confidence: confidence,
    metadata_flag: extra.metadata_flag ?? null,
  });
}

// Older pages are supplementary (before the requested 2015–2026 range).  No
// date is invented when an official page could not be recovered.
for (const version of ['default', '20131108']) {
  addMeta('2013', version, null, 2013,
    'Supplementary archived 2013 snapshot; official distribution-date mapping was not recovered.',
    null, 'medium', { metadata_flag: 'official_update_date_unverified' });
}
for (const version of ['default', '1_01', '1_02']) {
  addMeta('2014', version, null, 2014,
    'Supplementary archived 2014 snapshot; official distribution-date mapping was not recovered.',
    null, 'medium', { metadata_flag: 'official_update_date_unverified' });
}

const U2016 = 'https://www.konami.com/pawa/2016/update/index.html';
addMeta('2016', 'default', '2016-04-28', 2016, 'Title-release snapshot; BASELESS default is not an official version label.', 'https://www.konami.com/pawa/2016/', 'medium', { metadata_flag: 'archive_default_not_official_version' });
addMeta('2016', '1_01', '2016-04-28', 2016, 'Opening-period registered-player additions and player-data update.', U2016);
addMeta('2016', '1_03', '2016-06-30', 2016, 'Registered-player additions and player-data update; roster cutoff stated as 2016-05-31, not a universal assessment date.', U2016);
addMeta('2016', '1_05', '2016-09-08', 2016, 'Registered-player additions and player-data update; roster cutoff stated as 2016-07-31, not a universal assessment date.', U2016);
addMeta('2016', '1_06', '2016-12-15', 2016, '2016 season-end player-data update.', U2016);
addMeta('2016', '1_07', '2017-04-27', 2017, '2017 player data; players announced through 2017-02-11 added. Overall assessment date not stated.', U2016);
addMeta('2016', '1_09', '2017-07-13', 2017, 'Registered-player additions and player-data update; roster cutoff stated as 2017-05-18, not a universal assessment date.', U2016);
addMeta('2016', '1_10', '2017-09-14', 2017, 'Registered-player additions and player-data update; roster cutoff stated as 2017-07-31, not a universal assessment date.', U2016);
addMeta('2016', '1_11', '2017-11-21', 2017, '2017 season-end player-data update.', U2016);

addMeta('2018', 'default', '2018-04-26', 2018, 'Title-release snapshot; BASELESS default is not an official version label.', 'https://www.konami.com/pawa/2018/', 'medium', { metadata_flag: 'archive_default_not_official_version' });
addMeta('2018', '1_01', '2018-04-26', 2018, 'Release-day update.', 'https://www.konami.com/pawa/2018/update/180412');
addMeta('2018', '1_05', '2018-07-12', 2018, 'Registered-player additions and player-data update; roster cutoff stated as 2018-05-06, not a universal assessment date.', 'https://www.konami.com/pawa/2018/update/180705');
addMeta('2018', '1_07', '2018-09-13', 2018, 'Registered-player additions and player-data update; roster cutoff stated as 2018-07-31, not a universal assessment date.', 'https://www.konami.com/pawa/2018/update/180910');
addMeta('2018', '1_09', '2018-11-01', 2018, '2018 regular-season-end player-data update.', 'https://www.konami.com/pawa/2018/update/181012');
addMeta('2018', '1_10', '2019-04-23', 2019, '2019 player data; players announced through 2019-01-07 added. Overall assessment date not stated.', 'https://www.konami.com/pawa/2018/update/190418');
addMeta('2018', '1_11', '2019-06-13', 2019, 'Registered-player additions and player-data update; roster cutoff stated as 2019-03-29, not a universal assessment date.', 'https://www.konami.com/pawa/2018/update/190611');
addMeta('2018', '1_12', '2019-08-02', 2019, 'Registered-player additions and player-data update; roster cutoff stated as 2019-05-07, not a universal assessment date.', 'https://www.konami.com/pawa/2018/update/190802');
addMeta('2018', '1_14', '2019-09-19', 2019, 'Registered-player additions and player-data update; roster cutoff stated as 2019-07-31, not a universal assessment date.', 'https://www.konami.com/pawa/2018/update/190919');
addMeta('2018', '1_15', '2019-10-25', 2019, '2019 regular-season-end player-data update.', 'https://www.konami.com/pawa/2018/update/191025');

addMeta('2020', 'default', '2020-07-09', 2020, 'Title-release snapshot; BASELESS default is not an official version label.', 'https://www.konami.com/pawa/2020/', 'medium', { metadata_flag: 'archive_default_not_official_version' });
addMeta('2020', '1_05', '2020-10-08', 2020, 'Registered-player additions; roster cutoff stated as 2020-08-01, not a universal assessment date.', 'https://www.konami.com/pawa/2020/update/201008');
addMeta('2020', '1_06', '2020-11-26', 2020, 'Registered-player additions; roster cutoff stated as 2020-09-30, not a universal assessment date.', 'https://www.konami.com/pawa/2020/update/201126');
addMeta('2020', '1_07', '2020-12-17', 2020, '2020 regular-season-end player-data update.', 'https://www.konami.com/pawa/2020/update/201217');
addMeta('2020', '1_09', '2021-04-08', 2021, '2021 player data; players announced through 2021-01-31 added. Overall assessment date not stated.', 'https://www.konami.com/pawa/2020/update/210408');
addMeta('2020', '1_12', '2021-05-20', 2021, 'Registered-player additions through 2021-03-26; overall assessment date not stated.', 'https://www.konami.com/pawa/2020/update/210520');
addMeta('2020', '1_13', '2021-07-28', 2021, 'Registered-player additions; roster cutoff stated as 2021-05-31, not a universal assessment date.', 'https://www.konami.com/pawa/2020/update/210728');
addMeta('2020', '1_15', '2021-10-28', 2021, 'Registered-player additions; roster cutoff stated as 2021-08-31, not a universal assessment date.', 'https://www.konami.com/pawa/2020/update/211028');
addMeta('2020', '1_16', '2021-12-23', 2021, '2021 regular-season-end player-data update.', 'https://www.konami.com/pawa/2020/update/211223');

addMeta('2022', 'default', '2022-04-21', 2022, 'Title-release snapshot; BASELESS default is not an official version label.', 'https://www.konami.com/pawa/2022/', 'medium', { metadata_flag: 'archive_default_not_official_version' });
addMeta('2022', '1_02', '2022-05-19', 2022, 'Registered-player additions and player-data update; roster cutoff stated as 2022-03-25, not a universal assessment date.', 'https://www.konami.com/pawa/2022/update/220519');
addMeta('2022', '1_04', '2022-07-21', 2022, 'Registered-player additions and player-data update; roster cutoff stated as 2022-05-31, not a universal assessment date.', 'https://www.konami.com/pawa/2022/update/220721');
addMeta('2022', '1_07', '2022-09-29', 2022, 'Registered-player additions and player-data update; roster cutoff stated as 2022-07-31, not a universal assessment date.', 'https://www.konami.com/pawa/2022/update/220929');
addMeta('2022', '1_08', '2022-11-24', 2022, '2022 regular-season-end player-data update.', 'https://www.konami.com/pawa/2022/update/221124');
addMeta('2022', '1_09', '2023-03-30', 2023, '2023 player data; players announced through 2023-01-31 added. Overall assessment date not stated.', 'https://www.konami.com/pawa/2022/update/230330');
addMeta('2022', '1_10', '2023-05-25', 2023, 'Registered-player additions and player-data update; roster cutoff stated as 2023-03-31, not a universal assessment date.', 'https://www.konami.com/pawa/2022/update/230525');
addMeta('2022', '1_11', '2023-07-20', 2023, 'Registered-player additions and player-data update; roster cutoff stated as 2023-06-02, not a universal assessment date.', 'https://www.konami.com/pawa/2022/update/230720');
addMeta('2022', '1_12', '2023-09-28', 2023, 'Registered-player additions and player-data update; roster cutoff stated as 2023-07-31, not a universal assessment date.', 'https://www.konami.com/pawa/2022/update/230928');
addMeta('2022', '1_13', '2023-11-30', 2023, '2023 regular-season-end player-data update.', 'https://www.konami.com/pawa/2022/update/231130');

addMeta('2024', 'default', '2024-07-18', 2024, 'Title-release snapshot; BASELESS default is not an official version label.', 'https://www.konami.com/pawa/2024-2025/', 'medium', { metadata_flag: 'archive_default_not_official_version' });
addMeta('2024', '1_01', '2024-07-18', 2024, 'Registered-player additions and player-data update; roster cutoff stated as 2024-05-17, not a universal assessment date.', 'https://www.konami.com/pawa/2024-2025/update/240718');
addMeta('2024', '1_04', '2024-09-26', 2024, 'Registered-player additions and player-data update; roster cutoff stated as 2024-07-31, not a universal assessment date.', 'https://www.konami.com/pawa/2024-2025/update/240926');
addMeta('2024', '1_05', '2024-10-21', 2024, 'Shohei Ohtani ability data update and related changes; overall assessment date not stated.', 'https://www.konami.com/pawa/2024-2025/update/241021');
addMeta('2024', '1_07', '2024-11-26', 2024, '2024 regular-season-end player-data update.', 'https://www.konami.com/pawa/2024-2025/update/241126');
addMeta('2024', '1_08', '2025-03-27', 2025, '2025 player data; players announced through 2025-01-27 added. Overall assessment date not stated.', 'https://www.konami.com/pawa/2024-2025/update/250327');
addMeta('2024', '1_09', '2025-04-23', 2025, 'Twelve players distributed through player-data download; overall assessment date not stated.', 'https://www.konami.com/pawa/2024-2025/update/250423');
addMeta('2024', '1_10', '2025-06-02', 2025, 'Some professional-player ability data updated; assessment date not stated.', 'https://www.konami.com/pawa/2024-2025/update/250602');
addMeta('2024', '1_11', '2025-07-28', 2025, 'Some professional-player ability data updated; assessment date not stated.', 'https://www.konami.com/pawa/2024-2025/update/250728');
addMeta('2024', '1_12', '2025-09-25', 2025, 'Registered-player additions and player-data update; roster cutoff stated as 2025-07-31, not a universal assessment date.', 'https://www.konami.com/pawa/2024-2025/update/250925');
addMeta('2024', '1_14', '2025-11-20', 2025, '2025 regular-season-end player-data update.', 'https://www.konami.com/pawa/2024-2025/update/251120');
addMeta('2024', '1_15', '2025-12-24', 2025, 'Some player abilities adjusted; assessment date not stated.', 'https://www.konami.com/pawa/2024-2025/update/251224');

addMeta('2026', 'default', '2026-06-11', 2026, 'Title-release snapshot; BASELESS default is not an official version label and its pre/post-release patch state is not distinguishable.', 'https://www.konami.com/pawa/2026-2027/', 'medium', { metadata_flag: 'archive_default_not_official_version' });
addMeta('2026', '1_10', '2026-06-11', 2026, 'Registered-player additions and player-data update through 2026-03-27; overall assessment date not stated.', 'https://www.konami.com/pawa/2026-2027/update/260611');
addMeta('2026', '1_11', '2026-06-30', 2026, 'Description and related corrections; player-assessment reference date not stated.', 'https://www.konami.com/pawa/2026-2027/update/260630');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normName = value => String(value ?? '')
  .normalize('NFKC')
  .replace(/[\s　・.．]/g, '')
  .replace(/[髙]/g, '高').replace(/[﨑]/g, '崎').replace(/[神]/g, '神').replace(/[塚]/g, '塚').replace(/[𠮷]/g, '吉')
  .replace(/[邊邉]/g, '辺').replace(/[濱]/g, '浜').replace(/[桒]/g, '桑').replace(/[澤]/g, '沢').replace(/[國]/g, '国')
  .replace(/[（(].*?[）)]/g, '');
const normTeam = value => String(value ?? '').normalize('NFKC').replace(/[\s　・]/g, '');
const versionNumeric = version => version === 'default' ? -1 : version.split('_').map(Number).reduce((sum, number, index) => sum + number / 100 ** index, 0);
const archivePageUrl = (work, code, archiveVersion) => `${BASELESS_ROOT}/${work}/dat_${code}${archiveVersion === 'default' ? '' : `_${archiveVersion}`}.html`;
const workPageUrl = work => `${BASELESS_ROOT}/${work}/work.html`;
const ymdToDay = ymd => Math.round(Date.parse(`${ymd}T00:00:00Z`) / 86400000);
const absoluteDays = (left, right) => Math.abs(ymdToDay(left) - ymdToDay(right));
const unique = values => [...new Set(values.filter(value => value !== null && value !== undefined && value !== ''))];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function toCsv(rows, headers) {
  return [headers.join(','), ...rows.map(row => headers.map(header => csvCell(row[header])).join(','))].join('\n') + '\n';
}
function writeAtomically(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, text, 'utf8');
  fs.renameSync(temporary, file);
}
function stripHtml(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
function markdownCell(value) {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', '<br>');
}
function markdownLink(label, url) {
  return url ? `[${label}](${url})` : '—';
}
function addFlag(record, flag) {
  record.conflict_flag = unique([...(record.conflict_flag ? record.conflict_flag.split(';') : []), flag]).join(';') || null;
}

function parseBaselessPage(html, team) {
  const blocks = html.split(/<p id=s(\d+)>/).slice(1);
  const players = [];
  for (let index = 0; index < blocks.length; index += 2) {
    const slot = Number(blocks[index]);
    const body = blocks[index + 1] ?? '';
    const nameMatch = body.match(/<b class="nm ([a-z]+)">([\s\S]*?)<\/b>/i);
    if (!nameMatch) continue;
    const positionCode = nameMatch[1];
    if (/^(p|pr|r|rp)$/i.test(positionCode)) continue;
    const displayName = stripHtml(nameMatch[2]);
    const abilitiesMatch = body.match(/<b id=b\d+ class="cb">([\s\S]*?)(?=<b id=[a-z]+\d+)/i);
    if (!displayName || !abilitiesMatch) continue;
    const values = {};
    for (const match of abilitiesMatch[1].matchAll(/<b class="c(\d) w"><b><\/b><i[^>]*>([^<]*)<\/i><\/b>/g)) {
      const number = Number(stripHtml(match[2]));
      if (Number.isFinite(number)) values[Number(match[1])] = number;
    }
    const [trajectory, contact, power, speed, arm, fielding, catching] = [1, 2, 3, 4, 5, 6, 7].map(key => values[key] ?? null);
    if (contact === null || power === null || speed === null) continue;
    players.push({ team, slot, display_name: displayName, position_code: positionCode, trajectory, contact, power, speed, arm, fielding, catching });
  }
  return players;
}

async function fetchDecoded(url, attemptLimit = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= attemptLimit; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      const bytes = await response.arrayBuffer();
      const html = new TextDecoder('shift_jis').decode(bytes);
      if (!response.ok || response.url.includes('/404.html') || !/<p id=s\d+>/.test(html) || !/id=b\d+ class="cb"/.test(html)) {
        throw new Error(`invalid archive response status=${response.status} final=${response.url}`);
      }
      return { html, final_url: response.url, bytes: bytes.byteLength, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attemptLimit) await sleep(700 * attempt);
    }
  }
  throw lastError;
}

async function discoverVersions(work) {
  const url = workPageUrl(work);
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const bytes = await response.arrayBuffer();
  const html = new TextDecoder('shift_jis').decode(bytes);
  if (!response.ok || response.url.includes('/404.html')) throw new Error(`work page unavailable ${url}`);
  const byCode = new Map(TEAM_CODES.map(([code]) => [code, new Set()]));
  const linkPattern = /(?:href\s*=\s*["'])?dat_(T|BA|G|D|C|S|H|F|OBU|E|L|M)(?:_(\d+(?:_\d+)*))?\.html/gi;
  for (const match of html.matchAll(linkPattern)) byCode.get(match[1])?.add(match[2] ?? 'default');
  const union = new Set();
  for (const versions of byCode.values()) for (const version of versions) union.add(version);
  const missingCodes = [...byCode.entries()].filter(([, versions]) => versions.size === 0).map(([code]) => code);
  return { work, url, versions: [...union].sort((left, right) => versionNumeric(left) - versionNumeric(right)), byCode, missingCodes };
}

function fallbackMeta(work, archiveVersion) {
  return {
    game_title: TITLE[work] ?? `PowerPro ${work}`,
    work,
    archive_version: archiveVersion,
    version: archiveVersion === 'default' ? 'archive_default_unversioned' : archiveVersion.replaceAll('_', '.'),
    official_version: archiveVersion === 'default' ? null : archiveVersion.replaceAll('_', '.'),
    update_date: null,
    rating_reference_date: null,
    rating_reference_season: null,
    rating_reference_description: 'BASELESS archive version found, but no matching KONAMI official update metadata was recovered.',
    official_update_url: null,
    source_confidence: 'medium',
    metadata_flag: 'official_version_metadata_unverified',
  };
}

function canonicalTeamKey(team) {
  const text = normTeam(team);
  const aliases = [
    [['読売ジャイアンツ', '巨人'], 'GIANTS'],
    [['阪神タイガース', '阪神'], 'TIGERS'],
    [['横浜DeNAベイスターズ', '横浜ＤｅＮＡベイスターズ', '横浜DeNA', '横浜'], 'BAYSTARS'],
    [['中日ドラゴンズ', '中日'], 'DRAGONS'],
    [['東京ヤクルトスワローズ', 'ヤクルト'], 'SWALLOWS'],
    [['広島東洋カープ', '広島'], 'CARP'],
    [['福岡ソフトバンクホークス', 'ソフトバンク'], 'HAWKS'],
    [['オリックス・バファローズ', 'オリックス'], 'BUFFALOES'],
    [['千葉ロッテマリーンズ', 'ロッテ'], 'MARINES'],
    [['東北楽天ゴールデンイーグルス', '楽天'], 'EAGLES'],
    [['北海道日本ハムファイターズ', '日本ハム'], 'FIGHTERS'],
    [['埼玉西武ライオンズ', '西武'], 'LIONS'],
  ];
  for (const [names, key] of aliases) if (names.some(name => normTeam(name) === text)) return key;
  return text;
}

function loadIdentityIndex() {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const rows = db.prepare(`
    SELECT DISTINCT season, player_id, name, team, position
    FROM batting
    WHERE game_type='公式戦' AND player_id IS NOT NULL AND COALESCE(position, '') <> '投'
  `).all();
  const latest = db.prepare(`SELECT MAX(season) AS max_season FROM batting`).get().max_season;
  // This is used only as a strict full-name-plus-club bridge for the small
  // physical-measurement join.  It does not supply historical ability values
  // and is not used to make a broad current-roster identity assumption.
  const currentRatingRows = db.prepare(`
    SELECT DISTINCT r.name AS rating_name, r.team AS rating_team,
           l.proeye_id, l.proeye_name
    FROM pawapuro_rating AS r
    JOIN pawapuro_link AS l ON l.name_norm = r.name_norm
    WHERE l.proeye_id IS NOT NULL
  `).all();
  db.close();
  const bySeasonTeam = new Map();
  const byTeam = new Map();
  const currentRatingByTeam = new Map();
  for (const row of rows) {
    const key = `${row.season}|${canonicalTeamKey(row.team)}`;
    if (!bySeasonTeam.has(key)) bySeasonTeam.set(key, []);
    bySeasonTeam.get(key).push({ ...row, name_norm: normName(row.name), name_without_initial: normName(row.name).replace(/^[A-Za-z]/, '') });
    const teamKey = canonicalTeamKey(row.team);
    if (!byTeam.has(teamKey)) byTeam.set(teamKey, []);
    byTeam.get(teamKey).push({ ...row, name_norm: normName(row.name), name_without_initial: normName(row.name).replace(/^[A-Za-z]/, '') });
  }
  for (const row of currentRatingRows) {
    const teamKey = canonicalTeamKey(row.rating_team);
    if (!currentRatingByTeam.has(teamKey)) currentRatingByTeam.set(teamKey, []);
    currentRatingByTeam.get(teamKey).push({
      ...row,
      player_id: String(row.proeye_id),
      name: row.rating_name,
      name_norm: normName(row.rating_name),
      name_without_initial: normName(row.rating_name).replace(/^[A-Za-z]/, ''),
      proeye_name_norm: normName(row.proeye_name),
      proeye_name_without_initial: normName(row.proeye_name).replace(/^[A-Za-z]/, ''),
    });
  }
  return { bySeasonTeam, byTeam, currentRatingByTeam, latestSeason: Number(latest) };
}

function candidateMatches(candidates, displayedName) {
  const displayed = normName(displayedName);
  const displayedWithoutInitial = displayed.replace(/^[A-Za-z]/, '');
  return candidates.map(candidate => {
    let score = 0;
    if (candidate.name_norm === displayed || candidate.name_without_initial === displayedWithoutInitial) score = 100;
    else if (displayed.length >= 2 && (candidate.name_norm.startsWith(displayed) || candidate.name_without_initial.startsWith(displayedWithoutInitial))) score = 50 + displayed.length;
    // Some game registrations use a distinctive given name (e.g., 飛雄馬),
    // while the statistical source stores the full surname+given name.
    else if (displayed.length >= 2 && (candidate.name_norm.endsWith(displayed) || candidate.name_without_initial.endsWith(displayedWithoutInitial))) score = 40 + displayed.length;
    return { candidate, score };
  }).filter(item => item.score > 0);
}

function uniqueCandidate(scored) {
  const ids = unique(scored.map(item => item.candidate.player_id));
  if (ids.length !== 1) return null;
  return scored.sort((left, right) => right.score - left.score || String(left.candidate.name).localeCompare(String(right.candidate.name), 'ja'))[0];
}

function assignIdentity(record, identityIndex) {
  const displayed = normName(record.display_name);
  const targetSeason = Number(record.rating_reference_season ?? record.work);
  let candidateSeason = targetSeason;
  let candidates = identityIndex.bySeasonTeam.get(`${candidateSeason}|${canonicalTeamKey(record.team)}`) ?? [];
  if (!candidates.length && targetSeason > identityIndex.latestSeason) {
    candidateSeason = identityIndex.latestSeason;
    candidates = identityIndex.bySeasonTeam.get(`${candidateSeason}|${canonicalTeamKey(record.team)}`) ?? [];
  }
  const primaryScored = candidateMatches(candidates, record.display_name);
  const primary = uniqueCandidate(primaryScored);
  if (primary) {
    const best = primary;
    const exact = best.score === 100;
    return {
      canonical_player_id: `proeye:${best.candidate.player_id}`,
      canonical_player_name: best.candidate.name,
      identity_confidence: candidateSeason === targetSeason ? (exact ? 'high' : 'medium') : (exact ? 'medium' : 'low'),
      identity_method: candidateSeason === targetSeason ? (exact ? 'exact_name_team_reference_season' : 'unique_prefix_team_reference_season') : (exact ? 'exact_name_team_latest_available_season' : 'unique_prefix_team_latest_available_season'),
    };
  }
  // Players can be on a game roster without a batting row in that exact
  // season.  A same-club all-season match is allowed only if it identifies
  // exactly one stored player_id; this is explicitly lower confidence than
  // the reference-season route and never resolves a name collision.
  const allTeamScored = candidateMatches(identityIndex.byTeam.get(canonicalTeamKey(record.team)) ?? [], record.display_name);
  const allTeam = uniqueCandidate(allTeamScored);
  if (allTeam) {
    const exact = allTeam.score === 100;
    return {
      canonical_player_id: `proeye:${allTeam.candidate.player_id}`,
      canonical_player_name: allTeam.candidate.name,
      identity_confidence: exact ? 'medium' : 'low',
      identity_method: exact ? 'exact_name_team_all_available_seasons' : 'unique_name_fragment_team_all_available_seasons',
    };
  }
  const ambiguity = unique(primaryScored.map(item => item.candidate.player_id)).length > 1 || unique(allTeamScored.map(item => item.candidate.player_id)).length > 1 ? 'ambiguous_name_team_identity' : 'no_local_canonical_match';
  return {
    canonical_player_id: `unresolved:${record.work}:${record.archive_version}:${record.team_code}:${record.slot}:${displayed}`,
    canonical_player_name: record.display_name,
    identity_confidence: 'unresolved',
    identity_method: ambiguity,
  };
}

function changeClass(change) {
  if (change === 0) return 'UNCHANGED';
  const absolute = Math.abs(change);
  if (absolute <= 2) return 'MINOR_CHANGE';
  if (absolute <= 5) return 'MODERATE_CHANGE';
  return 'MAJOR_CHANGE';
}
function chronologicalComparator(left, right) {
  if (left.update_date && right.update_date && left.update_date !== right.update_date) return left.update_date.localeCompare(right.update_date);
  if (left.update_date && !right.update_date) return -1;
  if (!left.update_date && right.update_date) return 1;
  const workDifference = Number(left.work) - Number(right.work);
  if (workDifference) return workDifference;
  const versionDifference = versionNumeric(left.archive_version) - versionNumeric(right.archive_version);
  if (versionDifference) return versionDifference;
  return String(left.observation_id).localeCompare(String(right.observation_id));
}

function calculateTimeline(records) {
  const byPlayer = new Map();
  for (const record of records) {
    if (!byPlayer.has(record.canonical_player_id)) byPlayer.set(record.canonical_player_id, []);
    byPlayer.get(record.canonical_player_id).push(record);
  }
  const sameDateConflicts = [];
  for (const playerRecords of byPlayer.values()) {
    const dated = playerRecords.filter(record => record.update_date).sort(chronologicalComparator);
    for (let index = 0; index < dated.length; index++) {
      const record = dated[index];
      if (index === 0) {
        record.previous_speed = null;
        record.speed_change = null;
        record.abs_speed_change = null;
        record.days_since_previous_rating = null;
        record.change_class = null;
      } else {
        const previous = dated[index - 1];
        record.previous_speed = previous.speed;
        record.speed_change = record.speed - previous.speed;
        record.abs_speed_change = Math.abs(record.speed_change);
        record.days_since_previous_rating = absoluteDays(record.update_date, previous.update_date);
        record.change_class = changeClass(record.speed_change);
      }
    }
    for (const record of playerRecords.filter(record => !record.update_date)) {
      record.previous_speed = null;
      record.speed_change = null;
      record.abs_speed_change = null;
      record.days_since_previous_rating = null;
      record.change_class = null;
    }
    const byDate = new Map();
    for (const record of dated) {
      if (!byDate.has(record.update_date)) byDate.set(record.update_date, []);
      byDate.get(record.update_date).push(record);
    }
    for (const [date, sameDate] of byDate.entries()) {
      if (new Set(sameDate.map(record => record.speed)).size > 1) {
        for (const record of sameDate) addFlag(record, 'same_date_speed_conflict');
        sameDateConflicts.push({ canonical_player_id: sameDate[0].canonical_player_id, player_name: sameDate[0].canonical_player_name, date, speeds: unique(sameDate.map(record => record.speed)).sort((a, b) => a - b), observations: sameDate.map(record => record.observation_id) });
      }
    }
  }
  return { byPlayer, sameDateConflicts };
}

function buildPlayerSummary(byPlayer) {
  const summary = [];
  for (const [canonicalPlayerId, entries] of byPlayer.entries()) {
    const ordered = [...entries].sort(chronologicalComparator);
    const dated = ordered.filter(record => record.update_date);
    const timeline = dated.length ? dated : ordered;
    const first = timeline[0] ?? null;
    const last = timeline.at(-1) ?? null;
    let longestUnchangedDays = 0;
    if (dated.length) {
      let unchangedStart = dated[0].update_date;
      for (let index = 1; index < dated.length; index++) {
        if (dated[index].speed_change === 0) {
          longestUnchangedDays = Math.max(longestUnchangedDays, absoluteDays(dated[index].update_date, unchangedStart));
        } else {
          unchangedStart = dated[index].update_date;
        }
      }
    }
    const speedValues = entries.map(record => record.speed).filter(Number.isFinite);
    const changes = dated.filter(record => record.speed_change !== null && record.speed_change !== 0);
    summary.push({
      canonical_player_id: canonicalPlayerId,
      player: entries[0].canonical_player_name,
      player_name: entries[0].canonical_player_name,
      identity_confidence: entries.some(record => record.identity_confidence === 'unresolved') ? 'unresolved' : entries.some(record => record.identity_confidence === 'low') ? 'low' : entries.some(record => record.identity_confidence === 'medium') ? 'medium' : 'high',
      first_rating_date: first?.update_date ?? null,
      last_rating_date: last?.update_date ?? null,
      first_speed: first?.speed ?? null,
      last_speed: last?.speed ?? null,
      max_speed: speedValues.length ? Math.max(...speedValues) : null,
      min_speed: speedValues.length ? Math.min(...speedValues) : null,
      total_change: first && last ? last.speed - first.speed : null,
      num_observations: entries.length,
      num_dated_observations: dated.length,
      num_changes: changes.length,
      num_major_changes: changes.filter(record => Math.abs(record.speed_change) >= 6).length,
      longest_unchanged_days: longestUnchangedDays,
    });
  }
  return summary.sort((left, right) => String(left.player_name).localeCompare(String(right.player_name), 'ja') || left.canonical_player_id.localeCompare(right.canonical_player_id));
}

function loadPhysicalRecords() {
  const source = JSON.parse(fs.readFileSync(PHYSICAL_PATH, 'utf8'));
  return source.players.flatMap(player => (player.records ?? [])
    .filter(record => ['T90ft', '30m', '50m'].includes(record.metric))
    .map(record => ({ ...record, player: player.player, team: player.team })));
}
function knownMeasurementYear(record) {
  return /^\d{4}$/.test(String(record.measurement_year ?? '')) ? Number(record.measurement_year) : null;
}
function resolvePhysicalIdentity(record, identityIndex) {
  const targetName = normName(record.player);
  const teamKey = canonicalTeamKey(record.team);
  const candidates = identityIndex.currentRatingByTeam.get(teamKey) ?? [];
  const matched = candidates.filter(candidate => unique([
    candidate.name_norm,
    candidate.name_without_initial,
    candidate.proeye_name_norm,
    candidate.proeye_name_without_initial,
  ]).includes(targetName));
  const ids = unique(matched.map(candidate => candidate.player_id));
  if (ids.length === 1) {
    const selected = matched.sort((left, right) => String(left.name).localeCompare(String(right.name), 'ja'))[0];
    return {
      canonical_player_id: `proeye:${selected.player_id}`,
      canonical_player_name: selected.name,
      name_forms: unique([
        selected.name_norm,
        selected.name_without_initial,
        selected.proeye_name_norm,
        selected.proeye_name_without_initial,
      ]),
      identity_match_method: 'current_local_rating_full_name_and_team',
    };
  }
  // Some 2025 roster identities are present in the repository's batting
  // history but absent from its saved current-rating table.  This fallback is
  // still exact after normalisation (or exact after removing a single foreign
  // player initial) and remains constrained to the same club.
  const battingCandidates = (identityIndex.byTeam.get(teamKey) ?? []).filter(candidate =>
    candidate.name_norm === targetName || candidate.name_without_initial === targetName);
  const battingIds = unique(battingCandidates.map(candidate => candidate.player_id));
  if (battingIds.length !== 1) return null;
  const battingSelected = battingCandidates.sort((left, right) => String(left.name).localeCompare(String(right.name), 'ja'))[0];
  return {
    canonical_player_id: `proeye:${battingSelected.player_id}`,
    canonical_player_name: battingSelected.name,
    name_forms: unique([battingSelected.name_norm, battingSelected.name_without_initial]),
    identity_match_method: 'local_batting_full_name_and_team',
  };
}
function panelDisplayMatchesPhysicalIdentity(displayName, identity) {
  const displayed = normName(displayName);
  const withoutInitial = displayed.replace(/^[A-Za-z]/, '');
  return identity.name_forms.some(form => form === displayed || form === withoutInitial || form.startsWith(displayed) || form.startsWith(withoutInitial));
}
function applyPhysicalIdentityBridges(records, identityIndex) {
  // A BASELESS name can be a one-character surname (notably 林).  When the
  // physical ledger itself supplies a full name and the local current roster
  // maps that exact full name to one player on the same club, that narrow
  // evidence may resolve otherwise-unresolved panel rows.  Existing resolved
  // panel IDs are never overwritten here.
  const candidatesByTeam = new Map();
  for (const physical of loadPhysicalRecords()) {
    const identity = resolvePhysicalIdentity(physical, identityIndex);
    if (!identity) continue;
    const teamKey = canonicalTeamKey(physical.team);
    if (!candidatesByTeam.has(teamKey)) candidatesByTeam.set(teamKey, []);
    if (!candidatesByTeam.get(teamKey).some(item => item.canonical_player_id === identity.canonical_player_id)) candidatesByTeam.get(teamKey).push(identity);
  }
  let bridgedObservationCount = 0;
  for (const record of records) {
    if (record.identity_confidence !== 'unresolved') continue;
    const candidates = (candidatesByTeam.get(canonicalTeamKey(record.team)) ?? [])
      .filter(identity => panelDisplayMatchesPhysicalIdentity(record.display_name, identity));
    const ids = unique(candidates.map(identity => identity.canonical_player_id));
    if (ids.length !== 1) continue;
    const identity = candidates[0];
    Object.assign(record, {
      canonical_player_id: identity.canonical_player_id,
      canonical_player_name: identity.canonical_player_name,
      player_name: identity.canonical_player_name,
      identity_confidence: 'medium',
      identity_method: 'physical_full_name_team_current_roster_bridge',
    });
    bridgedObservationCount++;
  }
  return { bridgedObservationCount };
}
function buildPhysicalMatches(records, identityIndex) {
  const physicalRecords = loadPhysicalRecords();
  const matches = physicalRecords.map(record => {
    const year = knownMeasurementYear(record);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(record.measurement_date ?? '')) ? record.measurement_date : null;
    const identity = resolvePhysicalIdentity(record, identityIndex);
    const candidates = identity ? records.filter(candidate => candidate.canonical_player_id === identity.canonical_player_id) : [];
    const base = {
      measurement_cluster_id: record.same_measurement_cluster_id ?? null,
      player: record.player,
      team: record.team,
      measurement_metric: record.metric,
      measurement_value: record.seconds ?? record.value ?? null,
      measurement_unit: record.metric === 'sprint_speed_kmh' ? 'km/h' : 'seconds',
      measurement_date: date,
      measurement_year: year,
      measurement_timing_method: record.timing_method ?? null,
      measurement_usage_class: record.usage_class ?? null,
      physical_source: record.source_name ?? null,
      physical_source_url: record.source_url ?? null,
      canonical_player_id: identity?.canonical_player_id ?? null,
      matched_player_name: identity?.canonical_player_name ?? null,
      nearest_pawapuro_observation_id: null,
      nearest_pawapuro_date: null,
      nearest_pawapuro_rating_date: null,
      nearest_pawapuro_title: null,
      nearest_pawapuro_version: null,
      nearest_pawapuro_speed: null,
      nearest_pawapuro_source_url: null,
      measurement_to_pawapuro_gap_days: null,
      measurement_to_pawapuro_gap_years: null,
      gap_days: null,
      gap_years: null,
      match_status: null,
      identity_match_method: identity?.identity_match_method ?? null,
    };
    if (!year) return { ...base, match_status: 'unmatched_measurement_year_unknown', identity_match_method: identity?.identity_match_method ?? 'not_attempted' };
    if (!identity) return { ...base, match_status: 'unmatched_player_identity', identity_match_method: 'no_unique_current_local_full_name_team_identity' };
    const dated = candidates.filter(candidate => candidate.update_date);
    if (!dated.length) return { ...base, match_status: candidates.length ? 'unmatched_no_dated_panel_observation' : 'unmatched_no_panel_observation_for_resolved_identity', identity_match_method: identity.identity_match_method };
    dated.sort((left, right) => {
      const leftGap = date ? absoluteDays(left.update_date, date) : Math.abs(Number(left.update_date.slice(0, 4)) - year);
      const rightGap = date ? absoluteDays(right.update_date, date) : Math.abs(Number(right.update_date.slice(0, 4)) - year);
      return leftGap - rightGap || chronologicalComparator(left, right);
    });
    const nearest = dated[0];
    return {
      ...base,
      canonical_player_id: identity.canonical_player_id,
      matched_player_name: identity.canonical_player_name,
      nearest_pawapuro_observation_id: nearest.observation_id,
      nearest_pawapuro_date: nearest.update_date,
      nearest_pawapuro_rating_date: nearest.update_date,
      nearest_pawapuro_title: nearest.game_title,
      nearest_pawapuro_version: nearest.version,
      nearest_pawapuro_speed: nearest.speed,
      nearest_pawapuro_source_url: nearest.source_url,
      measurement_to_pawapuro_gap_days: date ? absoluteDays(nearest.update_date, date) : null,
      measurement_to_pawapuro_gap_years: date ? null : Math.abs(Number(nearest.update_date.slice(0, 4)) - year),
      gap_days: date ? absoluteDays(nearest.update_date, date) : null,
      gap_years: date ? null : Math.abs(Number(nearest.update_date.slice(0, 4)) - year),
      match_status: 'matched_nearest_update_date',
      identity_match_method: identity.identity_match_method,
    };
  });
  return matches;
}

function countBy(values, key) {
  const counts = new Map();
  for (const value of values) counts.set(key(value), (counts.get(key(value)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right), 'ja')));
}
function changeBucket(change) {
  if (change === 0) return 'unchanged (0)';
  if (change === 1) return '+1';
  if (change === -1) return '-1';
  if (change === 2) return '+2';
  if (change === -2) return '-2';
  if (change >= 3 && change <= 5) return '+3 to +5';
  if (change <= -3 && change >= -5) return '-3 to -5';
  if (change >= 6) return '+6 or more';
  return '-6 or less';
}

function buildAudit({ records, workManifest, fetchFailures, parserFailures, summary, events, physicalMatches, timeline, physicalIdentityBridge }) {
  const allDatedTransitions = records.filter(record => record.speed_change !== null);
  const changeDistribution = countBy(allDatedTransitions, record => changeBucket(record.speed_change));
  const yearCoverage = Array.from({ length: 12 }, (_, index) => 2015 + index).map(year => {
    const observationCount = records.filter(record => record.rating_reference_season === year).length;
    return { year, observation_count: observationCount, status: observationCount ? 'covered' : 'missing', note: year === 2015 ? 'No independent home-console work or archived player-data snapshot was recovered.' : observationCount ? 'At least one archived update labels this as its reference season.' : 'No source-available archived snapshot.' };
  });
  const versionCounts = workManifest.map(item => ({
    work: item.work,
    game_title: TITLE[item.work],
    discovered_versions: item.versions.length,
    expected_versions: EXPECTED_VERSION_COUNT[item.work] ?? null,
    planned_pages: item.planned_pages,
    fetched_pages: item.fetched_pages,
    parsed_batter_observations: item.parsed_observations,
    work_page_url: item.url,
  }));
  const duplicateObservationIds = records.length - new Set(records.map(record => record.observation_id)).size;
  const unresolved = records.filter(record => record.identity_confidence === 'unresolved');
  const speedNull = records.filter(record => record.speed === null || record.speed === undefined);
  const sourceUrlMissing = records.filter(record => !record.source_url);
  const unusual = events.filter(event => Math.abs(event.speed_change) >= 20);
  const knownPhysical = physicalMatches.filter(record => record.measurement_year !== null);
  const knownClusters = unique(knownPhysical.map(record => record.measurement_cluster_id));
  const matchedClusters = unique(knownPhysical.filter(record => record.match_status === 'matched_nearest_update_date').map(record => record.measurement_cluster_id));
  const totalPages = workManifest.reduce((sum, item) => sum + item.planned_pages, 0);
  const totalFetched = workManifest.reduce((sum, item) => sum + item.fetched_pages, 0);
  const qa = {
    all_pages_expected: totalPages,
    all_pages_fetched: totalFetched,
    all_page_retrieval_success: fetchFailures.length === 0 && parserFailures.length === 0 && totalPages === totalFetched,
    fetch_failure_count: fetchFailures.length,
    parser_failure_count: parserFailures.length,
    coverage_by_reference_season: yearCoverage,
    versions_by_work: versionCounts,
    official_versions_without_baseless_snapshot: OFFICIAL_UNARCHIVED,
    duplicate_observation_id_count: duplicateObservationIds,
    canonical_identity_unresolved_observations: unresolved.length,
    canonical_identity_unresolved_players: new Set(unresolved.map(record => record.canonical_player_id)).size,
    speed_null_count: speedNull.length,
    time_reversal_count: 0,
    same_player_same_date_conflict_count: timeline.sameDateConflicts.length,
    same_player_same_date_conflicts: timeline.sameDateConflicts,
    unusual_absolute_speed_change_gte_20_count: unusual.length,
    unusual_absolute_speed_change_gte_20_events: unusual,
    source_url_missing_count: sourceUrlMissing.length,
    physical_measurement_known_cluster_count: knownClusters.length,
    physical_measurement_matched_cluster_count: matchedClusters.length,
    physical_measurement_match_rate: knownClusters.length ? matchedClusters.length / knownClusters.length : null,
    physical_full_name_team_identity_bridged_observation_count: physicalIdentityBridge.bridgedObservationCount,
  };
  const lines = [];
  lines.push('# パワプロ実在NPB選手・走力査定時系列パネル（2015–2026）');
  lines.push('');
  lines.push(`- 生成日: ${new Date().toISOString().slice(0, 10)}`);
  lines.push('- 範囲: BASELESSに保存された家庭用パワプロの現役12球団・野手データ。投手は含めない。');
  lines.push('- 数値の出典はBASELESSアーカイブ、配信日・更新説明はKONAMI公式更新履歴。両者は別列で保持した。');
  lines.push('- 分析、身体値からの逆算、現在走力の変更は行っていない。');
  lines.push('- `rating_reference_date` は、公式が全選手共通の査定基準日を示さないため、推測で埋めず原則null。`update_date` は配信日である。');
  lines.push('');
  lines.push('## 収集カバレッジ');
  lines.push('');
  lines.push('| work | 作品 | アーカイブ版数 | 計画ページ | 取得ページ | 野手観測 | 出典 |');
  lines.push('| --: | --- | --: | --: | --: | --: | --- |');
  for (const row of versionCounts) lines.push(`| ${row.work} | ${markdownCell(row.game_title)} | ${row.discovered_versions} | ${row.planned_pages} | ${row.fetched_pages} | ${row.parsed_batter_observations} | ${markdownLink('BASELESS work', row.work_page_url)} |`);
  lines.push('');
  lines.push(`- 合計: ${records.length.toLocaleString('ja-JP')}観測、${new Set(records.map(record => record.canonical_player_id)).size.toLocaleString('ja-JP')} canonical player ID、${new Set(records.map(record => record.game_title + '|' + record.version)).size}版。`);
  lines.push(`- ページ取得: ${totalFetched}/${totalPages}。失敗 ${fetchFailures.length}、解析失敗 ${parserFailures.length}。`);
  lines.push('');
  lines.push('## 2015–2026 年別カバレッジ');
  lines.push('');
  lines.push('| 査定参照シーズン | 観測数 | 状態 | 注記 |');
  lines.push('| --: | --: | --- | --- |');
  for (const row of yearCoverage) lines.push(`| ${row.year} | ${row.observation_count.toLocaleString('ja-JP')} | ${row.status} | ${markdownCell(row.note)} |`);
  lines.push('');
  lines.push('## 変更幅の分布（解釈なし）');
  lines.push('');
  lines.push('| 区分 | 観測遷移数 |');
  lines.push('| --- | --: |');
  for (const bucket of ['unchanged (0)', '+1', '-1', '+2', '-2', '+3 to +5', '-3 to -5', '+6 or more', '-6 or less']) lines.push(`| ${bucket} | ${(changeDistribution[bucket] ?? 0).toLocaleString('ja-JP')} |`);
  lines.push('');
  const topRise = [...events].sort((left, right) => right.speed_change - left.speed_change || left.player_name.localeCompare(right.player_name, 'ja')).slice(0, 20);
  const topFall = [...events].sort((left, right) => left.speed_change - right.speed_change || left.player_name.localeCompare(right.player_name, 'ja')).slice(0, 20);
  function eventTable(title, rows) {
    lines.push(`## ${title}`); lines.push('');
    lines.push('| 選手 | 日付 | 前 | 後 | 変化 | 作品・版 | 出典 |');
    lines.push('| --- | --- | --: | --: | --: | --- | --- |');
    for (const row of rows) lines.push(`| ${markdownCell(row.player_name)} | ${row.update_date} | ${row.previous_speed} | ${row.speed} | ${row.speed_change > 0 ? '+' : ''}${row.speed_change} | ${markdownCell(`${row.game_title} ${row.version}`)} | ${markdownLink('BASELESS', row.source_url)} / ${markdownLink('KONAMI', row.official_update_url)} |`);
    lines.push('');
  }
  eventTable('上昇幅 上位20', topRise);
  eventTable('低下幅 上位20', topFall);
  lines.push('## 長期据え置きの例（配信日間隔）');
  lines.push('');
  lines.push('| 選手 | 最長据え置き日数 | 観測数 | 最終走力 |');
  lines.push('| --- | --: | --: | --: |');
  for (const row of [...summary].filter(row => row.longest_unchanged_days > 0).sort((left, right) => right.longest_unchanged_days - left.longest_unchanged_days).slice(0, 20)) lines.push(`| ${markdownCell(row.player_name)} | ${row.longest_unchanged_days.toLocaleString('ja-JP')} | ${row.num_observations} | ${row.last_speed ?? '—'} |`);
  lines.push('');
  lines.push('## 身体測定との近接時点マッチ');
  lines.push('');
  lines.push(`- 測定年が判明したクラスタ: ${knownClusters.length}、最寄り配信版を取得できたクラスタ: ${matchedClusters.length}、マッチ率: ${knownClusters.length ? `${(matchedClusters.length / knownClusters.length * 100).toFixed(1)}%` : '—'}。`);
  lines.push('- 測定年不明の行には年度を推測して割り当てていない。');
  lines.push(`- 身体測定台帳のフルネーム+球団と保存済み現行能力リンクで厳密に特定し、短縮名のみで未解決だったパネル行を${physicalIdentityBridge.bridgedObservationCount}件だけ補助結合した。`);
  lines.push('');
  lines.push('| 選手 | 身体測定 | 年 | 最寄り版 | 走力 | 時点差 | 出典 |');
  lines.push('| --- | --- | --: | --- | --: | --- | --- |');
  for (const row of physicalMatches.filter(row => row.measurement_year !== null).sort((left, right) => String(left.player).localeCompare(String(right.player), 'ja') || String(left.measurement_cluster_id).localeCompare(String(right.measurement_cluster_id)))) {
    const gap = row.measurement_to_pawapuro_gap_days !== null ? `${row.measurement_to_pawapuro_gap_days}日` : row.measurement_to_pawapuro_gap_years !== null ? `${row.measurement_to_pawapuro_gap_years}年` : '—';
    lines.push(`| ${markdownCell(row.player)} | ${markdownCell(`${row.measurement_metric} ${row.measurement_value ?? '—'}${row.measurement_unit === 'seconds' ? '秒' : ''}`)} | ${row.measurement_year} | ${markdownCell(row.nearest_pawapuro_title ? `${row.nearest_pawapuro_title} ${row.nearest_pawapuro_version}` : row.match_status)} | ${row.nearest_pawapuro_speed ?? '—'} | ${gap} | ${markdownLink('身体', row.physical_source_url)} / ${markdownLink('走力', row.nearest_pawapuro_source_url)} |`);
  }
  lines.push('');
  lines.push('## QA');
  lines.push('');
  lines.push(`- 版別ページの全取得成功: ${qa.all_page_retrieval_success ? 'yes' : 'no'} (${qa.all_pages_fetched}/${qa.all_pages_expected})`);
  lines.push(`- 重複 observation ID: ${qa.duplicate_observation_id_count}`);
  lines.push(`- canonical ID 未解決: ${qa.canonical_identity_unresolved_observations}観測 / ${qa.canonical_identity_unresolved_players}ID`);
  lines.push(`- 走力null: ${qa.speed_null_count}`);
  lines.push(`- 時系列逆行: ${qa.time_reversal_count}`);
  lines.push(`- 同一選手・同日で走力が異なる版: ${qa.same_player_same_date_conflict_count}`);
  lines.push(`- 絶対変化20以上: ${qa.unusual_absolute_speed_change_gte_20_count}`);
  lines.push(`- 走力数値の出典URL欠損: ${qa.source_url_missing_count}`);
  lines.push('');
  lines.push('## 残る取得上の制約');
  lines.push('');
  lines.push('- BASELESSにない公式版は、値を推測して埋めていない。作品ごとの該当版はJSONの `official_versions_without_baseless_snapshot` に残した。');
  lines.push('- 生年月日は、今回使った保存済み能力データとDBに系統的な一次値がなかったためnull。年齢も推測していない。');
  lines.push('- canonical IDは原則として保存済みプロ野球統計のplayer_idと、同一球団・査定参照年の一意一致でのみ確定。身体測定結合に限り、台帳のフルネーム+球団と保存済み現行能力リンクが一意に一致する場合だけ未解決短縮名を補助結合した。その他の曖昧な姓や新規未出場選手は `unresolved` のまま残した。');
  lines.push('');
  return { qa, markdown: lines.join('\n').replace(/\n+$/, '\n') };
}

async function parallelMap(items, concurrency, worker) {
  const output = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
      done++;
      if (done % 24 === 0 || done === items.length) console.error(`取得進行 ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return output;
}

async function main() {
  const concurrency = Number(process.env.PAWAPURO_HISTORY_CONCURRENCY ?? 2);
  const interRequestPauseMs = Number(process.env.PAWAPURO_HISTORY_PAUSE_MS ?? 650);
  const identityIndex = loadIdentityIndex();
  const workManifest = [];
  for (const work of WORKS) {
    const discovered = await discoverVersions(work);
    if (discovered.missingCodes.length) throw new Error(`${work}: team links missing for ${discovered.missingCodes.join(',')}`);
    workManifest.push({ ...discovered, planned_pages: 0, fetched_pages: 0, parsed_observations: 0 });
    console.error(`${work}: ${discovered.versions.join(', ')}`);
    await sleep(interRequestPauseMs);
  }
  const jobs = [];
  for (const item of workManifest) {
    for (const archiveVersion of item.versions) {
      const presentCodes = TEAM_CODES.map(([code]) => code).filter(code => item.byCode.get(code)?.has(archiveVersion));
      if (presentCodes.length !== TEAM_CODES.length) throw new Error(`${item.work}/${archiveVersion}: only ${presentCodes.length}/${TEAM_CODES.length} active teams linked`);
      for (const code of presentCodes) jobs.push({ work: item.work, archive_version: archiveVersion, team_code: code, team: TEAM_BY_CODE[code], url: archivePageUrl(item.work, code, archiveVersion) });
    }
  }
  for (const item of workManifest) item.planned_pages = jobs.filter(job => job.work === item.work).length;
  console.error(`取得計画: ${jobs.length} team-version pages / concurrency=${concurrency} / pause=${interRequestPauseMs}ms`);
  const fetchFailures = [];
  const parserFailures = [];
  const fetched = await parallelMap(jobs, concurrency, async job => {
    try {
      const downloaded = await fetchDecoded(job.url);
      const players = parseBaselessPage(downloaded.html, job.team);
      if (players.length < 20) throw new Error(`parsed ${players.length} batters (minimum 20)`);
      await sleep(interRequestPauseMs);
      return { ok: true, job, players, bytes: downloaded.bytes, final_url: downloaded.final_url };
    } catch (error) {
      await sleep(interRequestPauseMs);
      return { ok: false, job, error: String(error?.message ?? error) };
    }
  });
  const records = [];
  for (const result of fetched) {
    const manifest = workManifest.find(item => item.work === result.job.work);
    if (!result.ok) {
      fetchFailures.push({ ...result.job, error: result.error });
      continue;
    }
    manifest.fetched_pages++;
    const metadata = VERSION_METADATA.get(`${result.job.work}|${result.job.archive_version}`) ?? fallbackMeta(result.job.work, result.job.archive_version);
    for (const player of result.players) {
      const record = {
        observation_id: `${result.job.work}:${result.job.archive_version}:${result.job.team_code}:${player.slot}`,
        canonical_player_id: null,
        canonical_player_name: null,
        player_name: null,
        display_name: player.display_name,
        team: result.job.team,
        team_code: result.job.team_code,
        birth_date: null,
        age_at_rating: null,
        game_title: metadata.game_title,
        work: metadata.work,
        version: metadata.version,
        official_version: metadata.official_version,
        archive_version: metadata.archive_version,
        update_date: metadata.update_date,
        rating_reference_date: metadata.rating_reference_date,
        rating_reference_season: metadata.rating_reference_season,
        rating_reference_description: metadata.rating_reference_description,
        performance_season_used: null,
        speed: player.speed,
        trajectory: player.trajectory,
        contact: player.contact,
        power: player.power,
        arm: player.arm,
        fielding: player.fielding,
        catching: player.catching,
        position_code: player.position_code,
        slot: player.slot,
        previous_speed: null,
        speed_change: null,
        abs_speed_change: null,
        days_since_previous_rating: null,
        change_class: null,
        source: 'BASELESS archived active-roster player-data page for numeric ability; KONAMI official page for version/date metadata.',
        source_url: result.job.url,
        official_update_url: metadata.official_update_url,
        source_confidence: metadata.source_confidence,
        identity_confidence: null,
        identity_method: null,
        conflict_flag: metadata.metadata_flag,
      };
      const identity = assignIdentity(record, identityIndex);
      Object.assign(record, identity, { player_name: identity.canonical_player_name });
      records.push(record);
      manifest.parsed_observations++;
    }
  }
  if (fetchFailures.length) {
    parserFailures.push(...fetchFailures.filter(failure => failure.error.includes('parsed ')));
    throw new Error(`Archive retrieval incomplete (${fetchFailures.length}/${jobs.length} page failures). No outputs were written. First failure: ${JSON.stringify(fetchFailures[0])}`);
  }
  records.sort(chronologicalComparator);
  const physicalIdentityBridge = applyPhysicalIdentityBridges(records, identityIndex);
  const timeline = calculateTimeline(records);
  const events = records.filter(record => record.speed_change !== null && record.speed_change !== 0).map(record => ({
    canonical_player_id: record.canonical_player_id,
    player: record.canonical_player_name,
    player_name: record.canonical_player_name,
    team: record.team,
    age: record.age_at_rating,
    age_at_rating: record.age_at_rating,
    date: record.update_date,
    update_date: record.update_date,
    previous_speed: record.previous_speed,
    new_speed: record.speed,
    speed: record.speed,
    change: record.speed_change,
    speed_change: record.speed_change,
    abs_speed_change: record.abs_speed_change,
    days_since_previous_rating: record.days_since_previous_rating,
    days_since_previous: record.days_since_previous_rating,
    game_title: record.game_title,
    work: record.work,
    version: record.version,
    rating_reference_season: record.rating_reference_season,
    source_url: record.source_url,
    official_update_url: record.official_update_url,
  }));
  const summary = buildPlayerSummary(timeline.byPlayer);
  const physicalMatches = buildPhysicalMatches(records, identityIndex);
  const audit = buildAudit({ records, workManifest, fetchFailures, parserFailures, summary, events, physicalMatches, timeline, physicalIdentityBridge });
  const panelHeaders = [
    'observation_id', 'canonical_player_id', 'canonical_player_name', 'player_name', 'display_name', 'team', 'team_code', 'birth_date', 'age_at_rating',
    'game_title', 'work', 'version', 'official_version', 'archive_version', 'update_date', 'rating_reference_date', 'rating_reference_season', 'rating_reference_description', 'performance_season_used',
    'speed', 'trajectory', 'contact', 'power', 'arm', 'fielding', 'catching', 'position_code', 'slot',
    'previous_speed', 'speed_change', 'abs_speed_change', 'days_since_previous_rating', 'change_class',
    'source', 'source_url', 'official_update_url', 'source_confidence', 'identity_confidence', 'identity_method', 'conflict_flag',
  ];
  const eventHeaders = ['canonical_player_id', 'player', 'team', 'age', 'age_at_rating', 'date', 'previous_speed', 'new_speed', 'change', 'abs_speed_change', 'days_since_previous', 'days_since_previous_rating', 'game_title', 'work', 'version', 'rating_reference_season', 'source_url', 'official_update_url'];
  const summaryHeaders = ['canonical_player_id', 'player', 'player_name', 'identity_confidence', 'first_rating_date', 'last_rating_date', 'first_speed', 'last_speed', 'max_speed', 'min_speed', 'total_change', 'num_observations', 'num_dated_observations', 'num_changes', 'num_major_changes', 'longest_unchanged_days'];
  const physicalHeaders = ['measurement_cluster_id', 'player', 'team', 'measurement_metric', 'measurement_value', 'measurement_unit', 'measurement_date', 'measurement_year', 'measurement_timing_method', 'measurement_usage_class', 'physical_source', 'physical_source_url', 'canonical_player_id', 'matched_player_name', 'nearest_pawapuro_observation_id', 'nearest_pawapuro_date', 'nearest_pawapuro_rating_date', 'nearest_pawapuro_title', 'nearest_pawapuro_version', 'nearest_pawapuro_speed', 'nearest_pawapuro_source_url', 'measurement_to_pawapuro_gap_days', 'measurement_to_pawapuro_gap_years', 'gap_days', 'gap_years', 'match_status', 'identity_match_method'];
  const generatedAt = new Date().toISOString();
  const panelJson = {
    schema_version: '1.0.0',
    generated_at: generatedAt,
    purpose: 'Longitudinal collection of published PowerPro speed ratings. No individual rating decisions, causal analysis, or current-rating changes are included.',
    scope: {
      requested_calendar_range: '2015-2026',
      supplementary_earlier_works: ['2013', '2014'],
      included_players: 'BASELESS active-roster non-pitchers only',
      excluded_players: 'pitchers, OB/legend pages, and non-active-roster categories',
      no_database_writes: true,
    },
    temporal_policy: {
      update_date: 'Official KONAMI delivery date when available.',
      rating_reference_date: 'Null unless KONAMI explicitly states an all-player assessment reference date; roster-registration cutoffs are not substituted.',
      rating_reference_season: 'Officially described season where available; not inferred from work/title alone.',
      default_archive_versions: 'BASELESS default is an archive label, not asserted to equal a KONAMI version.',
    },
    sources: {
      numeric_ratings: 'BASELESS archived active-roster player-data pages',
      version_and_date_metadata: 'KONAMI official product/update pages',
      canonical_identity: 'Repository data/pennant.db batting player_id only when same-team, reference-season matching is unique; physical-measurement joins may additionally use a strict local current-rating full-name-and-team bridge to resolve an otherwise-unresolved short display name.',
      birth_dates: 'No systematic local source available; null retained rather than inferred.',
    },
    source_manifest: workManifest.map(item => ({
      work: item.work,
      game_title: TITLE[item.work],
      work_page_url: item.url,
      discovered_versions: item.versions,
      planned_pages: item.planned_pages,
      fetched_pages: item.fetched_pages,
      parsed_batter_observations: item.parsed_observations,
      official_versions_without_baseless_snapshot: OFFICIAL_UNARCHIVED[item.work] ?? [],
    })),
    qa: audit.qa,
    observations: records,
    player_timelines: [...timeline.byPlayer.entries()].map(([canonicalPlayerId, entries]) => ({
      canonical_player_id: canonicalPlayerId,
      player_name: entries[0]?.canonical_player_name ?? null,
      identity_confidence: entries.some(record => record.identity_confidence === 'unresolved') ? 'unresolved' : entries.some(record => record.identity_confidence === 'low') ? 'low' : entries.some(record => record.identity_confidence === 'medium') ? 'medium' : 'high',
      observation_ids: [...entries].sort(chronologicalComparator).map(record => record.observation_id),
    })).sort((left, right) => String(left.player_name).localeCompare(String(right.player_name), 'ja') || left.canonical_player_id.localeCompare(right.canonical_player_id)),
    change_events: events,
    player_summary: summary,
    physical_measurement_matches: physicalMatches,
  };
  writeAtomically(OUT_PANEL_CSV, toCsv(records, panelHeaders));
  writeAtomically(OUT_PANEL_JSON, JSON.stringify(panelJson, null, 2) + '\n');
  writeAtomically(OUT_EVENTS_CSV, toCsv(events, eventHeaders));
  writeAtomically(OUT_SUMMARY_CSV, toCsv(summary, summaryHeaders));
  writeAtomically(OUT_PHYSICAL_CSV, toCsv(physicalMatches, physicalHeaders));
  writeAtomically(OUT_AUDIT, audit.markdown);
  console.log(JSON.stringify({
    ok: true,
    records: records.length,
    unique_canonical_players: new Set(records.map(record => record.canonical_player_id)).size,
    events: events.length,
    major_events: events.filter(event => Math.abs(event.speed_change) >= 6).length,
    physical_matches: physicalMatches.filter(record => record.match_status === 'matched_nearest_update_date').length,
    qa: audit.qa,
    outputs: [OUT_PANEL_CSV, OUT_PANEL_JSON, OUT_EVENTS_CSV, OUT_SUMMARY_CSV, OUT_PHYSICAL_CSV, OUT_AUDIT],
  }, null, 2));
}

if (process.env.PAWAPURO_HISTORY_RUN_MAIN !== '0') await main();

export { loadIdentityIndex, loadPhysicalRecords, resolvePhysicalIdentity };
