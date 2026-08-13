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

// ★review修正(2026-08-14): ProspiとPowerProは同じ0-100の数字を使っているが**尺度が違う**。
//   実測 Prospi mean 72.3 / sd 6.7 / 範囲58-87、PowerPro mean 65.0 / sd 14.4 / 範囲33-96。
//   ばらつきが2倍以上違い平均も7.3点ずれるため、生のdiffは「食い違い」ではなく尺度差を測る。
//   証拠: corr(diff, powerpro_speed) = -0.945 ＝ PowerProが低い選手ほど自動的に大きく出る。
//   生diff上位8人とz標準化後の上位8人は2人しか重ならない。
//   したがって stale/odd の抽出には**各source内で標準化してから**比べた値を使う。
//   生diffも消さずに併記する（尺度の差そのものを見たい場合があるため）。
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const sdOf = (a, m) => Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
const psArr = pairs.map(p => p.prospi_speed);
const pwArr = pairs.map(p => p.powerpro_speed);
const mP = mean(psArr), sP = sdOf(psArr, mP), mW = mean(pwArr), sW = sdOf(pwArr, mW);
for (const p of pairs) {
  p.prospi_z = Math.round(((p.prospi_speed - mP) / sP) * 1000) / 1000;
  p.powerpro_z = Math.round(((p.powerpro_speed - mW) / sW) * 1000) / 1000;
  p.scale_normalized_divergence_z = Math.round((p.prospi_z - p.powerpro_z) * 1000) / 1000;
}
const scaleNote = {
  prospi: { mean: +mP.toFixed(2), sd: +sP.toFixed(2) },
  powerpro: { mean: +mW.toFixed(2), sd: +sW.toFixed(2) },
  pearson_r: (() => {
    const cv = (a, b, ma, mb) => { let t = 0; for (let i = 0; i < a.length; i++) t += (a[i] - ma) * (b[i] - mb); return t / a.length; };
    return +(cv(psArr, pwArr, mP, mW) / (sP * sW)).toFixed(3);
  })(),
  corr_rawdiff_vs_powerpro: (() => {
    const d = pairs.map(p => p.diff_prospi_minus_powerpro); const md = mean(d), sdd = sdOf(d, md);
    let t = 0; for (let i = 0; i < d.length; i++) t += (d[i] - md) * (pwArr[i] - mW);
    return +((t / d.length) / (sdd * sW)).toFixed(3);
  })(),
  warning: '生diffは尺度差に支配される（corr(diff, powerpro)≈-0.95）。stale/odd抽出には scale_normalized_divergence_z を使う',
};

const oddRaw = [...pairs].sort((a, b) => Math.abs(b.diff_prospi_minus_powerpro) - Math.abs(a.diff_prospi_minus_powerpro)).slice(0, 20);
const oddZ = [...pairs].sort((a, b) => Math.abs(b.scale_normalized_divergence_z) - Math.abs(a.scale_normalized_divergence_z)).slice(0, 20);
writeFileSync(OUT, JSON.stringify({
  generated_at: '2026-08-13',
  reviewed_at: '2026-08-14 Opus senior review',
  role: 'stale/odd QA evidence only. Do not apply as a PowerPro correction or teacher.',
  time_map: TIME_MAP,
  time_map_caveat: '2025 Series 1 と Series 2 は同じPowerPro 2025値へ突き合わせている。実測で20人が両editionのpairを持ち、うち4人はS1とS2でProspi値が動く（各1点）。"same-time"は年粒度であって版粒度ではない',
  special_cards_excluded: true,
  powerpro_value_source: 'sp041_powerpro_normalized.json の text_raw（年単位に畳んだ素点。58版を跨ぐ版内位置は保持していない）',
  scale_comparison: scaleNote,
  pair_count: pairs.length,
  player_count: new Set(pairs.map(p => p.pid)).size,
  by_year: byYear,
  largest_scale_normalized_divergence: oddZ,
  largest_abs_diffs_raw_scale_confounded: oddRaw,
  pairs,
}, null, 2));
console.log(JSON.stringify({ pair_count: pairs.length, players: new Set(pairs.map(p => p.pid)).size, by_year: byYear }, null, 2));
