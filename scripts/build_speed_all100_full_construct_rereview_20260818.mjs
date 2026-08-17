// Validate and render the manual all-100 full-construct review recommendations.
// This produces recommendations only. It never mutates SP-078 or starts SP-079.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = {
  inventory: 'outputs/derived/speed_all100_full_construct_inventory_20260818.json',
  decisions: 'data/manual/speed_all100_full_construct_review_recommendations_20260818.tsv',
  queue: 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json',
  ledger: 'outputs/derived/sp078_owner_verdict_ledger_20260816.json',
  outJson: 'outputs/derived/speed_all100_full_construct_rereview_20260818.json',
  audit: 'docs/audits/speed_all100_full_construct_rereview_20260818.md',
};
const full = rel => path.join(ROOT, rel);
const read = rel => fs.readFileSync(full(rel), 'utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(`all-100 full-construct rereview fail-closed: ${message}`); };
const req = (condition, message) => { if (!condition) fail(message); };
const atomicWrite = (rel, body) => {
  const target = full(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temp, body, 'utf8');
  fs.renameSync(temp, target);
};
function parseTsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/);
  const header = lines.shift().split('\t');
  return lines.filter(Boolean).map((line, index) => {
    const cells = line.split('\t');
    req(cells.length === header.length, `decision row ${index + 2} has ${cells.length}/${header.length} cells`);
    return Object.fromEntries(header.map((key, i) => [key, cells[i]]));
  });
}
const inventoryBytes = fs.readFileSync(full(P.inventory));
const queueBytes = fs.readFileSync(full(P.queue));
const inventory = JSON.parse(inventoryBytes.toString('utf8'));
const queue = JSON.parse(queueBytes.toString('utf8'));
const ledger = JSON.parse(read(P.ledger));
const decisions = parseTsv(read(P.decisions));

req(inventory?.schema_version === 'speed_all100_full_construct_inventory_20260818', 'inventory schema mismatch');
req(inventory?.source_queue_sha256 === sha256(queueBytes), 'inventory/queue SHA mismatch');
req(queue?.schema_version === 'sp077_construct_complete_owner_review_queue_20260817', 'queue schema mismatch');
req(Array.isArray(inventory.players) && inventory.players.length === 100, 'inventory is not exact 100');
req(Array.isArray(queue.players) && queue.players.length === 100, 'queue is not exact 100');
req(decisions.length === 100, `decision count=${decisions.length}, expected 100`);
req(Array.isArray(ledger.records) && ledger.records.length === 0 && Number(ledger.owner_verdict_count) === 0,
  'SP-078 owner verdict ledger is not empty');
req(ledger?.queue_source?.sha256 === sha256(queueBytes), 'SP-078 is not bound to active queue bytes');
req(queue.players.every(row => row?.owner_verdict?.status === 'NOT_ENTERED' && row?.owner_verdict?.verdict == null),
  'queue contains an owner verdict');

