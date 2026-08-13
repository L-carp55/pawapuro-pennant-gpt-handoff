// SP-017 — protocol/date不明の身体測定をnumeric evidenceからの完全除外ではなく
// range+confidence+protocol/temporal flag付きのhistorical/profile evidenceへ復元する（EX-001/EX-002是正）。
//
// 何を直すか:
//   data/normalized/speed_historical_physical_measurements_2015_2026.json の459件中57件が
//   bank_acceptance_status=REJECTED_PROTOCOL* / REJECTED_PROTOCOL_OR_DATE_NOT_PUBLICLY_DOCUMENTED
//   としてnumeric evidenceから完全除外されていた。値自体は実在し測定日/計測方式の"完全性"だけが
//   欠けている——EX-001/EX-002の是正方針は「この変換は無効」と「元データ自体が無価値」を分離し、
//   30m/50mへの比例T90変換はしないまま実測自体をrange+confidenceで保持すること。
//
// このスクリプトは元ファイルを上書きしない（raw dataは上書きせずのCLAUDE.md原則）。
// 新しい派生overlayを outputs/derived/ へ書き出す。
//
// 使い方: node scripts/sp017_physical_measurement_range_reclassification.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'data', 'normalized', 'speed_historical_physical_measurements_2015_2026.json');
const src = JSON.parse(readFileSync(SRC, 'utf8'));

// EX-001/EX-002が指す「protocol/date不明」に対応するrejection_reason。
// EX-025(unverified source tier)・EX-003系(context mixing)は対象外——それぞれ別の是正(据え置き/SP-007)。
const TARGET_REASONS = new Set([
  'REJECTED_PROTOCOL_OR_DATE_NOT_PUBLICLY_DOCUMENTED',
  'REJECTED_PROTOCOL_MANUAL_START_NOT_COMPARABLE',
  'REJECTED_PROTOCOL_NOT_FULLY_PUBLICLY_DOCUMENTED',
]);

function confidenceTier(r) {
  const protocolKnown = r.timing_method && r.timing_method !== 'unknown' && r.start_protocol && r.start_protocol !== 'not_publicly_documented';
  const dateKnown = !!r.measurement_date;
  if (protocolKnown && dateKnown) return 'medium';   // ここには来ないはずだが保険
  if (protocolKnown || dateKnown) return 'low_medium';
  return 'low';
}

const reclassified = [];
for (const r of src.records) {
  if (!TARGET_REASONS.has(r.rejection_reason)) continue;
  reclassified.push({
    raw_id: r.raw_id,
    player: r.player,
    metric: r.metric,
    value: r.value,
    unit: r.unit,
    measurement_date: r.measurement_date,
    measurement_year: r.measurement_year,
    timing_method: r.timing_method,
    start_protocol: r.start_protocol,
    source_tier: r.source_tier,
    source_url: r.source_url,
    same_measurement_cluster_id: r.same_measurement_cluster_id,
    old_bank_acceptance_status: r.bank_acceptance_status,
    old_rejection_reason: r.rejection_reason,
    corrected_usage_class: 'HISTORICAL_PROFILE_RANGE_EVIDENCE',
    confidence: confidenceTier(r),
    protocol_flag: (r.timing_method && r.timing_method !== 'unknown') ? r.timing_method : 'PROTOCOL_UNKNOWN',
    temporal_flag: r.measurement_date ? 'DATE_KNOWN' : 'DATE_UNKNOWN',
    numeric_t90_usable: false,   // 比例変換は引き続き禁止（EX-020）。current-season direct T90入力にはしない
    usage_note: '30m/50mからT90への距離比例変換はしない(EX-020)。current-year direct acceleration評価には使わず、historical/profile physical evidenceとしてrange+confidence付きで保持する',
  });
}

const out = {
  generated_at: '2026-08-13',
  policy: 'EX-001/EX-002是正。data/normalized/speed_historical_physical_measurements_2015_2026.jsonを上書きしない非破壊overlay',
  source_file: 'data/normalized/speed_historical_physical_measurements_2015_2026.json',
  source_total_records: src.records.length,
  reclassified_count: reclassified.length,
  confidence_distribution: reclassified.reduce((a, r) => { a[r.confidence] = (a[r.confidence] || 0) + 1; return a; }, {}),
  temporal_flag_distribution: reclassified.reduce((a, r) => { a[r.temporal_flag] = (a[r.temporal_flag] || 0) + 1; return a; }, {}),
  records: reclassified,
};
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'sp017_physical_measurement_range_reclassification.json'), JSON.stringify(out, null, 2));

console.log(`reclassified: ${reclassified.length} / ${src.records.length} records`);
console.log('confidence:', JSON.stringify(out.confidence_distribution));
console.log('temporal_flag:', JSON.stringify(out.temporal_flag_distribution));
console.log('saved: outputs/derived/sp017_physical_measurement_range_reclassification.json');
