import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const t = readFileSync('outputs/derived/speed_2026_100_owner_review_master_20260813.csv', 'utf8');
const lines = t.split(/\r?\n/).filter(Boolean);
const head = lines[0].split(',');
const idx = n => head.indexOf(n);
const pi = idx('player'), idi = idx('player_id'), ti = idx('team'), sti = idx('powerpro_stale_suspected');
function parse(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') { q = !q; continue; }
    if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const rows = lines.slice(1).map(parse).filter(c => c[pi]);
const CL = ['読売', '巨人', '阪神', '中日', 'ヤクルト', '広島', '横浜', 'DeNA', 'ベイスターズ', 'カープ', 'タイガース', 'スワローズ', 'ジャイアンツ', 'ドラゴンズ'];
const players = rows.map(c => ({ player: c[pi], player_id: c[idi], team: c[ti], stale: c[sti] }));
const central = players.filter(p => CL.some(k => p.team.includes(k)));
const pacific = players.filter(p => !CL.some(k => p.team.includes(k)));
const stale = players.filter(p => String(p.stale).toLowerCase() === 'true');
mkdirSync('outputs/derived/_scratch_x_v3', { recursive: true });
writeFileSync('outputs/derived/_scratch_x_v3/current_100_players.json', JSON.stringify({
  n: players.length, central: central.length, pacific: pacific.length, stale_n: stale.length,
  players, central_players: central, pacific_players: pacific, stale_players: stale,
}, null, 2));
console.log(JSON.stringify({
  n: players.length, central: central.length, pacific: pacific.length, stale: stale.length,
  teams: [...new Set(players.map(p => p.team))],
  central_names: central.map(p => p.player),
  pacific_names: pacific.map(p => p.player),
  stale_names: stale.map(p => p.player),
}, null, 2));