const allowedRecommendations = new Set(['POWERPRO_PLAUSIBLE','POWERPRO_TOO_LOW','POWERPRO_TOO_HIGH_OR_STALE','UNRESOLVED']);
const allowedConfidence = new Set(['LOW','LOW_MEDIUM','MEDIUM','MEDIUM_HIGH','HIGH']);
const inventoryByOrder = new Map(inventory.players.map(row => [Number(row.queue_order), row]));
const seenOrders = new Set();
const seenPlayers = new Set();
const rows = decisions.map((decision, index) => {
  const order = Number(decision.queue_order);
  req(Number.isInteger(order) && order >= 1 && order <= 100, `invalid queue_order at row ${index + 2}`);
  req(!seenOrders.has(order), `duplicate queue_order ${order}`);
  seenOrders.add(order);
  req(!seenPlayers.has(decision.player), `duplicate player ${decision.player}`);
  seenPlayers.add(decision.player);
  req(allowedRecommendations.has(decision.recommendation), `${decision.player}: invalid recommendation ${decision.recommendation}`);
  req(allowedConfidence.has(decision.confidence), `${decision.player}: invalid confidence ${decision.confidence}`);
  req(String(decision.reason_code || '').trim(), `${decision.player}: missing reason_code`);
  req(String(decision.rationale_ja || '').trim(), `${decision.player}: missing rationale_ja`);
  const evidence = inventoryByOrder.get(order);
  req(evidence, `${decision.player}: inventory row ${order} missing`);
  req(evidence.player === decision.player, `row ${order}: player mismatch decision=${decision.player}, inventory=${evidence.player}`);
  const pp = evidence.powerpro_review?.raw_last ?? null;
  if (decision.reason_code === 'NO_CURRENT_POWERPRO_TARGET') req(pp == null, `${decision.player}: NO_CURRENT_POWERPRO_TARGET but PP=${pp}`);
  if (decision.recommendation !== 'UNRESOLVED') req(pp != null, `${decision.player}: directional/plausible recommendation without PP target`);
  if (evidence.reviewability?.class === 'CURRENT_PEAK_ONLY_DIRECT_PHYSICAL') {
    req(decision.recommendation === 'UNRESOLVED', `${decision.player}: peak-only evidence cannot receive ${decision.recommendation}`);
  }
  const h2f = evidence.acceleration_h2f_t90?.normal_swing_h2f;
  const bunt = evidence.acceleration_h2f_t90?.bunt_h2f;
  const t90Count = evidence.acceleration_h2f_t90?.direct_or_standardized_t90_records?.length ?? 0;
  const shortCount = evidence.short_distance?.records?.length ?? 0;
  const physicalLanes = [
    'CURRENT_PEAK',
    h2f ? 'H2F_NORMAL' : null,
    bunt ? 'H2F_BUNT' : null,
    t90Count ? `T10_T30_T90_RECORDS:${t90Count}` : null,
    shortCount ? `SHORT_DISTANCE_RECORDS:${shortCount}` : null,
  ].filter(Boolean);
  return {
    queue_order: order,
    queue_row_key: evidence.queue_row_key,
    player: decision.player,
    team: evidence.team,
    powerpro_current: pp,
    physical_lanes: physicalLanes,
    reviewability_class: evidence.reviewability?.class ?? null,
    top_speed_kmh: evidence.top_speed?.kmh ?? null,
    top_speed_rank_current100: evidence.top_speed?.rank_current100 ?? null,
    h2f_normal_seconds: h2f?.seconds ?? null,
    h2f_normal_z: h2f?.z ?? null,
    direct_t90_record_count: t90Count,
    short_distance_record_count: shortCount,
    statistical_proxy_z_context_only: evidence.statistical_proxy?.value_z ?? null,
    game_proxy_context_only: evidence.game_context_proxy?.legacy_composite_score_context_only ?? null,
    community_physical_row_count: evidence.community?.physical?.length ?? 0,
    community_technique_row_count: evidence.community?.technique?.length ?? 0,
    recommendation: decision.recommendation,
    confidence: decision.confidence,
    reason_code: decision.reason_code,
    rationale_ja: decision.rationale_ja,
  };
}).sort((a,b) => a.queue_order - b.queue_order);
req(rows.length === 100 && rows.every((row, index) => row.queue_order === index + 1), 'orders are not exact 1..100');

const counts = Object.fromEntries([...allowedRecommendations].map(key => [key, rows.filter(row => row.recommendation === key).length]));
req(counts.POWERPRO_PLAUSIBLE === 31, `plausible count=${counts.POWERPRO_PLAUSIBLE}`);
req(counts.POWERPRO_TOO_LOW === 1, `too-low count=${counts.POWERPRO_TOO_LOW}`);
req(counts.POWERPRO_TOO_HIGH_OR_STALE === 1, `too-high/stale count=${counts.POWERPRO_TOO_HIGH_OR_STALE}`);
req(counts.UNRESOLVED === 67, `unresolved count=${counts.UNRESOLVED}`);
const strong = rows.filter(row => row.recommendation === 'POWERPRO_TOO_LOW' || row.recommendation === 'POWERPRO_TOO_HIGH_OR_STALE');
req(strong.length === 2 && strong.some(row => row.player === '山口 航輝') && strong.some(row => row.player === '塩見 泰隆'),
  'strong directional findings must remain 山口/塩見 only');

const output = {
  schema_version: 'speed_all100_full_construct_rereview_20260818',
  generated_at: '2026-08-18',
  status: 'CORRECTED_NON_VERDICT_RECOMMENDATIONS',
  source_inventory: P.inventory,
  source_inventory_sha256: sha256(inventoryBytes),
  source_queue: P.queue,
  source_queue_sha256: sha256(queueBytes),
  source_decisions: P.decisions,
  source_decisions_sha256: sha256(Buffer.from(read(P.decisions))),
  owner_verdict_ledger: P.ledger,
  owner_verdict_count: 0,
  construct_definition: 'physical running ability from first running step to about 90ft: initial acceleration + peak speed + speed maintenance/end-to-end performance',
  decision_rules: [
    'Current NPB+ peak speed alone cannot support a strong high/low verdict or a plausible whole-construct verdict.',
    'Strong high/low recommendations require at least two independent physical dimensions with compatible temporal relevance, or a current/recent end-to-end lane plus independent corroboration.',
    'S, game outcomes and Community are context only and cannot replace acceleration/H2F/T90/30m/50m.',
    'Stealing and baserunning technique remain separate from pure physical speed.',
    'Historical physical evidence is not automatically carried to 2026.',
    'Missingness is not negative evidence.',
    'POWERPRO_PLAUSIBLE means no material contradiction in available full-construct evidence, not exact calibration.',
  ],
  population: { expected: 100, emitted: rows.length, unique_queue_orders: seenOrders.size, unique_players: seenPlayers.size },
  recommendation_counts: counts,
  recommendations: rows,
};
atomicWrite(P.outJson, JSON.stringify(output, null, 2) + '\n');

