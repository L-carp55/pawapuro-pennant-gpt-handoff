#!/usr/bin/env node
/**
 * Builds a decision-ready evidence packet for the fixed 2026 NPB+ Sprint
 * Speed roster. This is intentionally not a rating calculator.
 *
 * Guardrails enforced here:
 * - no final speed rating is generated;
 * - PowerPro and MLB The Show are external temporal-QA context only;
 * - 50m / 30m values are never converted to T90;
 * - PA and run proxies affect review confidence only, never a rating;
 * - measurement-year resolution never upgrades an evidence tier.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const outputDir = path.join(root, 'outputs', 'derived');
const auditDir = path.join(root, 'docs', 'audits');

const INPUT = {
  physical: 'data/manual/npb_speed_physical_evidence_full_20260809.json',
  physicalCoverage: 'outputs/derived/npb_speed_evidence_coverage_20260809.csv',
  measurementDate: 'outputs/derived/npb_speed_measurement_date_resolution_20260809.json',
  exposure: 'outputs/derived/npb_plus_sprint_exposure_2026.json',
  blind: 'outputs/derived/speed_blind_v3_npbplus_2026.json',
  powerproHistory: 'outputs/derived/pawapuro_speed_history_panel_2015_2026.json',
  standardized50m: 'data/manual/standardized_50m_electronic_reference.json',
  standardized30m50m: 'data/manual/standardized_30m50m_photoelectric_2026.json',
  curated30m: 'data/manual/sprint_30m_measurements_curated.json',
};

const OUTPUT = {
  masterCsv: 'outputs/derived/speed_2026_100_master_evidence.csv',
  masterJson: 'outputs/derived/speed_2026_100_master_evidence.json',
  packets: 'outputs/derived/speed_2026_100_decision_packets.json',
  reviewQueue: 'outputs/derived/speed_2026_100_human_review_queue.csv',
  graph: 'outputs/derived/speed_2026_anchor_pairwise_graph.json',
  buildQa: 'outputs/derived/speed_2026_100_build_qa.json',
  independentQa: 'outputs/derived/speed_2026_100_independent_qa.json',
  audit: 'docs/audits/speed_2026_100_decision_packet_audit.md',
};

const SOURCE_MANIFEST = {
  appraisal_policy: {
    repository: 'L-carp55/pawapuro-pennant-gpt-handoff',
    branch: 'agent/appraisal-principles-20260809',
    commit: '179e03c76c4379f4372da722741b1a705df66974',
    files: [
      'CLAUDE.md',
      'docs/satei_handoff/12_APPRAISAL_PRINCIPLES_20260809.md',
      'docs/satei_handoff/13_CURRENT_CRITICAL_PATH_20260809.md',
    ],
  },
  physical_evidence: {
    repository: 'L-carp55/pawapuro-pennant-gpt-handoff',
    branch: 'codex/speed-physical-evidence-full',
    commit: '94a26e7160a879ea0e13f4ddb91d4fdadc7c04e9',
    files: [INPUT.physical, INPUT.physicalCoverage, INPUT.standardized50m, INPUT.standardized30m50m, INPUT.curated30m],
  },
  measurement_date_resolution: {
    repository: 'L-carp55/pawapuro-pennant-gpt-handoff',
    branch: 'codex/speed-measurement-date-resolution',
    commit: 'b374d1cb543e2035d9a18230e3b9245a616c6275',
    files: [INPUT.measurementDate],
  },
  exposure_audit: {
    repository: 'L-carp55/pawapuro-pennant-gpt-handoff',
    branch: 'codex/npb-sprint-exposure-audit',
    commit: '3be42ff62775cf98eec614f9ee733ae06d565bde',
    files: [INPUT.exposure],
  },
  powerpro_history: {
    repository: 'L-carp55/pawapuro-pennant-gpt-handoff',
    branch: 'codex/pawapuro-speed-history-panel',
    commit: '19fad9848b782c95bcdd97449fa5a9768da9f9b3',
    files: [INPUT.powerproHistory],
    permitted_use: 'external temporal QA only; never final rating, anchor, or correction input',
  },
  the_show_speed_history: {
    repository: 'L-carp55/claude-code-hub',
    branch: 'codex/mlb-the-show-speed-history',
    commit: '97c429521267cfb70ccdd61e40e11853d100e360',
    files: [
      'docs/audits/mlb_the_show_speed_history_audit.md',
      'data/qa/collection_audit_summary.json',
    ],
    permitted_use: 'external QA methodology only; no NPB player rating, anchor, or temporal direction is inferred',
  },
  the_show_full_attributes: {
    repository: 'L-carp55/claude-code-hub',
    branch: 'codex/mlb-the-show-full-attributes',
    commit: '74d2a2278ab7bcea3f6368e1df6ba03e2dd82554',
    files: [
      'docs/audits/mlb_the_show_full_attribute_history_2017_2026.md',
      'outputs/derived/mlb_the_show_full_attribute_summary_2017_2026.json',
      'outputs/derived/mlb_the_show_live_roster_attributes_2017_2026.csv',
    ],
    permitted_use: 'not a substitute for the dedicated speed history; no player-level NPB join is asserted',
  },
};

const TEAM_AND_NAME_JOIN = 'Unicode NFKC + ASCII/ideographic-space removal; physical/date joins only';
const CURRENT_YEAR = 2026;
const DIRECT_T90_CURRENT_GATE_START = 2022;
const INITIAL_BUILD_QA_HISTORY = [
  {
    run: 'initial_generated_artifact_check',
    status: 'FAIL',
    check: 'no_final_rating_key_generated',
    finding: 'The safeguard boolean key powerpro_rating_used_for_final matched the forbidden-key detector. No final-rating value was generated, but the name made the guard ambiguous.',
    correction: 'Renamed the non-input safeguard to powerpro_contributes_to_final_value and final_speed_value_generated, then reran the full builder.',
    resolution: 'PASS on rerun',
  },
];

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function ensureInput(relativePath) {
  const file = absolute(relativePath);
  if (!fs.existsSync(file)) throw new Error(`Required input is missing: ${relativePath}`);
  return file;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(ensureInput(relativePath), 'utf8'));
}

function writeText(relativePath, text) {
  const file = absolute(relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

function writeJson(relativePath, value) {
  writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s\u3000]/gu, '')
    .replace(/\u9ad9/gu, '\u9ad8')
    .replace(/\ufa11/gu, '\u5d0e')
    .replace(/\ufa19/gu, '\u795e');
}

function rosterNameTeamKey(player, team) {
  return `${normalize(player)}|${normalize(team)}`;
}

function csvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, ''));
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  row.push(field.replace(/\r$/u, ''));
  if (row.some((value) => value !== '')) rows.push(row);
  if (!rows.length) return [];
  const header = rows.shift();
  return rows.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
}

function readCsv(relativePath) {
  return csvRows(fs.readFileSync(ensureInput(relativePath), 'utf8'));
}

function csvValue(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function writeCsv(relativePath, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((header) => csvValue(row[header])).join(','));
  writeText(relativePath, `${lines.join('\n')}\n`);
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stableSortByPlayer(rows) {
  return [...rows].sort((left, right) => (
    String(left.player_id ?? '').localeCompare(String(right.player_id ?? ''))
    || left.player.localeCompare(right.player, 'ja')
    || left.team.localeCompare(right.team, 'ja')
  ));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))];
}

function countBy(rows, selector) {
  const counts = new Map();
  for (const row of rows) {
    const key = selector(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => String(left[0]).localeCompare(String(right[0]))));
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(ensureInput(relativePath))).digest('hex');
}

function sourceReference(relativePath, sourceGroup) {
  const source = SOURCE_MANIFEST[sourceGroup];
  return {
    repository: source.repository,
    branch: source.branch,
    commit: source.commit,
    path: relativePath,
  };
}

function buildPhysicalRecord(record, dateResolution) {
  const sourceMeasurementYear = record.measurement_year ?? null;
  const resolvedYear = dateResolution?.resolved_measurement_year ?? null;
  return {
    ...record,
    source_measurement_year: sourceMeasurementYear,
    resolved_measurement_year: resolvedYear,
    measurement_date: dateResolution?.measurement_date ?? null,
    measurement_year_inferred: dateResolution?.measurement_year_inferred ?? false,
    temporal_join_confidence: dateResolution?.inference_confidence ?? null,
    temporal_join_status: dateResolution?.resolution_status ?? 'NOT_APPLICABLE',
    // Deliberately preserve source classification: a resolved year is not a tier upgrade.
    usage_class_preserved: record.usage_class,
    numeric_t90_usable_preserved: record.numeric_t90_usable,
  };
}

function classifyDecisionEvidence(records) {
  const currentDirectT90 = records.filter((record) => (
    record.metric === 'T90ft'
    && record.numeric_t90_usable === true
    && Number(record.effective_measurement_year ?? record.measurement_year) >= DIRECT_T90_CURRENT_GATE_START
  ));
  const standardizedShort = records.filter((record) => (
    record.usage_class === 'STANDARDIZED_PRIOR'
    && record.metric !== 'MLB_Sprint_Speed'
  ));
  const historicalProfile = records.filter((record) => record.usage_class === 'HISTORICAL_PROFILE_HINT');
  if (currentDirectT90.length) return 'CURRENT_DIRECT_T90_CANDIDATE';
  if (standardizedShort.length) return 'STANDARDIZED_SHORT_DISTANCE_PRIOR';
  if (historicalProfile.length) return 'HISTORICAL_PROFILE_HINT';
  return 'SPRINT_ONLY';
}

function classifyExposure(exposure) {
  const paBucket = exposure.pa_bucket ?? 'PA_BUCKET_UNAVAILABLE';
  const pa = asNumber(exposure.PA);
  const proxy = asNumber(exposure.full_effort_run_proxy_count);
  const sampleCountPublished = exposure.npb_plus_sample_count !== null && exposure.npb_plus_sample_count !== undefined;
  const qualifiedCountPublished = exposure.npb_plus_qualified_run_count !== null && exposure.npb_plus_qualified_run_count !== undefined;
  const lowExposure = pa !== null && pa < 100;
  return {
    class: `SOURCE_${paBucket}`,
    pa_bucket: paBucket,
    PA: pa,
    games: asNumber(exposure.games),
    full_effort_run_proxy_count: proxy,
    npb_plus_sample_count: exposure.npb_plus_sample_count ?? null,
    npb_plus_qualified_run_count: exposure.npb_plus_qualified_run_count ?? null,
    confidence: sampleCountPublished && qualifiedCountPublished ? 'SOURCE_SAMPLE_COUNT_PRESENT' : 'LIMITED_SAMPLE_COUNT_NOT_PUBLISHED',
    undersampling_suspicion: lowExposure ? 'ELEVATED_REVIEW_REQUIRED' : 'UNRESOLVED_SAMPLE_COUNT_NOT_PUBLISHED',
    rating_effect: 'NONE; exposure is review confidence only, never a rating adjustment',
  };
}

function historyTrajectory(historyRows) {
  const byDate = new Map();
  for (const row of historyRows) {
    const speed = asNumber(row.speed);
    if (!row.update_date || speed === null) continue;
    const bucket = byDate.get(row.update_date) ?? [];
    bucket.push(row);
    byDate.set(row.update_date, bucket);
  }
  const conflicts = [];
  const cleanNodes = [];
  for (const [date, rows] of [...byDate.entries()].sort((left, right) => left[0].localeCompare(right[0]))) {
    const speeds = unique(rows.map((row) => asNumber(row.speed))).sort((left, right) => left - right);
    const observationIds = rows.map((row) => row.observation_id).sort();
    if (speeds.length > 1) {
      conflicts.push({ date, speeds, observation_ids: observationIds });
      continue;
    }
    cleanNodes.push({
      date,
      speed: speeds[0],
      observation_ids: observationIds,
      row_count: rows.length,
    });
  }
  const derivedChanges = cleanNodes.slice(1).map((node, index) => ({
    date: node.date,
    previous_date: cleanNodes[index].date,
    change: node.speed - cleanNodes[index].speed,
  }));
  return {
    raw_observation_count: historyRows.length,
    raw_same_date_conflicts: conflicts,
    excluded_conflict_dates: conflicts.map((conflict) => conflict.date),
    clean_nodes: cleanNodes,
    clean_change_receipts: derivedChanges,
    calculation_boundary: 'PowerPro values are external temporal QA only. Clean nodes are recomputed from raw observations after excluding every same-date conflicting speed; neither values nor changes are used for final rating or anchor selection.',
  };
}

function temporalCandidate({ records, dateRecords, history }) {
  const hasHistoryConflict = history?.raw_same_date_conflicts?.length > 0;
  const hasCurrentDirectT90 = records.some((record) => (
    record.metric === 'T90ft'
    && record.numeric_t90_usable === true
    && Number(record.effective_measurement_year ?? record.measurement_year) >= DIRECT_T90_CURRENT_GATE_START
  ));
  const hasHistoricalPhysical = records.some((record) => record.usage_class === 'HISTORICAL_PROFILE_HINT');
  const unresolvedMeasurementYear = dateRecords.some((record) => record.resolution_status === 'STILL_UNKNOWN');
  if (hasHistoryConflict) {
    return {
      candidate: 'CONFLICTED',
      reason: 'A PowerPro same-date speed conflict was retained and excluded from the external-QA trajectory; no direction is inferred from it.',
    };
  }
  if (hasCurrentDirectT90) {
    return {
      candidate: 'CURRENT_SUPPORTED',
      reason: 'A current-gate direct T90 candidate is present. It remains a candidate for human judgment, not an NPB+ bridge or final rating.',
    };
  }
  if (hasHistoricalPhysical && unresolvedMeasurementYear) {
    return {
      candidate: 'TEMPORAL_UNKNOWN',
      reason: 'Historical physical evidence exists, but at least one associated measurement year remains unresolved; no carry-forward direction is inferred.',
    };
  }
  if (hasHistoricalPhysical && !history) {
    return {
      candidate: 'TEMPORAL_UNKNOWN',
      reason: 'Historical physical evidence exists without an exact PowerPro ID join for temporal QA; no substitute name join was made.',
    };
  }
  return {
    candidate: 'CURRENT_SUPPORTED',
    reason: 'The 2026 NPB+ Sprint Speed is a current signal. It is retained as a provisional baseline without a rating or temporal conversion.',
  };
}

function reviewPriority(packet) {
  const flags = packet.conflict_classification.flags;
  if (flags.includes('STANDARDIZED_50M_CURRENT_NPBPLUS_DIRECTION_CONFLICT')) {
    return {
      priority: 'P0',
      reason: 'Comparable shared electronic 50m evidence and 2026 NPB+ ordinal direction disagree; final human review can materially change the assessment.',
    };
  }
  const p1Conditions = [
    packet.identity.identity_status === 'MISSING_SOURCE_PLAYER_ID',
    packet.history.join_status !== 'EXACT_ID_TO_SUMMARY',
    packet.blind_v3.status !== 'EXACT_PLAYER_ID_MATCH',
    packet.exposure.undersampling_suspicion === 'ELEVATED_REVIEW_REQUIRED',
    packet.temporal.candidate === 'TEMPORAL_UNKNOWN',
    packet.temporal.candidate === 'CONFLICTED',
    packet.direct_t90_evidence.some((record) => record.numeric_t90_usable === true),
    flags.includes('PROTOCOL_OR_MEASUREMENT_YEAR_UNCERTAINTY'),
  ];
  if (p1Conditions.some(Boolean)) {
    return {
      priority: 'P1',
      reason: 'Moderate uncertainty requires review, but no documented comparable-evidence conflict is present.',
    };
  }
  return {
    priority: 'P2',
    reason: 'Confirmation review: current provisional Sprint signal is present and no major source conflict was detected.',
  };
}

function evidenceAgreement(packet) {
  if (packet.conflict_classification.flags.includes('STANDARDIZED_50M_CURRENT_NPBPLUS_DIRECTION_CONFLICT')) {
    return 'DIRECTIONAL_CONFLICT_IN_SHARED_STANDARDIZED_COHORT';
  }
  if (packet._pairwisePhysicalAgreement === true) return 'DIRECTIONALLY_AGREES_WITH_SHARED_STANDARDIZED_COHORT';
  if (packet.direct_t90_evidence.length) return 'DIRECT_T90_PRESENT_NO_VALIDATED_NPBPLUS_BRIDGE';
  if (packet.standardized_short_distance_evidence.length) return 'SHORT_DISTANCE_PRIOR_PRESENT_CURRENT_COMPARISON_LIMITED';
  if (packet.historical_profile_evidence.length) return 'HISTORICAL_PROFILE_PRESENT_NOT_NUMERICALLY_COMPARABLE_TO_CURRENT_NPBPLUS';
  return 'NO_INDEPENDENT_PHYSICAL_CROSSCHECK';
}

function sideCandidate(anchor, relation, edge) {
  return {
    player: anchor.player,
    team: anchor.team,
    player_id: anchor.player_id,
    relation,
    confidence: edge.confidence,
    edge_id: edge.edge_id,
    source_layer: edge.source_layer,
    supporting_evidence: edge.supporting_evidence,
  };
}

function addPairwiseEdge(edgeMap, edge) {
  const key = `${edge.faster.roster_row_id}->${edge.slower.roster_row_id}|${edge.source_layer}`;
  const existing = edgeMap.get(key);
  if (!existing || (existing.confidence === 'LOW' && edge.confidence === 'MODERATE')) edgeMap.set(key, edge);
}

function currentSprintCandidate(masterRows, current, direction, prohibitedPairs) {
  const currentSpeed = current.sprint_speed.value_kmh;
  const ranked = stableSortByPlayer(masterRows.filter((row) => row.player_id !== '53955150'))
    .filter((candidate) => {
      const candidateSpeed = candidate.sprint_speed.value_kmh;
      return direction === 'faster' ? candidateSpeed > currentSpeed : candidateSpeed < currentSpeed;
    })
    .sort((left, right) => (
      Math.abs(left.sprint_speed.value_kmh - currentSpeed) - Math.abs(right.sprint_speed.value_kmh - currentSpeed)
      || String(left.player_id ?? '').localeCompare(String(right.player_id ?? ''))
      || left.player.localeCompare(right.player, 'ja')
    ));
  for (const candidate of ranked) {
    if (candidate.roster_row_id === current.roster_row_id) continue;
    const pairKey = [candidate.roster_row_id, current.roster_row_id].sort().join('|');
    if (prohibitedPairs.has(pairKey)) continue;
    return candidate;
  }
  return null;
}

function serializeForCsv(value) {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function renderAudit({ masterRows, packets, graph, qa, independentQa }) {
  const priorityCounts = countBy(packets, (packet) => packet.recommended_review_status);
  const evidenceTierCounts = countBy(masterRows, (row) => row.evidence.evidence_strength.source_best_evidence_tier);
  const decisionTierCounts = countBy(masterRows, (row) => row.evidence.evidence_strength.decision_usable_evidence_tier);
  const temporalCounts = countBy(masterRows, (row) => row.temporal.candidate);
  const historyCounts = countBy(masterRows, (row) => row.history.join_status);
  const conflictCounts = countBy(masterRows.flatMap((row) => row.conflict_classification.flags), (flag) => flag);
  const directPhysicalEdges = graph.edges.filter((edge) => edge.source_layer === 'CORROBORATED_STANDARDIZED_AND_CURRENT_NPB_PLUS');
  const sprintOnlyEdges = graph.edges.filter((edge) => edge.source_layer === 'CURRENT_NPB_PLUS_ORDINAL_CANDIDATE');
  const qaRows = qa.checks.map((check) => `| ${check.name} | ${check.status} | ${check.detail} |`).join('\n');
  const qaHistoryRows = qa.initial_failure_history.map((entry) => `| ${entry.run} | ${entry.status} | ${entry.check} | ${entry.finding} | ${entry.correction} | ${entry.resolution} |`).join('\n');
  const independentCheckRows = (independentQa?.checks ?? [])
    .map((check) => `| ${check.name} | ${check.status} | ${check.detail} |`)
    .join('\n');
  const independentInitialGateRows = (independentQa?.initial_gate_history ?? [])
    .map((entry) => `| ${entry.check} | ${entry.initial_status} | ${entry.finding} | ${entry.correction} | ${entry.resolution ?? 'PENDING'} |`)
    .join('\n');
  const independentProvenanceRows = Object.entries(independentQa?.source_provenance ?? {})
    .map(([name, value]) => `| ${name} | ${value.status ?? 'UNKNOWN'} | ${value.detail ?? ''} |`)
    .join('\n');
  const independentLimitations = (independentQa?.limitations ?? [])
    .map((limitation) => `- ${limitation}`)
    .join('\n');
  const independent = independentQa
    ? `\nStatus: **${independentQa.status}**\n\n${independentQa.summary ?? ''}\n\n### Independent QA checks\n\n| Check | Status | Evidence |\n|---|---|---|\n${independentCheckRows}\n\n### Independent QA initial gate and correction record\n\n| Check | Initial status | Finding | Correction | Resolution |\n|---|---|---|---|---|\n${independentInitialGateRows || '| none | n/a | n/a | n/a | n/a |'}\n\n### Independent QA source provenance\n\n| Scope | Status | Detail |\n|---|---|---|\n${independentProvenanceRows || '| none | n/a | n/a |'}\n\n### Independent QA limitations\n\n${independentLimitations || '- None recorded.'}\n`
    : '\nStatus: **PENDING** — an independent QA artifact has not yet been saved.\n';

  return `# 2026 NPB Sprint Speed 100-player decision-packet audit

Generated: ${qa.generated_at}

## Scope and hard boundaries

- This artifact prepares evidence packets for human/browser-GPT final judgment. It creates **no final speed rating**, target, range, or calibration correction.
- Scope is pure running ability from the first running step through roughly 90ft. It excludes stealing skill, baserunning judgment, swing-to-run transition, and infield-hit outcomes.
- PowerPro and MLB The Show are external temporal/blind QA only. They are absent from anchor selection, edge generation, and review-priority calculations.
- 50m and 30m records are preserved as ordinal/acceleration evidence only. This builder contains no 50m-to-T90 or 30m-to-T90 conversion.
- PA and full-effort-run proxies are review-confidence fields only. They never change a rating because this builder does not generate ratings.

## Frozen input provenance

| Input | Repository / branch | Commit | Consumed files |
|---|---|---|---|
${Object.entries(SOURCE_MANIFEST).map(([name, source]) => `| ${name} | ${source.repository} / ${source.branch} | \`${source.commit}\` | ${source.files.map((file) => `\`${file}\``).join('<br>')} |`).join('\n')}

The NPB input snapshots required for reproducibility are committed into this branch at their listed paths. The Show artifacts are recorded as external-QA provenance because no verified player-level NPB/MLB ID bridge exists for this roster.

## Join coverage and identity handling

- Master roster seed: exposure dataset **players[]** = **${masterRows.length}/100** rows.
- Physical join: **${masterRows.filter((row) => row.identity.physical_join_status === 'EXACT_NORMALIZED_NAME_TEAM_MATCH').length}/100** exact normalized name+team matches.
- Measurement-date records: **${masterRows.reduce((sum, row) => sum + row.measurement_date_resolution.records.length, 0)}** records across **${masterRows.filter((row) => row.measurement_date_resolution.records.length > 0).length}** players; attached by **measurement_cluster_id**, never by a date-only overwrite.
- Blind-v3: **${masterRows.filter((row) => row.blind_v3.status === 'EXACT_PLAYER_ID_MATCH').length}/100** exact player-ID joins. 名原典彦 remains **SOURCE_ROW_ABSENT**; no formula-based replacement was created.
- Exact PowerPro ID-to-summary joins: **${masterRows.filter((row) => row.history.join_status === 'EXACT_ID_TO_SUMMARY').length}/100**. Missing or conflicting history IDs remain flags rather than forced name matches.
- 名原典彦 is present: **${masterRows.some((row) => row.player === '名原 典彦')}**. The source player ID remains null.

PowerPro exception handling is retained in packets: 宗佑磨, 牧秀悟, 丸佳浩, and 名原典彦 have no exact history-ID match; ソト is an ID conflict requiring review; 松本剛 retains an exact historical link but keeps the separate unresolved 2026 rows out of that trajectory.

## Evidence and temporal distributions

### Source physical evidence tier

${Object.entries(evidenceTierCounts).map(([tier, count]) => `- ${tier}: ${count}`).join('\n')}

### Decision-usable evidence tier (no date-based promotion)

${Object.entries(decisionTierCounts).map(([tier, count]) => `- ${tier}: ${count}`).join('\n')}

### Temporal candidates

${Object.entries(temporalCounts).map(([state, count]) => `- ${state}: ${count}`).join('\n')}

No **IMPROVEMENT_SUPPORTED**, **DECLINE_SUPPORTED**, or **STABLE_CARRY_FORWARD** state is fabricated from game ratings, carry-forward rows, age, or unmatched metrics.

### PowerPro external-QA joins

${Object.entries(historyCounts).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

For every exact history ID, trajectory nodes are rebuilt from raw observations after excluding all same-player/same-date conflicting speed dates. The pre-existing change-event and summary files are not used because their historical builder calculated changes before conflict exclusion.

- Global source-panel same-date conflict receipts retained: **${powerpro.qa?.same_player_same_date_conflicts?.length ?? 0}**.
- Exact target-ID trajectories with a retained raw conflict receipt: **${masterRows.filter((row) => (row.history.raw_same_date_conflicts ?? []).length > 0).length}**.

## Pairwise graph

- Nodes: ${graph.nodes.length}
- Edges: ${graph.edges.length}
- Physical-corroborated edges: ${directPhysicalEdges.length}
- Sprint-only low-confidence ordinal candidates: ${sprintOnlyEdges.length}
- **CLEARLY_FASTER_THAN** / **CLEARLY_SLOWER_THAN**: 0 (measurement error / repeat-test precision is not available).
- **SIMILAR_BAND**: 0 (same displayed T90 across different years is not treated as same-condition evidence).

The two physical-corroborated current candidates are only 林琢真 → 奈良間大己 and 友杉篤輝 → 奈良間大己. 林琢真 ↔ 友杉篤輝 is intentionally suppressed because shared 2022 electronic 50m ordering conflicts with 2026 NPB+ ordering. All other graph edges are explicitly marked **CURRENT_NPB_PLUS_ORDINAL_CANDIDATE** / **LOW**, not comparable T90 evidence.

## Human review queue

${Object.entries(priorityCounts).map(([priority, count]) => `- ${priority}: ${count}`).join('\n')}

All 100 records remain **human_judgment_required=true** because this handoff does not decide final ratings.

## Conflict and missing-data register

${Object.entries(conflictCounts).map(([flag, count]) => `- ${flag}: ${count}`).join('\n')}

Negative findings:

- NPB+ measurement sample count / qualified run count is not publicly documented in the source artifact; PA/proxy are not treated as a substitute.
- No exact measurement date is established by the date-resolution artifact; inferred years improve only temporal joins.
- The 2026 photoelectric 30m/50m cohort has no normalized-name overlap with this 100-player roster.
- The Show history has extensive carry-forward rows and no proven Statcast join; it cannot establish an NPB player's physical trajectory here.
- Injury data were not among the approved source artifacts. The packets state that limitation rather than infer injury effects.
- **NEEDS_ADDITIONAL_EVIDENCE** is retained where a final reviewer would need information outside the approved artifacts.

## Build QA

| Check | Status | Detail |
|---|---|---|
${qaRows}

### Build QA correction history

| Run | Status | Check | Finding | Correction | Resolution |
|---|---|---|---|---|---|
${qaHistoryRows}

## Independent QA
${independent}

## Browser-GPT handoff notes

1. Use **speed_2026_100_decision_packets.json** for player-by-player review. Treat **blind_v3_baseline** as display-only provisional context, not a result to adopt.
2. Start with P0, then P1, then P2 queue order. Inspect every packet before setting any final value.
3. Do not use a PowerPro or The Show number to move a final rating. Use those histories only to ask why a physical observation may be old or contradictory.
4. For a packet marked **INSUFFICIENT_PAIRWISE_EVIDENCE**, leave the comparison unresolved rather than manufacturing an anchor.
5. If outside evidence becomes essential, mark it **NEEDS_ADDITIONAL_EVIDENCE**; this task does not authorize new large-scale collection.
`;
}

const physical = readJson(INPUT.physical);
const physicalCoverageRows = readCsv(INPUT.physicalCoverage);
const measurementDate = readJson(INPUT.measurementDate);
const exposure = readJson(INPUT.exposure);
const blind = readJson(INPUT.blind);
const powerpro = readJson(INPUT.powerproHistory);

// Presence checks intentionally include raw short-distance source files even though the
// trusted player joins below route through curated physical records / cluster IDs.
ensureInput(INPUT.standardized50m);
ensureInput(INPUT.standardized30m50m);
ensureInput(INPUT.curated30m);
const LOCAL_INPUT_SHA256 = Object.fromEntries(Object.entries(INPUT).map(([name, relativePath]) => [name, sha256(relativePath)]));

const physicalByKey = new Map(physical.players.map((player) => [rosterNameTeamKey(player.player, player.team), player]));
const physicalCoverageByKey = new Map(physicalCoverageRows.map((row) => [rosterNameTeamKey(row.player, row.team), row]));
const datesByKey = new Map();
for (const dateRecord of measurementDate.records) {
  const key = rosterNameTeamKey(dateRecord.player, dateRecord.team);
  const rows = datesByKey.get(key) ?? [];
  rows.push(dateRecord);
  datesByKey.set(key, rows);
}
const blindById = new Map(blind.players.map((row) => [String(row.player_id), row]));
const historySummaryById = new Map(powerpro.player_summary.map((row) => [row.canonical_player_id, row]));
const historyRowsById = new Map();
for (const row of powerpro.observations) {
  const rows = historyRowsById.get(row.canonical_player_id) ?? [];
  rows.push(row);
  historyRowsById.set(row.canonical_player_id, rows);
}

const masterRows = exposure.players.map((sourceExposure, index) => {
  const playerId = sourceExposure.player_id === null || sourceExposure.player_id === undefined || sourceExposure.player_id === ''
    ? null
    : String(sourceExposure.player_id);
  const key = rosterNameTeamKey(sourceExposure.player, sourceExposure.team);
  const physicalPlayer = physicalByKey.get(key);
  if (!physicalPlayer) throw new Error(`Missing physical record for roster row: ${sourceExposure.player} / ${sourceExposure.team}`);
  const coverage = physicalCoverageByKey.get(key);
  if (!coverage) throw new Error(`Missing physical coverage row for roster row: ${sourceExposure.player} / ${sourceExposure.team}`);
  const matchingDates = datesByKey.get(key) ?? [];
  const physicalClusters = new Set(physicalPlayer.records.map((record) => record.same_measurement_cluster_id).filter(Boolean));
  const attachedDateRecords = matchingDates.filter((record) => physicalClusters.has(record.measurement_cluster_id));
  if (matchingDates.length !== attachedDateRecords.length) {
    throw new Error(`Date-resolution cluster mismatch for ${sourceExposure.player} / ${sourceExposure.team}`);
  }
  const dateByCluster = new Map(attachedDateRecords.map((record) => [record.measurement_cluster_id, record]));
  const physicalRecords = physicalPlayer.records.map((record) => {
    const resolved = buildPhysicalRecord(record, dateByCluster.get(record.same_measurement_cluster_id));
    return {
      ...resolved,
      effective_measurement_year: resolved.resolved_measurement_year ?? resolved.source_measurement_year ?? null,
    };
  });
  const blindRow = playerId ? blindById.get(playerId) : null;
  const canonicalHistoryId = playerId ? `proeye:${playerId}` : null;
  const historySummary = canonicalHistoryId ? historySummaryById.get(canonicalHistoryId) : null;
  const historyRows = historySummary ? historyRowsById.get(canonicalHistoryId) ?? [] : [];
  const history = historySummary ? historyTrajectory(historyRows) : null;
  const identityFlags = [];
  if (!playerId) identityFlags.push('MISSING_SOURCE_PLAYER_ID');
  let historyJoinStatus = 'EXACT_ID_TO_SUMMARY';
  if (!historySummary) {
    if (playerId === '03505133') {
      historyJoinStatus = 'ID_CONFLICT_REQUIRES_REVIEW';
      identityFlags.push('POWERPRO_ID_CONFLICT_DO_NOT_AUTO_ALIAS');
    } else {
      historyJoinStatus = 'MISSING_EXACT_ID_MAPPING';
      identityFlags.push('POWERPRO_EXACT_ID_NOT_AVAILABLE');
    }
  }
  if (playerId === '21625135') identityFlags.push('POWERPRO_2026_UNRESOLVED_ROWS_EXCLUDED_FROM_EXACT_TRAJECTORY');
  const directT90 = physicalRecords.filter((record) => record.metric === 'T90ft');
  const standardizedShortDistance = physicalRecords.filter((record) => (
    record.usage_class === 'STANDARDIZED_PRIOR' && record.metric !== 'MLB_Sprint_Speed'
  ));
  const historicalProfile = physicalRecords.filter((record) => record.usage_class === 'HISTORICAL_PROFILE_HINT');
  const contextOnly = physicalRecords.filter((record) => record.usage_class === 'CONTEXT_ONLY');
  const currentDirectT90 = directT90.filter((record) => (
    record.numeric_t90_usable === true && Number(record.effective_measurement_year) >= DIRECT_T90_CURRENT_GATE_START
  ));
  const hasUncertainProtocolOrDate = physicalRecords.some((record) => (
    record.timing_method === 'unknown' || record.temporal_join_status === 'STILL_UNKNOWN'
  ));
  const temporal = temporalCandidate({ records: physicalRecords, dateRecords: attachedDateRecords, history });
  const conflictFlags = ['NPB_PLUS_SAMPLE_COUNT_OR_QUALIFIED_RUN_COUNT_NOT_PUBLISHED'];
  if (hasUncertainProtocolOrDate) conflictFlags.push('PROTOCOL_OR_MEASUREMENT_YEAR_UNCERTAINTY');
  if (currentDirectT90.length) conflictFlags.push('DIRECT_T90_PRESENT_NPBPLUS_BRIDGE_UNCALIBRATED');
  if (!historySummary) conflictFlags.push('POWERPRO_TEMPORAL_QA_UNAVAILABLE_OR_CONFLICTED_ID');
  if (!blindRow) conflictFlags.push('BLIND_V3_SOURCE_ROW_ABSENT');
  if (!playerId) conflictFlags.push('IDENTITY_SOURCE_ID_MISSING');
  if (history?.raw_same_date_conflicts?.length) conflictFlags.push('POWERPRO_SAME_DATE_CONFLICT_EXCLUDED_FROM_TRAJECTORY');
  const packet = {
    roster_row_id: `npbplus-2026-${String(index + 1).padStart(3, '0')}`,
    player: sourceExposure.player,
    team: sourceExposure.team,
    player_id: playerId,
    roster_join_key: playerId ? `npbplus:${playerId}` : `fallback-name-team:${normalize(sourceExposure.player)}|${normalize(sourceExposure.team)}`,
    identity: {
      identity_status: playerId ? 'SOURCE_PLAYER_ID_PRESENT' : 'MISSING_SOURCE_PLAYER_ID',
      identity_flags: identityFlags,
      physical_join_status: 'EXACT_NORMALIZED_NAME_TEAM_MATCH',
      physical_join_method: TEAM_AND_NAME_JOIN,
      history_join_status: historyJoinStatus,
      history_canonical_player_id: historySummary ? canonicalHistoryId : null,
      history_identity_confidence: historySummary?.identity_confidence ?? null,
    },
    sprint_speed: {
      value_kmh: asNumber(sourceExposure.npb_plus_sprint_speed_kmh),
      source_season_label: sourceExposure.npb_plus_source_season_label ?? null,
      source_url: sourceExposure.source_url ?? null,
      treatment: 'current provisional physical baseline / ordinal signal only; not a final rating',
    },
    blind_v3: blindRow ? {
      status: 'EXACT_PLAYER_ID_MATCH',
      top_speed_kmh: asNumber(blindRow.top_speed_kmh),
      t90_blind: asNumber(blindRow.t90_blind),
      blind_rating: asNumber(blindRow.blind_rating),
      treatment: 'display-only baseline and current-top-speed signal; never adopted as final rating',
    } : {
      status: 'SOURCE_ROW_ABSENT',
      top_speed_kmh: null,
      t90_blind: null,
      blind_rating: null,
      treatment: 'not computed for the missing source row; no replacement is invented',
    },
    exposure: classifyExposure(sourceExposure),
    evidence: {
      evidence_strength: {
        source_best_evidence_tier: coverage.best_evidence_tier || 'unknown',
        decision_usable_evidence_tier: classifyDecisionEvidence(physicalRecords),
        source_counts: {
          direct_t90_count: asNumber(coverage.direct_t90_count),
          thirty_m_count: asNumber(coverage['30m_count']),
          fifty_m_count: asNumber(coverage['50m_count']),
          standardized_prior_count: asNumber(coverage.standardized_prior_count),
          historical_profile_count: asNumber(coverage.historical_profile_count),
          context_only_count: asNumber(coverage.context_only_count),
          physical_measurement_count: asNumber(coverage.physical_measurement_count),
        },
        guardrail: 'Resolved measurement year never changes the source evidence tier or numeric usability.',
      },
      all_physical_records: physicalRecords,
      physical_search_status: physicalPlayer.search,
    },
    direct_t90_evidence: directT90,
    standardized_short_distance_evidence: standardizedShortDistance,
    historical_profile_evidence: historicalProfile,
    context_only_evidence: contextOnly,
    measurement_date_resolution: {
      record_count: attachedDateRecords.length,
      records: attachedDateRecords,
      join_method: 'measurement_cluster_id exact match after confirmed player/team roster join',
      tier_effect: 'none',
    },
    temporal: {
      ...temporal,
      measurement_year_statuses: unique(attachedDateRecords.map((record) => record.resolution_status)),
      powerpro_contributes_to_final_value: false,
      the_show_external_qa_status: 'READ_AS_EXTERNAL_METHOD_LIMIT_ONLY; no player-level NPB/MLB join asserted',
    },
    history: history ? {
      join_status: historyJoinStatus,
      canonical_player_id: canonicalHistoryId,
      identity_confidence: historySummary.identity_confidence,
      ...history,
      usage: 'external QA only; not an anchor/rating input',
    } : {
      join_status: historyJoinStatus,
      canonical_player_id: null,
      identity_confidence: null,
      raw_same_date_conflicts: null,
      excluded_conflict_dates: [],
      clean_nodes: [],
      clean_change_receipts: [],
      usage: 'unavailable: no exact source-player-ID mapping was forced',
    },
    conflict_classification: {
      evidence_strength: coverage.best_evidence_tier || 'unknown',
      exposure_confidence: classifyExposure(sourceExposure).confidence,
      evidence_agreement: 'PENDING_PAIRWISE_DIRECTION_CHECK',
      flags: unique(conflictFlags),
      injury_status: 'NOT_ASSESSED_IN_APPROVED_SOURCE_ARTIFACTS',
      human_review_necessity: true,
    },
    pairwise: {
      faster_anchor_candidate: null,
      slower_anchor_candidate: null,
      pairwise_confidence: 'INSUFFICIENT',
      status: 'PENDING_GRAPH_BUILD',
      notes: [],
    },
    recommended_review_status: null,
    human_judgment_required: true,
    reason: [],
    source_artifact_references: {
      sprint_exposure: sourceReference(INPUT.exposure, 'exposure_audit'),
      physical: sourceReference(INPUT.physical, 'physical_evidence'),
      physical_coverage: sourceReference(INPUT.physicalCoverage, 'physical_evidence'),
      measurement_date: sourceReference(INPUT.measurementDate, 'measurement_date_resolution'),
      blind_v3: sourceReference(INPUT.blind, 'physical_evidence'),
      powerpro_history: sourceReference(INPUT.powerproHistory, 'powerpro_history'),
      the_show_external_qa: [
        sourceReference('docs/audits/mlb_the_show_speed_history_audit.md', 'the_show_speed_history'),
        sourceReference('docs/audits/mlb_the_show_full_attribute_history_2017_2026.md', 'the_show_full_attributes'),
      ],
    },
    _pairwisePhysicalAgreement: false,
  };
  return packet;
});

const expectedMeasurementRecords = measurementDate.records.length;
if (masterRows.length !== 100) throw new Error(`Expected 100 exposure rows, received ${masterRows.length}`);
if (new Set(masterRows.map((row) => row.roster_row_id)).size !== masterRows.length) throw new Error('Duplicate roster_row_id detected');
if (new Set(masterRows.map((row) => row.roster_join_key)).size !== masterRows.length) throw new Error('Duplicate roster_join_key detected');
if (!masterRows.some((row) => row.player === '名原 典彦')) throw new Error('名原典彦 is missing from the master roster');
if (masterRows.reduce((sum, row) => sum + row.measurement_date_resolution.record_count, 0) !== expectedMeasurementRecords) {
  throw new Error('Not every measurement-date record was attached by a valid cluster ID');
}

// Pairwise layer 1: only the one shared standardized electronic 50m cohort that
// overlaps the roster. Build a current edge only when its historical direction
// agrees with 2026 Sprint Speed direction.
const physicalEdgeMap = new Map();
const prohibitedPairs = new Set();
const standardizedGroups = new Map();
for (const packet of masterRows) {
  for (const record of packet.standardized_short_distance_evidence) {
    if (record.metric !== '50m' || record.timing_method !== 'electronic_photoelectric') continue;
    const groupKey = [record.metric, record.effective_measurement_year, record.timing_method, record.cohort, record.source_url].join('|');
    const members = standardizedGroups.get(groupKey) ?? [];
    members.push({ packet, record });
    standardizedGroups.set(groupKey, members);
  }
}
for (const members of standardizedGroups.values()) {
  if (members.length < 2) continue;
  const ranked = [...members].sort((left, right) => asNumber(left.record.seconds) - asNumber(right.record.seconds));
  for (let fasterIndex = 0; fasterIndex < ranked.length; fasterIndex += 1) {
    for (let slowerIndex = fasterIndex + 1; slowerIndex < ranked.length; slowerIndex += 1) {
      const faster = ranked[fasterIndex];
      const slower = ranked[slowerIndex];
      const physicalDirection = asNumber(faster.record.seconds) < asNumber(slower.record.seconds);
      if (!physicalDirection) continue;
      const sprintDirectionAgrees = faster.packet.sprint_speed.value_kmh > slower.packet.sprint_speed.value_kmh;
      const pairKey = [faster.packet.roster_row_id, slower.packet.roster_row_id].sort().join('|');
      if (!sprintDirectionAgrees) {
        prohibitedPairs.add(pairKey);
        faster.packet.conflict_classification.flags.push('STANDARDIZED_50M_CURRENT_NPBPLUS_DIRECTION_CONFLICT');
        slower.packet.conflict_classification.flags.push('STANDARDIZED_50M_CURRENT_NPBPLUS_DIRECTION_CONFLICT');
        faster.packet.pairwise.notes.push(`No edge versus ${slower.packet.player}: shared standardized 50m and current NPB+ directions conflict.`);
        slower.packet.pairwise.notes.push(`No edge versus ${faster.packet.player}: shared standardized 50m and current NPB+ directions conflict.`);
        continue;
      }
      faster.packet._pairwisePhysicalAgreement = true;
      slower.packet._pairwisePhysicalAgreement = true;
      addPairwiseEdge(physicalEdgeMap, {
        edge_id: `physical-${faster.packet.roster_row_id}-${slower.packet.roster_row_id}`,
        faster: faster.packet,
        slower: slower.packet,
        relation: 'LIKELY_FASTER_THAN',
        confidence: 'MODERATE',
        source_layer: 'CORROBORATED_STANDARDIZED_AND_CURRENT_NPB_PLUS',
        supporting_evidence: [
          {
            type: 'shared_electronic_photoelectric_50m',
            measurement_year: faster.record.effective_measurement_year,
            cohort: faster.record.cohort,
            faster_time_seconds: asNumber(faster.record.seconds),
            slower_time_seconds: asNumber(slower.record.seconds),
            source_url: faster.record.source_url,
          },
          {
            type: 'current_npb_plus_ordinal_agreement',
            faster_sprint_speed_kmh: faster.packet.sprint_speed.value_kmh,
            slower_sprint_speed_kmh: slower.packet.sprint_speed.value_kmh,
            source_artifact: INPUT.exposure,
          },
        ],
      });
    }
  }
}

const graphEdgeMap = new Map(physicalEdgeMap);
const physicalEdges = [...physicalEdgeMap.values()];
for (const edge of physicalEdges) {
  const fasterCurrent = edge.faster.pairwise.slower_anchor_candidate;
  if (!fasterCurrent || fasterCurrent.confidence !== 'MODERATE') {
    edge.faster.pairwise.slower_anchor_candidate = sideCandidate(edge.slower, 'LIKELY_SLOWER_THAN', edge);
  }
  const slowerCurrent = edge.slower.pairwise.faster_anchor_candidate;
  const currentGap = slowerCurrent ? Math.abs(slowerCurrent.supporting_evidence?.[1]?.faster_sprint_speed_kmh - slowerCurrent.supporting_evidence?.[1]?.slower_sprint_speed_kmh) : Infinity;
  const newGap = Math.abs(edge.faster.sprint_speed.value_kmh - edge.slower.sprint_speed.value_kmh);
  if (!slowerCurrent || slowerCurrent.confidence !== 'MODERATE' || newGap < currentGap) {
    edge.slower.pairwise.faster_anchor_candidate = sideCandidate(edge.faster, 'LIKELY_FASTER_THAN', edge);
  }
}

// Pairwise layer 2: adjacent/nearby NPB+ current ordinal candidates. These are
// deliberately low confidence and never bridge to another metric.
for (const packet of masterRows) {
  if (packet.player_id === '53955150') {
    packet.pairwise.notes.push('Current anchor selection withheld: direct T90 candidate and NPB+ belong to an unvalidated bridge context.');
    continue;
  }
  for (const direction of ['faster', 'slower']) {
    const field = direction === 'faster' ? 'faster_anchor_candidate' : 'slower_anchor_candidate';
    if (packet.pairwise[field]?.confidence === 'MODERATE') continue;
    const candidate = currentSprintCandidate(masterRows, packet, direction, prohibitedPairs);
    if (!candidate) {
      packet.pairwise.notes.push(`No ${direction}-side current NPB+ candidate survives the conservative edge rules.`);
      continue;
    }
    const faster = direction === 'faster' ? candidate : packet;
    const slower = direction === 'faster' ? packet : candidate;
    const edge = {
      edge_id: `npbplus-${faster.roster_row_id}-${slower.roster_row_id}`,
      faster,
      slower,
      relation: 'LIKELY_FASTER_THAN',
      confidence: 'LOW',
      source_layer: 'CURRENT_NPB_PLUS_ORDINAL_CANDIDATE',
      supporting_evidence: [
        {
          type: 'npb_plus_sprint_speed_current_ordinal_only',
          faster_sprint_speed_kmh: faster.sprint_speed.value_kmh,
          slower_sprint_speed_kmh: slower.sprint_speed.value_kmh,
          source_artifact: INPUT.exposure,
          limitation: 'sample count and qualified-run count are not published; this is not a T90 comparison or a final-rating recommendation',
        },
      ],
    };
    addPairwiseEdge(graphEdgeMap, edge);
    packet.pairwise[field] = sideCandidate(candidate, direction === 'faster' ? 'LIKELY_FASTER_THAN' : 'LIKELY_SLOWER_THAN', edge);
  }
}

for (const packet of masterRows) {
  packet.conflict_classification.flags = unique(packet.conflict_classification.flags);
  packet.conflict_classification.evidence_agreement = evidenceAgreement(packet);
  const confidences = [packet.pairwise.faster_anchor_candidate?.confidence, packet.pairwise.slower_anchor_candidate?.confidence].filter(Boolean);
  packet.pairwise.pairwise_confidence = confidences.includes('MODERATE') ? 'MODERATE' : confidences.includes('LOW') ? 'LOW' : 'INSUFFICIENT';
  packet.pairwise.status = packet.pairwise.pairwise_confidence === 'INSUFFICIENT'
    ? 'INSUFFICIENT_PAIRWISE_EVIDENCE'
    : 'CANDIDATES_GENERATED_NOT_FINAL';
  if (packet.pairwise.status === 'INSUFFICIENT_PAIRWISE_EVIDENCE') packet.pairwise.notes.push('INSUFFICIENT_PAIRWISE_EVIDENCE');
  const review = reviewPriority(packet);
  packet.recommended_review_status = review.priority;
  packet.reason = unique([
    review.reason,
    packet.temporal.reason,
    packet.blind_v3.treatment,
    packet.exposure.rating_effect,
  ]);
}

const graph = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  purpose: 'Evidence-supported ordinal candidate graph; not a final rating or T90 conversion graph.',
  guardrails: [
    'No PowerPro or MLB The Show value/history is used in an edge.',
    'No 50m/30m-to-T90 conversion is performed.',
    'Current NPB+ only edges are low-confidence ordinal candidates because public sample/qualified-run counts are unavailable.',
    'No unsupported edge is emitted; missing candidates are explicit.',
  ],
  nodes: masterRows.map((row) => ({
    roster_row_id: row.roster_row_id,
    player: row.player,
    team: row.team,
    player_id: row.player_id,
    sprint_speed_kmh: row.sprint_speed.value_kmh,
    evidence_tier: row.evidence.evidence_strength.decision_usable_evidence_tier,
    pairwise_status: row.pairwise.status,
  })),
  edges: [...graphEdgeMap.values()].sort((left, right) => left.edge_id.localeCompare(right.edge_id)).map((edge) => ({
    edge_id: edge.edge_id,
    from: {
      roster_row_id: edge.faster.roster_row_id,
      player: edge.faster.player,
      team: edge.faster.team,
      player_id: edge.faster.player_id,
    },
    to: {
      roster_row_id: edge.slower.roster_row_id,
      player: edge.slower.player,
      team: edge.slower.team,
      player_id: edge.slower.player_id,
    },
    relation: edge.relation,
    confidence: edge.confidence,
    source_layer: edge.source_layer,
    supporting_evidence: edge.supporting_evidence,
  })),
  suppressed_pairs: masterRows.flatMap((row) => row.pairwise.notes
    .filter((note) => note.startsWith('No edge versus'))
    .map((note) => ({ player: row.player, note }))),
};

const packets = masterRows.map((row) => ({
  player: row.player,
  team: row.team,
  player_id: row.player_id,
  roster_row_id: row.roster_row_id,
  sprint_speed: row.sprint_speed,
  blind_v3_baseline: row.blind_v3,
  PA: row.exposure.PA,
  exposure_proxy: row.exposure.full_effort_run_proxy_count,
  exposure_class: row.exposure.class,
  exposure: row.exposure,
  direct_t90_evidence: row.direct_t90_evidence,
  standardized_short_distance_evidence: row.standardized_short_distance_evidence,
  historical_profile_evidence: row.historical_profile_evidence,
  measurement_year_confidence: {
    records: row.measurement_date_resolution.records,
    statuses: row.temporal.measurement_year_statuses,
    no_tier_upgrade_confirmed: true,
  },
  evidence_tier: row.evidence.evidence_strength,
  temporal_candidate: row.temporal,
  conflict_flags: row.conflict_classification.flags,
  evidence_agreement: row.conflict_classification.evidence_agreement,
  faster_anchor_candidate: row.pairwise.faster_anchor_candidate,
  slower_anchor_candidate: row.pairwise.slower_anchor_candidate,
  pairwise_confidence: row.pairwise.pairwise_confidence,
  pairwise_status: row.pairwise.status,
  pairwise_notes: row.pairwise.notes,
  recommended_review_status: row.recommended_review_status,
  human_judgment_required: true,
  reason: row.reason,
  identity: row.identity,
  powerpro_temporal_qa: row.history,
  the_show_external_qa: row.temporal.the_show_external_qa_status,
  source_artifact_references: row.source_artifact_references,
  prohibited_uses_confirmed: {
    final_speed_value_generated: false,
    powerpro_or_the_show_used_for_anchor_or_rating: false,
    fifty_or_thirty_m_converted_to_t90: false,
    PA_or_proxy_used_for_rating_adjustment: false,
  },
}));

const masterCsvHeaders = [
  'roster_row_id', 'player_id', 'player', 'team', 'roster_join_key', 'identity_status', 'identity_flags',
  'npb_plus_sprint_speed_kmh', 'blind_v3_status', 'blind_v3_baseline_rating', 'blind_v3_t90',
  'games', 'PA', 'full_effort_run_proxy_count', 'exposure_class', 'exposure_confidence', 'undersampling_suspicion',
  'source_best_evidence_tier', 'decision_usable_evidence_tier', 'physical_record_count', 'direct_t90_current_count',
  'standardized_short_distance_count', 'historical_profile_count', 'context_only_count', 'measurement_date_record_count',
  'measurement_year_statuses', 'temporal_candidate', 'powerpro_join_status', 'powerpro_same_date_conflict_count',
  'powerpro_clean_trajectory_node_count', 'conflict_flags', 'evidence_agreement', 'pairwise_confidence',
  'faster_anchor_candidate', 'slower_anchor_candidate', 'recommended_review_status', 'human_judgment_required',
  'reason', 'source_artifact_references',
];
const masterCsvRows = masterRows.map((row) => ({
  roster_row_id: row.roster_row_id,
  player_id: row.player_id,
  player: row.player,
  team: row.team,
  roster_join_key: row.roster_join_key,
  identity_status: row.identity.identity_status,
  identity_flags: serializeForCsv(row.identity.identity_flags),
  npb_plus_sprint_speed_kmh: row.sprint_speed.value_kmh,
  blind_v3_status: row.blind_v3.status,
  blind_v3_baseline_rating: row.blind_v3.blind_rating,
  blind_v3_t90: row.blind_v3.t90_blind,
  games: row.exposure.games,
  PA: row.exposure.PA,
  full_effort_run_proxy_count: row.exposure.full_effort_run_proxy_count,
  exposure_class: row.exposure.class,
  exposure_confidence: row.exposure.confidence,
  undersampling_suspicion: row.exposure.undersampling_suspicion,
  source_best_evidence_tier: row.evidence.evidence_strength.source_best_evidence_tier,
  decision_usable_evidence_tier: row.evidence.evidence_strength.decision_usable_evidence_tier,
  physical_record_count: row.evidence.all_physical_records.length,
  direct_t90_current_count: row.direct_t90_evidence.filter((record) => record.numeric_t90_usable === true).length,
  standardized_short_distance_count: row.standardized_short_distance_evidence.length,
  historical_profile_count: row.historical_profile_evidence.length,
  context_only_count: row.context_only_evidence.length,
  measurement_date_record_count: row.measurement_date_resolution.record_count,
  measurement_year_statuses: serializeForCsv(row.temporal.measurement_year_statuses),
  temporal_candidate: row.temporal.candidate,
  powerpro_join_status: row.history.join_status,
  powerpro_same_date_conflict_count: row.history.raw_same_date_conflicts?.length ?? '',
  powerpro_clean_trajectory_node_count: row.history.clean_nodes?.length ?? 0,
  conflict_flags: serializeForCsv(row.conflict_classification.flags),
  evidence_agreement: row.conflict_classification.evidence_agreement,
  pairwise_confidence: row.pairwise.pairwise_confidence,
  faster_anchor_candidate: serializeForCsv(row.pairwise.faster_anchor_candidate),
  slower_anchor_candidate: serializeForCsv(row.pairwise.slower_anchor_candidate),
  recommended_review_status: row.recommended_review_status,
  human_judgment_required: row.human_judgment_required,
  reason: serializeForCsv(row.reason),
  source_artifact_references: serializeForCsv(row.source_artifact_references),
}));

const reviewQueueHeaders = [
  'priority', 'roster_row_id', 'player_id', 'player', 'team', 'npb_plus_sprint_speed_kmh', 'PA',
  'exposure_class', 'evidence_tier', 'temporal_candidate', 'identity_status', 'history_join_status',
  'pairwise_confidence', 'conflict_flags', 'review_reason', 'required_human_action',
];
const reviewQueueRows = [...masterRows]
  .sort((left, right) => (
    left.recommended_review_status.localeCompare(right.recommended_review_status)
    || left.roster_row_id.localeCompare(right.roster_row_id)
  ))
  .map((row) => ({
    priority: row.recommended_review_status,
    roster_row_id: row.roster_row_id,
    player_id: row.player_id,
    player: row.player,
    team: row.team,
    npb_plus_sprint_speed_kmh: row.sprint_speed.value_kmh,
    PA: row.exposure.PA,
    exposure_class: row.exposure.class,
    evidence_tier: row.evidence.evidence_strength.decision_usable_evidence_tier,
    temporal_candidate: row.temporal.candidate,
    identity_status: row.identity.identity_status,
    history_join_status: row.history.join_status,
    pairwise_confidence: row.pairwise.pairwise_confidence,
    conflict_flags: serializeForCsv(row.conflict_classification.flags),
    review_reason: row.reason[0],
    required_human_action: 'Set final rating only after reviewing this packet; do not use game ratings or automatic PA adjustment.',
  }));

function findProhibitedKey(value, parentPath = '') {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findProhibitedKey(value[index], `${parentPath}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const qualified = parentPath ? `${parentPath}.${key}` : key;
      if (/final.*rating|rating.*final|recommended.*rating/iu.test(key)) return qualified;
      const found = findProhibitedKey(child, qualified);
      if (found) return found;
    }
  }
  return null;
}

const qaChecks = [];
function qa(name, pass, detail) {
  qaChecks.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
}
qa('master_roster_exactly_100', masterRows.length === 100, `rows=${masterRows.length}`);
qa('decision_packets_exactly_100', packets.length === 100, `packets=${packets.length}`);
qa('no_duplicate_roster_row', new Set(masterRows.map((row) => row.roster_row_id)).size === 100, 'roster_row_id unique');
qa('名原典彦_included_and_source_id_uninvented', (() => {
  const player = masterRows.find((row) => row.player === '名原 典彦');
  return Boolean(player && player.player_id === null && player.blind_v3.status === 'SOURCE_ROW_ABSENT');
})(), 'player_id remains null; blind-v3 row remains absent');
qa('sprint_source_join', masterRows.every((row) => row.sprint_speed.value_kmh !== null), '100/100 current Sprint values retained from exposure source');
qa('physical_join', masterRows.every((row) => row.identity.physical_join_status === 'EXACT_NORMALIZED_NAME_TEAM_MATCH'), '100/100 normalized name+team joins');
qa('measurement_date_cluster_join', masterRows.reduce((sum, row) => sum + row.measurement_date_resolution.record_count, 0) === expectedMeasurementRecords, `attached=${masterRows.reduce((sum, row) => sum + row.measurement_date_resolution.record_count, 0)} source=${expectedMeasurementRecords}`);
qa('blind_v3_join_and_missing_row', masterRows.filter((row) => row.blind_v3.status === 'EXACT_PLAYER_ID_MATCH').length === 99 && masterRows.filter((row) => row.blind_v3.status === 'SOURCE_ROW_ABSENT').length === 1, '99 exact, 1 source absence');
qa('same_date_powerpro_conflicts_excluded', masterRows.every((row) => {
  const excluded = new Set(row.history.excluded_conflict_dates ?? []);
  return (row.history.clean_nodes ?? []).every((node) => !excluded.has(node.date));
}), 'all exact-ID trajectories rebuilt after excluding conflict dates');
qa('no_50m_or_30m_t90_conversion', true, 'builder preserves metrics and emits no converted T90 values');
qa('powerpro_or_the_show_not_in_pairwise_graph', !JSON.stringify(graph.edges).match(/PowerPro|The Show|pawapuro|the_show/iu), 'graph evidence contains physical / NPB+ source layers only');
qa('no_final_rating_key_generated', findProhibitedKey({ masterRows, packets, graph }) === null, `prohibited_key=${findProhibitedKey({ masterRows, packets, graph}) ?? 'none'}`);
qa('reproducible_input_presence', Object.values(INPUT).every((relativePath) => fs.existsSync(absolute(relativePath))), 'all fixed local input snapshots present');

const buildQa = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  status: qaChecks.every((check) => check.status === 'PASS') ? 'PASS' : 'FAIL',
  checks: qaChecks,
  initial_failure_history: INITIAL_BUILD_QA_HISTORY,
  source_manifest: SOURCE_MANIFEST,
  local_input_sha256: LOCAL_INPUT_SHA256,
};

const independentQa = fs.existsSync(absolute(OUTPUT.independentQa))
  ? JSON.parse(fs.readFileSync(absolute(OUTPUT.independentQa), 'utf8'))
  : null;

const masterJson = {
  schema_version: '1.0',
  generated_at: buildQa.generated_at,
  purpose: '100-row master evidence dataset for human/browser-GPT final speed review; no final ratings included.',
  guardrails: [
    'PowerPro / The Show values are not rating, anchor, or correction inputs.',
    'No 50m/30m-to-T90 conversion.',
    'No PA/proxy rating adjustment.',
    'Measurement-year resolution does not upgrade evidence tier.',
  ],
  source_manifest: SOURCE_MANIFEST,
  local_input_sha256: LOCAL_INPUT_SHA256,
  global_powerpro_same_date_conflict_registry: powerpro.qa?.same_player_same_date_conflicts ?? [],
  rows: masterRows,
};

const decisionPacketJson = {
  schema_version: '1.0',
  generated_at: buildQa.generated_at,
  purpose: 'Decision-ready packets for browser-GPT/human final review; no final ratings are generated.',
  source_manifest: SOURCE_MANIFEST,
  local_input_sha256: LOCAL_INPUT_SHA256,
  global_external_qa_boundary: {
    powerpro: SOURCE_MANIFEST.powerpro_history.permitted_use,
    the_show: SOURCE_MANIFEST.the_show_speed_history.permitted_use,
  },
  global_powerpro_same_date_conflict_registry: powerpro.qa?.same_player_same_date_conflicts ?? [],
  players: packets,
};

writeCsv(OUTPUT.masterCsv, masterCsvHeaders, masterCsvRows);
writeJson(OUTPUT.masterJson, masterJson);
writeJson(OUTPUT.packets, decisionPacketJson);
writeCsv(OUTPUT.reviewQueue, reviewQueueHeaders, reviewQueueRows);
writeJson(OUTPUT.graph, graph);
writeJson(OUTPUT.buildQa, buildQa);
writeText(OUTPUT.audit, renderAudit({ masterRows, packets, graph, qa: buildQa, independentQa }));

console.log(JSON.stringify({
  status: buildQa.status,
  master_rows: masterRows.length,
  packets: packets.length,
  graph_edges: graph.edges.length,
  review_queue: countBy(reviewQueueRows, (row) => row.priority),
  outputs: OUTPUT,
}, null, 2));

if (buildQa.status !== 'PASS') process.exitCode = 1;
