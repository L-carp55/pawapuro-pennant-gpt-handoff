// SP-056 — PowerPro vs Prospi same-time divergence. QA evidence only. Not a teacher.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT = path.join(ROOT, 'outputs', 'derived', 'speed_prospi_gamex_current_20260813_run3.csv');
const HIST = path.join(ROOT, 'outputs', 'derived', 'speed_prospi_gamex_historical_20260813_run3.csv');
const PP = path.join(ROOT, 'outputs', 'derived', 'sp041_powerpro_normalized.json');
const MASTER = path.join(ROOT, 'outputs', 'derived', 'speed_2026_100_owner_review_master_20260813.csv');
const OUT = path.join(ROOT, 'outputs', 'derived', 'sp056_powerpro_prospi_same_time_divergence_20260813.json');

function parseCsv(p) {
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  return lines.slice(1).map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
  });
}

const SPECIAL = /スペシャル|セレクション|侍ジャパン|アニバ|エキサイティング|OB|TS/;
const TIME_MAP = {
  '2026 Series 1': 2026,
  '2025 Series 2': 2025,
  '2025 Series 1': 2025,
};

function cards(rows) {
  return rows.filter(r => r.record_type === 'MATCHED_CARD' && r.attribute_name === '走力' && !SPECIAL.test(r.source_card_type || ''));
}

const master = parseCsv(MASTER);
const pp = JSON.parse(readFileSync(PP, 'utf8'));
const ppByPidYear = new Map();
for (const t of pp.trajectories) {
  const pid = String(t.pid).replace(/^proeye:/, '');
  const m = new Map();
  for (const seg of String(t.text_raw ?? '').split('→')) {
    const mm = seg.trim().match(/^(\d{4}):(\d+)/);
    if (mm) m.set(Number(mm[1]), Number(mm[2]));
  }
  if (m.size) ppByPidYear.set(pid, m);
}

const prospi = [...cards(parseCsv(CURRENT)), ...cards(parseCsv(HIST))];
const pairs = [];
for (const r of prospi) {
  const year = TIME_MAP[r.edition];
  if (!year) continue;
  const pid = r.canonical_player_id;
  const ppVal = ppByPidYear.get(pid)?.get(year);
  const speed = Number(r.attribute_value);
  if (!Number.isFinite(speed) || ppVal == null) continue;
  pairs.push({
    player: r.player,
    pid,
    year,
    prospi_edition: r.edition,
    prospi_card_type: r.source_card_type,
    prospi_team_at_edition: r.source_team,
    prospi_speed: speed,
    powerpro_speed: ppVal,
    diff_prospi_minus_powerpro: speed - ppVal,
    use: 'STALE_OR_ODD_QA_ONLY',
    not_a_teacher: true,
  });
}

const byYear = {};
for (const p of pairs) {
  byYear[p.year] = byYear[p.year] ?? { n: 0, abs: 0, ge5: 0 };
  byYear[p.year].n += 1;
  byYear[p.year].abs += Math.abs(p.diff_prospi_minus_powerpro);
  if (Math.abs(p.diff_prospi_minus_powerpro) >= 5) byYear[p.year].ge5 += 1;
}
for (const y of Object.keys(byYear)) {
  byYear[y].mean_abs = Math.round((byYear[y].abs / byYear[y].n) * 100) / 100;
  delete byYear[y].abs;
}

const odd = [...pairs].sort((a, b) => Math.abs(b.diff_prospi_minus_powerpro) - Math.abs(a.diff_prospi_minus_powerpro)).slice(0, 20);
writeFileSync(OUT, JSON.stringify({
  generated_at: '2026-08-13',
  role: 'stale/odd QA evidence only. Do not apply as a PowerPro correction or teacher.',
  time_map: TIME_MAP,
  special_cards_excluded: true,
  pair_count: pairs.length,
  player_count: new Set(pairs.map(p => p.pid)).size,
  by_year: byYear,
  largest_abs_diffs: odd,
  pairs,
}, null, 2));
console.log(JSON.stringify({ pair_count: pairs.length, players: new Set(pairs.map(p => p.pid)).size, by_year: byYear }, null, 2));