const verdictJa = {
  POWERPRO_PLAUSIBLE: '大きな矛盾なし',
  POWERPRO_TOO_LOW: 'PowerProが低すぎる可能性',
  POWERPRO_TOO_HIGH_OR_STALE: 'PowerProが高すぎる・古い可能性',
  UNRESOLVED: '未確定',
};
const plausibleNames = rows.filter(r => r.recommendation === 'POWERPRO_PLAUSIBLE').map(r => r.player);
const unresolvedByCode = {};
for (const row of rows.filter(r => r.recommendation === 'UNRESOLVED')) {
  unresolvedByCode[row.reason_code] = (unresolvedByCode[row.reason_code] ?? 0) + 1;
}
const table = rows.map(row => `| ${row.queue_order} | ${row.player} | ${row.powerpro_current ?? '—'} | ${row.physical_lanes.join(' + ')} | ${verdictJa[row.recommendation]} | ${row.confidence} | ${row.rationale_ja} |`);
const audit = [
  '# 走力100人・走力定義準拠の全件再レビュー — 2026-08-18',
  '',
  'Status: **CORRECTED NON-VERDICT RECOMMENDATIONS**',
  '',
  '> これはAI側のレビュー推奨であり、SP-078の正式owner verdictではない。SP-079も開始しない。',
  '',
  '## 結論',
  '',
  `- 対象: **100/100人**`,
  `- PowerProと大きな矛盾なし: **${counts.POWERPRO_PLAUSIBLE}人**`,
  `- PowerProが低すぎる可能性: **${counts.POWERPRO_TOO_LOW}人（山口航輝）**`,
  `- PowerProが高すぎる・古い可能性: **${counts.POWERPRO_TOO_HIGH_OR_STALE}人（塩見泰隆）**`,
  `- 未確定: **${counts.UNRESOLVED}人**`,
  '',
  '未確定が多いのは失敗ではなく、最高速度だけで総合走力を断定しないという走力定義を100人へ同じように適用した結果である。',
  '',
  '## 今回の走力定義',
  '',
  '走力は、**最初の一歩から約90ftまでの身体的な走力**として評価する。',
  '',
  '1. 初期加速',
  '2. 最高速度',
  '3. 約90ftまで速度を維持して走り切る性能',
  '',
  '- NPB+最高速度は2だけを測る1レーン。',
  '- H2F・T10・T30・T90・30m・50mは別レーンとして扱い、相互に無効な換算をしない。',
  '- S・試合指標・Communityは補助文脈で、身体レーンの代わりにしない。',
  '- 盗塁・走塁技術を純粋な足の速さへ混ぜない。',
  '- 古い記録を2026年へ自動持ち越ししない。',
  '- 欠損を遅さの証拠にしない。',
  '',
  '## 強い方向判定が残った2人',
  '',
  ...strong.flatMap(row => [
    `### ${row.player} — ${verdictJa[row.recommendation]}`,
    '',
    row.rationale_ja,
    '',
  ]),
  '## PowerProと大きな矛盾がなかった31人',
  '',
  plausibleNames.join(' / '),
  '',
  'ここでの「大きな矛盾なし」は、その数値が正確に較正済みという意味ではない。利用できる複数の身体レーンが、PowerPro値を明確には否定しないという意味だけである。',
  '',
  '## 未確定67人の主な理由',
  '',
  ...Object.entries(unresolvedByCode).sort((a,b) => b[1]-a[1]).map(([code,count]) => `- ${code}: ${count}人`),
  '',
  '## 100人個別表',
  '',
  '| # | 選手 | PP | 直接物理レーン | 判定 | 確信度 | 理由 |',
  '|---:|---|---:|---|---|---|---|',
  ...table,
  '',
  '## Governance',
  '',
  `- Source queue: \`${P.queue}\``,
  `- Queue SHA-256: \`${output.source_queue_sha256}\``,
  `- Evidence inventory: \`${P.inventory}\``,
  `- Manual recommendation ledger: \`${P.decisions}\``,
  '- SP-078 owner_verdict_count: 0',
  '- SP-079: NOT_STARTED',
  '- Shoulder: out of scope',
  '- この監査結果をowner verdictへ自動コピーしてはならない。',
  '',
].join('\n');
atomicWrite(P.audit, audit);
console.log(JSON.stringify({
  status: 'PASS',
  players: rows.length,
  recommendation_counts: counts,
  strong_directional_players: strong.map(row => row.player),
  owner_verdict_count: 0,
  outputs: [P.outJson, P.audit],
}, null, 2));
