// SP-033/034 — 姓候補を video title / 一意姓 / 文脈で安全に解決する。
// 自動採用できないものは review lane。皮肉・反語は採用しない。
// same-video を全部1 originにせず、player+claim で event を分ける。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLASSIFIED = path.join(ROOT, 'outputs', 'derived', 'sp033_034_youtube_comment_classification_20260813.jsonl');
const MASTER = path.join(ROOT, 'outputs', 'derived', 'speed_2026_100_owner_review_master_20260813.csv');
const PROSPI_STAGING = path.join(ROOT, 'outputs', 'derived', '_staging_speed_youtube_prospi_run2.jsonl');
const COMBINED_INV = path.join(ROOT, 'outputs', 'derived', 'speed_youtube_official_video_inventory_20260813_run2.csv');
const OUT = path.join(ROOT, 'outputs', 'derived', 'sp033_034_surname_identity_resolution_20260814.json');
const OUT_JSONL = path.join(ROOT, 'outputs', 'derived', 'sp033_034_youtube_events_by_player_claim_20260814.jsonl');

const nk = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
function loadJsonl(p) {
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}
function parseCsv(p) {
  const raw = readFileSync(p, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const head = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.replace(/^"|"$/g, ''));
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

const master = parseCsv(MASTER);
const players = master.map(r => ({
  player: r.player, player_id: r.player_id,
  surname: String(r.player ?? '').normalize('NFKC').split(/[\s　]/)[0],
  key: nk(r.player),
})).filter(p => p.surname.length >= 2);

const bySur = new Map();
for (const p of players) {
  if (!bySur.has(p.surname)) bySur.set(p.surname, []);
  bySur.get(p.surname).push(p);
}
const uniqueSur = new Map([...bySur.entries()].filter(([, list]) => list.length === 1).map(([s, list]) => [s, list[0]]));

const titles = new Map();
for (const r of loadJsonl(PROSPI_STAGING)) {
  if (r.video_id && r.title) titles.set(r.video_id, r.title);
}
if (existsSync(COMBINED_INV)) {
  for (const r of parseCsv(COMBINED_INV)) {
    if (r.video_id && r.title) titles.set(r.video_id, r.title);
  }
}

const IRONY = /(皮肉|逆に|むしろ遅|遅いくせ|遅いのに|足遅くね|走力低|鈍足なのに|速いわけない)/;
const comments = loadJsonl(CLASSIFIED);
const resolved = [];
const review = [];
const events = [];

for (const c of comments) {
  const title = titles.get(c.video_id) || '';
  const text = String(c.text ?? '');
  const compact = nk(text + ' ' + title);
  const claim = (c.labels || []).find(l => l !== 'UNCLASSIFIED_CONTEXT' && l !== 'JOKE_OR_NOISE') || 'UNCLASSIFIED_CONTEXT';
  const irony = IRONY.test(text);

  let decision = 'UNMAPPED';
  let player = c.player;
  let pid = c.canonical_player_id;
  let reason = 'no identity';

  if (c.identity === 'UNIQUE' && player) {
    decision = irony ? 'REVIEW_IRONY' : 'ACCEPTED_FULL_NAME';
    reason = irony ? 'フルネーム一致だが皮肉/反語の可能性がある' : 'フルネーム完全一致';
  } else if (c.surname_candidate_player) {
    const sur = uniqueSur.get(String(c.surname_candidate_player).normalize('NFKC').split(/[\s　]/)[0]);
    const titleHit = sur && nk(title).includes(sur.surname);
    const titleOther = [...uniqueSur.values()].filter(p => p.player !== c.surname_candidate_player && nk(title).includes(p.surname));
    if (irony) {
      decision = 'REVIEW_IRONY';
      player = c.surname_candidate_player;
      pid = c.surname_candidate_player_id;
      reason = '姓は一意だが皮肉/反語の可能性';
    } else if (titleHit && titleOther.length === 0 && claim !== 'UNCLASSIFIED_CONTEXT') {
      decision = 'ACCEPTED_SURNAME_PLUS_TITLE';
      player = c.surname_candidate_player;
      pid = c.surname_candidate_player_id;
      reason = 'ロースター内で姓が一意、かつ動画タイトルが同じ姓を指す';
    } else {
      decision = 'REVIEW_SURNAME_CANDIDATE';
      player = c.surname_candidate_player;
      pid = c.surname_candidate_player_id;
      reason = titleHit
        ? 'タイトル一致だが方向ラベルが弱い、または他選手もタイトルにいる'
        : '姓のみ。タイトル文脈なし。自動採用しない';
    }
  }

  const eventId = player
    ? `youtube:${c.video_id}:${pid || nk(player)}:${claim}`
    : `youtube:${c.video_id}:unmapped:${claim}`;

  const rec = {
    record_id: c.record_id,
    video_id: c.video_id,
    video_title: title || null,
    text,
    labels: c.labels,
    claim,
    identity_before: c.identity,
    decision,
    player,
    canonical_player_id: pid,
    reason,
    irony_flag: irony,
    event_id: eventId,
    origin_count: 0,
    reaction_volume: 1,
    auto_accepted: decision.startsWith('ACCEPTED'),
  };
  if (rec.auto_accepted) resolved.push(rec);
  else if (decision.startsWith('REVIEW')) review.push(rec);
  events.push(rec);
}

const byEvent = new Map();
for (const e of events) {
  if (!byEvent.has(e.event_id)) byEvent.set(e.event_id, []);
  byEvent.get(e.event_id).push(e);
}
for (const [, grp] of byEvent) {
  const acc = grp.filter(g => g.auto_accepted);
  if (acc.length) acc[0].origin_count = 1;
  for (const g of grp) g.reaction_volume = grp.length;
}

writeFileSync(OUT_JSONL, events.map(e => JSON.stringify(e)).join('\n') + '\n');
const qa = {
  generated_at: '2026-08-14',
  comments: comments.length,
  surname_candidates_in: comments.filter(c => c.identity === 'SURNAME_CANDIDATE_UNAMBIGUOUS_IN_ROSTER').length,
  auto_accepted: resolved.length,
  accepted_by: resolved.reduce((a, r) => { a[r.decision] = (a[r.decision] ?? 0) + 1; return a; }, {}),
  review_lane: review.length,
  review_by: review.reduce((a, r) => { a[r.decision] = (a[r.decision] ?? 0) + 1; return a; }, {}),
  distinct_player_claim_events: byEvent.size,
  videos: new Set(events.map(e => e.video_id)).size,
  note: 'Same video can have multiple origins when different players or claims appear. Reaction volume stays on the player-claim event.',
  negative_finding: false,
};
writeFileSync(OUT, JSON.stringify({ qa, resolved: resolved.slice(0, 50), review: review.slice(0, 80) }, null, 2));
console.log(JSON.stringify(qa, null, 2));
