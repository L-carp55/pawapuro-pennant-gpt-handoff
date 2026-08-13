// SP-007 — H2F（home-to-first）を低信頼度の別レーンとして復元する（EX-003/EX-015是正）。
//
// 何を直すか:
//   旧実装: 一塁到達タイムは「打撃→走行移行・打席左右等が混ざる」ことを理由に
//   usage_class=CONTEXT_ONLY・numeric_t90_usable=falseとして、走力点への経路を持たなかった
//   （strict direct-current accelerationのalpha=0はそれ自体は正しいnegative finding=EX-015）。
//
// 是正方針（EX-003 corrected_policy）:
//   「単独で走力点を決めないが、L/R・bunt/normal・effort・sample等を分離し
//    low-to-medium acceleration evidenceとして使う」
//   strict T90パイプライン（速度成分speedComponents）は変更しない。
//   別の低信頼度レーンとして新設し、EX-015のnegative findingを上書きしない。
//
// 使い方: node scripts/sp007_h2f_low_confidence_lane.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const nrm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const evidence = JSON.parse(readFileSync(
  path.join(ROOT, 'data', 'manual', 'npb_speed_physical_evidence_full_20260809.json'), 'utf8'));

// ── 1. 生レコードを抽出し bunt/normal を分ける ─────────────────────────
const raw = [];
for (const p of evidence.players) {
  for (const r of (p.records ?? [])) {
    if (r.metric !== 'hp_to_1b') continue;
    const isBunt = /bunt|バント/i.test(`${r.reason ?? ''}`);
    raw.push({ player: p.player, seconds: r.seconds, isBunt,
      sourceTier: r.source_tier, confidence: r.confidence, year: r.measurement_year,
      clusterId: r.same_measurement_cluster_id ?? null,
      reason: r.reason, sourceUrl: r.source_url });
  }
}

// ── 2. 選手×クラスタで重複を畳む（同一測定の転載を独立票にしない、EX-022） ──────
const byPlayerBunt = new Map(); // key = player|isBunt
for (const r of raw) {
  const key = `${r.player}|${r.isBunt}`;
  if (!byPlayerBunt.has(key)) byPlayerBunt.set(key, []);
  byPlayerBunt.get(key).push(r);
}
function dedupe(records) {
  const byCluster = new Map();
  for (const r of records) {
    const k = r.clusterId ?? `${r.player}|${r.seconds}|${r.sourceUrl}`;
    if (!byCluster.has(k)) byCluster.set(k, []);
    byCluster.get(k).push(r);
  }
  const out = [];
  for (const group of byCluster.values()) {
    const seconds = group.map(g => g.seconds).sort((a, b) => a - b);
    const median = seconds[Math.floor(seconds.length / 2)];
    out.push({ ...group[0], seconds: median, origin_count: group.length });
  }
  return out;
}
const perPlayer = [];
for (const [key, records] of byPlayerBunt) {
  const [player, isBuntStr] = key.split('|');
  const deduped = dedupe(records);
  const secondsArr = deduped.map(d => d.seconds);
  const pooledSeconds = secondsArr.reduce((s, v) => s + v, 0) / secondsArr.length;
  perPlayer.push({ player, isBunt: isBuntStr === 'true', seconds: pooledSeconds,
    n_independent_records: deduped.length,
    n_raw_records: records.length,
    sources: deduped.map(d => d.sourceUrl) });
}

// ── 3. 打者左右をDBから結合（既存の join pattern を再利用） ────────────────
const batsStmt = db.prepare(`
  SELECT DISTINCT t.bats FROM nf3_team_link tl
  JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
  JOIN player_link l ON l.proeye_id=tl.proeye_id
  WHERE tl.name_norm=? ORDER BY t.season DESC LIMIT 1`);
for (const row of perPlayer) {
  try {
    const r = batsStmt.get(nrm(row.player));
    row.bats = r?.bats ?? 'unknown';
  } catch { row.bats = 'unknown'; }
}

// ── 4. bunt/normalを分けて標準化z（サンプル内標準化。strict T90 priorとは別軸） ──
function standardize(rows) {
  if (rows.length < 5) return { mean: null, sd: null, note: 'サンプル不足(n<5)のため標準化しない' };
  const secs = rows.map(r => r.seconds);
  const mean = secs.reduce((a, b) => a + b, 0) / secs.length;
  const sd = Math.sqrt(secs.reduce((a, b) => a + (b - mean) ** 2, 0) / secs.length);
  return { mean, sd };
}
const normalRows = perPlayer.filter(r => !r.isBunt);
const buntRows = perPlayer.filter(r => r.isBunt);
const normalStd = standardize(normalRows);
const buntStd = standardize(buntRows);

for (const r of normalRows) {
  r.z = normalStd.sd ? -(r.seconds - normalStd.mean) / normalStd.sd : null; // 速いほど+
  r.lane = 'H2F_NORMAL_SWING_LOW_CONFIDENCE';
}
for (const r of buntRows) {
  r.z = buntStd.sd ? -(r.seconds - buntStd.mean) / buntStd.sd : null;
  r.lane = 'H2F_BUNT_LOW_CONFIDENCE';
  r.note = 'セーフティ/プッシュバントはスタートが速く通常スイングと同一分布で比較できない。別レーンのまま保持し、normal-swing z-scoreへ混ぜない';
}

const out = {
  generated_at: '2026-08-13',
  policy: 'EX-003/EX-015是正。strict T90 pipeline（speedComponents）は無変更。走力点には配線しない、低信頼度の別レーン',
  scope: 'docs/audits/speed_2026_reopen_comprehensive_gap_audit_20260811.md 起点、data/manual/npb_speed_physical_evidence_full_20260809.json のhp_to_1b records(n=31, 15選手が重複)',
  strict_negative_finding_preserved: 'EX-015: strict direct-current acceleration prior は ready_players=0 のまま。本レーンはこれを上書きしない',
  normal_swing: { standardization: normalStd, n_players: normalRows.length, players: normalRows },
  bunt: { standardization: buntStd, n_players: buntRows.length, players: buntRows,
    _reason: 'セーフティ/プッシュバントは通常スイングより有意に速い。normal-swingへ混ぜず別集計' },
  usage_note: 'low-to-medium confidence。単独で走力点を決めない。owner review / practical_powerpro_style_speed統合(EX-004 §5B)で他の同時点証拠と併記する材料として使う',
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp007_h2f_low_confidence_lane.json'), JSON.stringify(out, null, 2));

console.log(`normal-swing: n=${normalRows.length}人, mean=${normalStd.mean?.toFixed(3)}s sd=${normalStd.sd?.toFixed(3)}s`);
console.log(`bunt: n=${buntRows.length}人, mean=${buntStd.mean?.toFixed(3)}s sd=${buntStd.sd?.toFixed(3)}s`);
console.log('bats join:', JSON.stringify(perPlayer.reduce((a, r) => { a[r.bats] = (a[r.bats] || 0) + 1; return a; }, {})));
console.log('saved: outputs/derived/sp007_h2f_low_confidence_lane.json');
