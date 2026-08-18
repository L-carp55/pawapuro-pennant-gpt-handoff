// Activate SP-101 after the owner clarified that the 6-player/7-pair
// same-time comparison sample is NOT the eligible MLB The Show universe.
//
// This transition is intentionally fail-closed:
// - inventories the existing local snapshot as a LOWER BOUND only;
// - writes the expanded owner scope and Codex-ready task specification;
// - re-locks owner review;
// - supersedes the incomplete SP-078 proposal without mutating the ledger;
// - adds SP-101 to the task registry and blocks SP-079 on it.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATE = '2026-08-18';
const DB = 'data/pennant.db';
const QUEUE = 'outputs/derived/sp077_construct_complete_owner_review_queue_20260817.json';
const LEDGER = 'outputs/derived/sp078_owner_verdict_ledger_20260816.json';
const LOCK = 'docs/state/speed_owner_review_integrity_lock_20260817.json';
const REGISTRY = 'docs/state/speed_task_registry.tsv';
const CLARIFICATION = 'docs/state/speed_owner_clarification_the_show_scope_20260818.md';
const TASK = 'docs/tasks/SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md';
const CENSUS_JSON = 'outputs/derived/sp101_the_show_npb_universe_census_20260818.json';
const CENSUS_TSV = 'outputs/derived/sp101_the_show_npb_universe_census_20260818.tsv';
const CENSUS_MD = 'docs/audits/sp101_the_show_npb_universe_census_20260818.md';
const SUPERSEDE_JSON = 'outputs/derived/sp078_proposal_supersession_receipt_sp101_20260818.json';
const SUPERSEDE_MD = 'docs/audits/sp078_proposal_superseded_by_sp101_the_show_scope_20260818.md';

const full = p => path.join(ROOT, p);
const readText = p => fs.readFileSync(full(p), 'utf8');
const readJson = p => JSON.parse(readText(p));
const sha = text => createHash('sha256').update(text).digest('hex');
const norm = v => String(v ?? '').normalize('NFKC').replace(/[\s\u3000]/g, '');
const asString = v => v == null ? '' : String(v);
const uniq = xs => [...new Set(xs)];
const list = s => String(s ?? '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
const oneLine = v => String(v ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
const mkdirFor = p => fs.mkdirSync(path.dirname(full(p)), { recursive: true });
const write = (p, text) => { mkdirFor(p); fs.writeFileSync(full(p), text, 'utf8'); };
const writeJson = (p, obj) => write(p, JSON.stringify(obj, null, 2) + '\n');

const queueText = readText(QUEUE);
const queue = JSON.parse(queueText);
const ledgerText = readText(LEDGER);
const ledger = JSON.parse(ledgerText);
const lock = readJson(LOCK);
if (queue?.population?.emitted !== 100 || queue?.players?.length !== 100) throw new Error('active queue is not exact 100');
if (new Set(queue.players.map(r => r.queue_row_key)).size !== 100) throw new Error('duplicate active queue key');
if (ledger.owner_verdict_count !== 0 || ledger.records?.length !== 0) throw new Error('owner ledger is not empty');
if (ledger.queue_source?.sha256 !== lock.active_owner_review_queue_sha256) throw new Error('ledger/lock queue hash mismatch');

const db = new DatabaseSync(full(DB), { readOnly: true });
const tableExists = name => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('table','view') AND name=?").get(name));
for (const t of ['mlb_bridge','the_show_bridge','the_show_rating','pawapuro_full','pawapuro_full_link']) {
  if (!tableExists(t)) throw new Error(`required census table missing: ${t}`);
}
const all = sql => db.prepare(sql).all();
const one = sql => db.prepare(sql).get();

const mlbRows = all(`SELECT npb_name, npb_name_en, proeye_id, mlb_name, sprint_speed_avg, sprint_years FROM mlb_bridge ORDER BY npb_name`);
const showRows = all(`SELECT proeye_id, npb_name, mlb_name, name_key, editions, speed_avg, baserunning_ability_avg, baserunning_aggression_avg FROM the_show_bridge ORDER BY npb_name`);
const current = queue.players.map(r => ({
  queue_order: r.queue_order,
  queue_row_key: r.queue_row_key,
  player: r.identity?.player,
  team: r.identity?.team,
  production_player_id: r.identity?.production_player_id == null ? null : String(r.identity.production_player_id),
  stable_player_key: r.identity?.stable_player_key,
  name_key: norm(r.identity?.player),
}));
const currentName = new Map(current.map(r => [r.name_key, r]));
const currentIds = new Set(current.map(r => r.production_player_id).filter(Boolean));
const mlbNameKeys = new Set(mlbRows.map(r => norm(r.npb_name)).filter(Boolean));
const showNameKeys = new Set(showRows.map(r => norm(r.npb_name)).filter(Boolean));
const mlbIds = new Set(mlbRows.map(r => asString(r.proeye_id).trim()).filter(Boolean));
const showIds = new Set(showRows.map(r => asString(r.proeye_id).trim()).filter(Boolean));
const currentMlbNameOverlap = current.filter(r => mlbNameKeys.has(r.name_key));
const currentShowNameOverlap = current.filter(r => showNameKeys.has(r.name_key));
const currentMlbIdOverlap = current.filter(r => r.production_player_id && mlbIds.has(r.production_player_id));
const currentShowIdOverlap = current.filter(r => r.production_player_id && showIds.has(r.production_player_id));
const editionRows = all(`SELECT edition, COUNT(*) AS rows, COUNT(DISTINCT name_key) AS unique_name_keys FROM the_show_rating GROUP BY edition ORDER BY edition`);
const seriesRows = all(`SELECT series, COUNT(*) AS rows, COUNT(DISTINCT name_key) AS unique_name_keys FROM the_show_rating GROUP BY series ORDER BY rows DESC`);
const showRating = one(`SELECT COUNT(*) AS rows, COUNT(DISTINCT name_key) AS unique_name_keys FROM the_show_rating`);
const pawa = one(`SELECT COUNT(*) AS rows, COUNT(DISTINCT CASE WHEN name_norm IS NOT NULL AND TRIM(name_norm)<>'' THEN name_norm END) AS unique_name_norms, COUNT(DISTINCT work) AS works, MIN(work) AS min_work, MAX(work) AS max_work FROM pawapuro_full`);
const pawaLink = one(`SELECT COUNT(*) AS rows, COUNT(DISTINCT CASE WHEN proeye_id IS NOT NULL AND TRIM(proeye_id)<>'' THEN proeye_id END) AS unique_linked_proeye_ids FROM pawapuro_full_link`);
const live = seriesRows.find(r => String(r.series).toLowerCase() === 'live') ?? null;

const ownerRaisedExamples = ['ソト','サンタナ','カリステ','ポランコ','モンテロ','鈴木誠也','吉田正尚']
  .map(name => ({
    player: name,
    in_current100: currentName.has(norm(name)),
    in_local_mlb_bridge: mlbNameKeys.has(norm(name)),
    in_local_the_show_bridge: showNameKeys.has(norm(name)),
    role: ['鈴木誠也','吉田正尚'].includes(name)
      ? 'JAPANESE_NPB_TO_MLB_CALIBRATION_OR_TRAJECTORY_COHORT'
      : 'CURRENT_OR_RETURNING_NPB_PLAYER_CANDIDATE',
  }));

const externalReceipts = [
  {
    repository: 'L-carp55/claude-code-hub',
    branch: 'codex/mlb-the-show-speed-history',
    commit: '97c429521267cfb70ccdd61e40e11853d100e360',
    audit: 'docs/audits/mlb_the_show_speed_history_audit.md',
    role: 'LONGITUDINAL_SPEED_SOURCE_AND_IDENTITY_ASSETS',
    note: 'Contains a much larger The Show history/crosswalk asset than the local 47-row bridge. Existing local bridge size is not an eligibility ceiling.',
  },
  {
    repository: 'L-carp55/claude-code-hub',
    branch: 'codex/mlb-the-show-speed-temporal-rescue',
    commit: 'ab5adbfee656d69d0b378145fd66bf5789e0d1b4',
    role: 'OFFICIAL_OR_ARCHIVED_ROSTER_UPDATE_SPEED_EVENTS',
    note: 'Preserves explicit player-level speed changes where reproducible and distinguishes primary/secondary/non-reproducible events.',
  },
  {
    repository: 'L-carp55/claude-code-hub',
    branch: 'codex/mlb-the-show-full-attributes',
    commit: '74d2a2278ab7bcea3f6368e1df6ba03e2dd82554',
    audit: 'docs/audits/mlb_the_show_full_attribute_history_2017_2026.md',
    reported_observed_editions: ['MLB21','MLB22','MLB23','MLB24','MLB25','MLB26'],
    reported_missing_editions: ['MLB17','MLB18','MLB19','MLB20'],
    reported_live_rows: 12441,
    reported_unique_players: 11945,
    role: 'LIVE_ROSTER_MULTI_ATTRIBUTE_PANEL_SPEED_SEPARATE_FROM_BASERUNNING',
  },
];

const eligibleCohorts = [
  {
    cohort: 'CURRENT100_MLB_PROMOTION_OR_APPEARANCE',
    inclusion: 'Every current-100 player with any MLB regular-season promotion/appearance and any eligible The Show Live roster observation, regardless of whether the The Show observation predates or postdates the current NPB season.',
  },
  {
    cohort: 'HISTORICAL_NPB_BEFORE_2026_WITH_MLB_THE_SHOW',
    inclusion: 'Every player who appeared in NPB before 2026 and has MLB/The Show evidence, including players absent from the current-100 cohort.',
  },
  {
    cohort: 'NPB_TO_MLB_JAPANESE',
    inclusion: 'Japanese NPB players who moved to MLB, including players still in MLB; used for cross-league transition and game-scale calibration as well as player-specific trajectory where temporally relevant.',
  },
  {
    cohort: 'MLB_TO_NPB_FOREIGN',
    inclusion: 'Foreign players with MLB/The Show history who later entered NPB, including first-time NPB imports.',
  },
  {
    cohort: 'NPB_TO_MLB_TO_NPB_RETURNEE',
    inclusion: 'Japanese and foreign returnees whose NPB→MLB→NPB sequence supplies before/after transition evidence.',
  },
  {
    cohort: 'MLB_TO_NPB_TO_MLB_OR_MULTI_CYCLE',
    inclusion: 'Players with repeated league transitions; each segment remains separate and time-indexed rather than collapsed to one average.',
  },
  {
    cohort: 'HISTORICAL_CALIBRATION_POPULATION',
    inclusion: 'All historical NPB/PowerPro players with MLB/The Show overlap, even when not current-100, for scale-shape, ordinal, temporal-decay and transition QA.',
  },
];
const evidenceRoles = [
  { role: 'DIRECT_PHYSICAL', source: 'Statcast Sprint Speed/T10/T30/T90 or other direct measurements', use: 'Physical evidence with season/protocol/source controls.' },
  { role: 'SAME_OR_NEAR_TIME_CROSS_GAME_QA', source: 'The Show Live Speed and PowerPro around the same season', use: 'Strongest external game-appraisal comparison; player-clustered evaluation required.' },
  { role: 'CROSS_TIME_PLAYER_TRAJECTORY', source: 'The Show before/after the NPB appraisal season', use: 'Player-specific prior/trajectory with explicit temporal, age, injury and league-transition discount; never silently copied as current rating.' },
  { role: 'TRANSITION_CALIBRATION', source: 'NPB→MLB, MLB→NPB and returnee cohorts', use: 'Estimate systematic league/game translation and uncertainty by transition direction and time gap.' },
  { role: 'POPULATION_SCALE_SHAPE_QA', source: 'Historical NPB/PowerPro × MLB measurement × The Show panel', use: 'Test rating range, rank ordering, compression, nonlinearities and tails without treating either game as truth.' },
  { role: 'TECHNIQUE_SEPARATION', source: 'The Show Speed vs Stealing/Baserunning Aggressiveness', use: 'Keep physical speed distinct from technique/aggression. Live/base attributes primary; non-Live cards isolated.' },
];

const census = {
  schema_version: 'sp101_the_show_npb_universe_census_20260818',
  generated_at: DATE,
  status: 'LOWER_BOUND_EXISTING_SNAPSHOT_NOT_COMPLETE_UNIVERSE',
  owner_clarification: 'The 6-player/7-pair same-time overlap is a narrow identifiability sample, not the MLB The Show eligible player universe.',
  active_queue: { path: QUEUE, sha256: sha(queueText), players: current.length },
  local_snapshot: {
    database: DB,
    mlb_bridge: {
      rows: mlbRows.length,
      unique_npb_names: new Set(mlbRows.map(r => norm(r.npb_name)).filter(Boolean)).size,
      nonempty_proeye_ids: mlbIds.size,
    },
    the_show_bridge: {
      rows: showRows.length,
      unique_npb_names: new Set(showRows.map(r => norm(r.npb_name)).filter(Boolean)).size,
      nonempty_proeye_ids: showIds.size,
    },
    the_show_rating: {
      rows: Number(showRating.rows),
      unique_name_keys: Number(showRating.unique_name_keys),
      editions: editionRows.map(r => ({ edition: r.edition, rows: Number(r.rows), unique_name_keys: Number(r.unique_name_keys) })),
      live_series: live ? { rows: Number(live.rows), unique_name_keys: Number(live.unique_name_keys) } : null,
      series_breakdown: seriesRows.map(r => ({ series: r.series, rows: Number(r.rows), unique_name_keys: Number(r.unique_name_keys) })),
    },
    powerpro_npb_history_universe: {
      rows: Number(pawa.rows),
      unique_name_norms: Number(pawa.unique_name_norms),
      works: Number(pawa.works),
      min_work: pawa.min_work,
      max_work: pawa.max_work,
      linked_rows: Number(pawaLink.rows),
      unique_linked_proeye_ids: Number(pawaLink.unique_linked_proeye_ids),
    },
  },
  current100_bridge_diagnostic: {
    exact_proeye_id_overlap_with_mlb_bridge: currentMlbIdOverlap.length,
    exact_proeye_id_overlap_with_the_show_bridge: currentShowIdOverlap.length,
    normalized_name_overlap_with_mlb_bridge: currentMlbNameOverlap.map(r => r.player),
    normalized_name_overlap_with_the_show_bridge: currentShowNameOverlap.map(r => r.player),
    interpretation: 'Zero exact-ID overlap and only 4/2 normalized-name overlaps diagnose an incomplete/stale crosswalk or namespace mismatch. They do not bound MLB/The Show eligibility.',
  },
  owner_raised_examples: ownerRaisedExamples,
  eligible_cohorts: eligibleCohorts,
  evidence_roles: evidenceRoles,
  external_source_receipts: externalReceipts,
  negative_findings: [
    'The local 79-row MLB bridge and 47-row The Show bridge are historical lower-bound snapshots, not complete NPB↔MLB universes.',
    'A nonempty local bridge proeye_id does not guarantee compatibility with the current-100 production_player_id namespace; current exact overlap is zero.',
    'The Show special/non-Live cards cannot be mixed with Live roster speed without an explicit separate role.',
    'The same player may have multiple transition segments and editions; averaging them into one lifetime value destroys the evidence needed for temporal inference.',
    'The prior 6-player/7-pair same-time sample remains a valid negative finding for an unrestricted direct numeric bridge, but it cannot justify excluding all other player-year evidence.',
  ],
  not_yet_identified: [
    'Final count of all NPB-before-2026 players with MLB promotion/appearance and The Show Live history.',
    'Complete current-100 MLB-experience coverage after canonical identity reconstruction.',
    'Complete NPB→MLB→NPB and multi-cycle transition taxonomy.',
    'Player-season temporal alignment between NPB, MLB, PowerPro, The Show and direct physical measurements.',
  ],
};
writeJson(CENSUS_JSON, census);

const censusHeaders = ['scope','player','in_current100','in_local_mlb_bridge','in_local_the_show_bridge','role'];
const censusTsv = [
  censusHeaders.join('\t'),
  ...ownerRaisedExamples.map(r => ['OWNER_RAISED_EXAMPLE',r.player,r.in_current100,r.in_local_mlb_bridge,r.in_local_the_show_bridge,r.role].map(oneLine).join('\t')),
  ...currentMlbNameOverlap.map(r => ['CURRENT100_LOCAL_MLB_NAME_OVERLAP',r.player,true,true,showNameKeys.has(r.name_key),'LOWER_BOUND_ONLY'].map(oneLine).join('\t')),
  ...currentShowNameOverlap.map(r => ['CURRENT100_LOCAL_SHOW_NAME_OVERLAP',r.player,true,mlbNameKeys.has(r.name_key),true,'LOWER_BOUND_ONLY'].map(oneLine).join('\t')),
  '',
].join('\n');
write(CENSUS_TSV, censusTsv);

const clarificationMd = [
  '# Owner clarification — MLB The Show eligible scope for speed appraisal',
  '',
  `Date: ${DATE}`,
  '',
  '## Binding clarification',
  '',
  'The previously cited **6 players / 7 same-time pairs** describe only the narrow sample available for testing an unrestricted same-time The Show→PowerPro numeric conversion. They are **not** the population of players for whom MLB The Show evidence can be used.',
  '',
  'The eligible evidence universe includes every NPB-linked player with MLB promotion/appearance and eligible The Show history, including:',
  '',
  ...eligibleCohorts.map(x => `- **${x.cohort}:** ${x.inclusion}`),
  '',
  '## How cross-time evidence must be used',
  '',
  '- A The Show value from before or after the NPB season remains evidence. Time mismatch changes its role and weight; it does not erase the record.',
  '- Same/near-time rows are strongest for cross-game comparison.',
  '- Cross-time rows are player-specific trajectory/priors and transition evidence, with explicit age, injury, league and time-gap treatment.',
  '- Historical players outside the current 100 are required for population-scale and league-transition calibration.',
  '- Direct Statcast measurements are physical evidence; The Show Speed is an external game appraisal, never a direct physical measurement.',
  '- The Show Speed must remain separate from Stealing and Baserunning Aggressiveness.',
  '- Live/base roster rows are the primary numeric panel. WBC, Flashback, Finest and other non-Live cards are isolated context unless separately justified.',
  '',
  '## Clarification of SR-060',
  '',
  'SR-060 closes an **unrestricted direct cross-time conversion path** from old The Show values to a current PowerPro number. It does not authorize discarding The Show player-year history, transition cohorts, trajectory evidence, ordinal information or population-level scale-shape QA.',
  '',
  'Any future claim that The Show is usable for only the 6-player/7-pair sample is therefore invalid.',
  '',
  `Measured lower-bound census: \`${CENSUS_JSON}\``,
  '',
].join('\n');
write(CLARIFICATION, clarificationMd + '\n');

const taskMd = [
  '# SP-101 — Expanded MLB The Show × NPB evidence universe rebuild',
  '',
  'Status: **PARTIAL / READY FOR CODEX DISPATCH / OWNER REVIEW BLOCKER**',
  '',
  '## Objective',
  '',
  'Build a canonical, time-indexed NPB↔MLB↔MLB The Show↔PowerPro evidence universe, then regenerate player-level speed evidence packets so that every eligible MLB-experienced player and every relevant historical calibration player is available to the final speed appraisal.',
  '',
  '## Why this is necessary',
  '',
  '- The prior 6-player/7-pair sample was incorrectly treated as if it bounded The Show applicability.',
  '- The local `mlb_bridge` (79 rows) and `the_show_bridge` (47 rows) are incomplete snapshots and have zero exact-ID overlap with the current-100 production IDs.',
  '- Historical NPB players, Japanese NPB→MLB players, foreign MLB→NPB players, and NPB→MLB→NPB returnees are required for temporal and league-transition inference.',
  '- The current SP-078 proposal is not approval-ready and the owner ledger remains empty.',
  '',
  '## Source inputs',
  '',
  '- Destination repo/active baseline: `L-carp55/pawapuro-pennant-gpt-handoff` / `review/opus-speed-pre-owner-review-wave-20260816`.',
  '- Source repo: `L-carp55/claude-code-hub`.',
  '- `codex/mlb-the-show-speed-history` @ `97c429521267cfb70ccdd61e40e11853d100e360`.',
  '- `codex/mlb-the-show-speed-temporal-rescue` @ `ab5adbfee656d69d0b378145fd66bf5789e0d1b4`.',
  '- `codex/mlb-the-show-full-attributes` @ `74d2a2278ab7bcea3f6368e1df6ba03e2dd82554`.',
  '- Destination `data/pennant.db`: `mlb_bridge`, `the_show_bridge`, `the_show_rating`, `pawapuro_full`, `pawapuro_full_link`, NPB roster/link tables.',
  '- Current-100 queue and all existing PowerPro/physical/Community receipts.',
  '',
  '## Target branch / worktree',
  '',
  '- Branch: `codex/speed-sp101-expanded-the-show-universe-20260818`.',
  '- Start from the latest remote HEAD of `review/opus-speed-pre-owner-review-wave-20260816` after this task activation commit.',
  '- Use a separate worktree. Do not modify or force-push the review branch directly.',
  '',
  '## Parallel agent plan',
  '',
  'Use multiple independent sub-agents. Each agent writes separate intermediate files; no two agents edit the same final file. Only the parent agent integrates.',
  '',
  '1. **Identity agent** — enumerate all NPB-before-2026 players and current-100 players with MLB promotion/appearance; build canonical NPB/ProEye/MLBAM/The Show UUID/name crosswalk with ambiguity states.',
  '2. **The Show panel agent** — isolate Live/base roster speed by edition/player-year, preserve roster-update events, and quarantine WBC/Flashback/Finest/non-Live cards.',
  '3. **NPB/PowerPro timeline agent** — build NPB roster and PowerPro trajectories for all crosswalked players, including players no longer in NPB.',
  '4. **Transition agent** — classify NPB→MLB, MLB→NPB, NPB→MLB→NPB and multi-cycle segments; align time gaps, age/injury receipts and direct Statcast measurements.',
  '5. **Model/role agent** — produce same-time, cross-time, ordinal, transition and population-scale evidence roles without an unrestricted direct label bridge.',
  '6. **Independent QA agent** — red-team identity leakage, card-row leakage, duplicate players, special-card contamination, temporal leakage, missing cohorts and false exclusions.',
  '',
  '## Required outputs',
  '',
  '- `data/manual/sp101_npb_mlb_the_show_identity_crosswalk.csv`',
  '- `outputs/derived/sp101_the_show_live_player_year_panel.jsonl.gz`',
  '- `outputs/derived/sp101_the_show_roster_update_speed_events.csv`',
  '- `outputs/derived/sp101_npb_mlb_transition_segments.csv`',
  '- `outputs/derived/sp101_powerpro_the_show_temporal_pairs.csv`',
  '- `outputs/derived/sp101_historical_npb_the_show_calibration_panel.csv`',
  '- `outputs/derived/sp101_current100_the_show_evidence.json`',
  '- `outputs/derived/sp101_coverage_qa.json`',
  '- `docs/audits/sp101_expanded_the_show_npb_universe.md`',
  '',
  '## Required per-row fields',
  '',
  '- stable identity keys and every source identifier',
  '- NPB season(s), MLB season(s), The Show edition/update date, PowerPro work/version',
  '- transition direction and segment number',
  '- Live/non-Live status and card/roster provenance',
  '- Speed, Stealing and Baserunning Aggressiveness in separate fields',
  '- direct Statcast measurements in separate physical fields',
  '- temporal gap, age/injury availability, confidence and ambiguity state',
  '- evidence role: same-time QA, cross-time trajectory, transition calibration, ordinal context, population scale-shape, excluded-with-reason',
  '',
  '## Non-scope',
  '',
  '- Do not write SP-078 owner verdicts.',
  '- Do not run SP-079 final ratings.',
  '- Do not start shoulder appraisal.',
  '- Do not copy a The Show value directly into a current PowerPro/NPB rating.',
  '- Do not mix non-Live special cards into the Live numeric panel.',
  '- Do not average multiple transition segments or editions into one lifetime number.',
  '',
  '## QA requirements',
  '',
  '- Enumerate the final eligible universe and prove it is not capped at 6/7, 47 or 79.',
  '- Current-100 coverage: every player gets `ELIGIBLE_MATCHED`, `NO_MLB_PROMOTION_FOUND`, `IDENTITY_UNRESOLVED`, or `THE_SHOW_DATA_MISSING_AFTER_MLB_MATCH`; no silent omission.',
  '- Historical NPB coverage: every NPB-before-2026 player is screened for MLB promotion/The Show history.',
  '- Identity joins use IDs where available; name-only matches require explicit ambiguity evidence and negative controls.',
  '- Player-clustered holdout/CV; never split cards/editions of one player across train and test.',
  '- Same measurement/card/update duplicates are deduplicated with preserved provenance.',
  '- Live/non-Live contamination count must be zero in the primary panel.',
  '- Speed/Stealing/Baserunning fields must never be collapsed.',
  '- Temporal and league-transition features must be visible and perturbation-tested.',
  '- Important negative findings, failed methods and unresolved identities must be written to the audit, not left in the Codex final chat.',
  '',
  '## Definition of Done',
  '',
  '- `Codex final answer only` contains zero important findings.',
  '- All required outputs exist, parse and are committed.',
  '- Coverage and identity QA pass with explicit denominators.',
  '- All eligible cohorts above are represented or have bounded missingness.',
  '- Current-100 The Show evidence packets are ready to enter the requirements-to-decision utilization rebuild.',
  '- Commit and push the branch; report remote SHA and verify it matches local HEAD.',
  '',
].join('\n');
write(TASK, taskMd + '\n');

const censusMd = [
  '# SP-101 MLB The Show × NPB universe lower-bound census',
  '',
  'Status: **MEASURED LOWER BOUND — NOT COMPLETE UNIVERSE**',
  '',
  '## What this proves',
  '',
  '- The 6-player/7-pair sample cannot be used as an eligibility count.',
  `- The existing local snapshot already contains MLB bridge **${mlbRows.length}** players and The Show bridge **${showRows.length}** players.`,
  `- The local The Show rating table contains **${showRating.rows}** rows / **${showRating.unique_name_keys}** unique name keys; Live rows are **${live?.rows ?? '—'}**.`,
  `- The PowerPro/NPB history table contains **${pawa.unique_name_norms}** distinct normalized names across ${pawa.min_work}–${pawa.max_work}.`,
  `- Exact current-100 production-ID overlap is MLB=${currentMlbIdOverlap.length}, The Show=${currentShowIdOverlap.length}; name overlap is MLB=${currentMlbNameOverlap.length}, The Show=${currentShowNameOverlap.length}. This is a crosswalk defect/lower bound, not evidence that only those players are eligible.`,
  '',
  '## Current local name overlaps',
  '',
  `- MLB bridge: ${currentMlbNameOverlap.map(r => r.player).join('、') || 'none'}`,
  `- The Show bridge: ${currentShowNameOverlap.map(r => r.player).join('、') || 'none'}`,
  '',
  '## External source inventory',
  '',
  '- `claude-code-hub` contains a substantially larger longitudinal The Show panel, roster-update rescue, full Live attributes and identity assets.',
  '- The full-attributes audit reports observed Live snapshots for MLB21–MLB26, 12,441 Live rows and 11,945 unique players; MLB17–20 remain uncollected in that snapshot.',
  '- These counts are source inventory, not the final NPB-linked eligible count. SP-101 must perform the NPB↔MLB↔The Show identity intersection and transition segmentation.',
  '',
  '## Correct interpretation of the former 7-pair result',
  '',
  'It remains evidence that a universal, unrestricted same-time The Show→PowerPro numeric conversion was not identifiable from that narrow overlap. It does **not** invalidate:',
  '',
  '- other seasons for the same players;',
  '- Japanese NPB→MLB players;',
  '- foreign MLB→NPB players;',
  '- NPB→MLB→NPB returnees;',
  '- historical NPB players outside the current 100;',
  '- transition, trajectory, ordinal or population-scale uses.',
  '',
  `Machine-readable census: \`${CENSUS_JSON}\``,
  '',
].join('\n');
write(CENSUS_MD, censusMd + '\n');

// Append SP-101 and make SP-079 explicitly depend on it.
const registryRaw = readText(REGISTRY).replace(/^\uFEFF/, '').trimEnd();
const registryLines = registryRaw.split(/\r?\n/);
const header = registryLines[0].split('\t');
const requiredHeader = ['task_id','status','category','requirement_ids','owner_review_block','gate_block','depends_on','title','next_action_or_blocker','artifacts'];
if (JSON.stringify(header) !== JSON.stringify(requiredHeader)) throw new Error(`unexpected task registry header: ${header.join('|')}`);
const rows = registryLines.slice(1).filter(Boolean).map((line, i) => {
  const cells = line.split('\t');
  if (cells.length !== header.length) throw new Error(`registry line ${i+2}: ${cells.length} cells, expected ${header.length}`);
  return Object.fromEntries(header.map((h,j) => [h,cells[j]]));
});
if (rows.some(r => r.task_id === 'SP-101')) throw new Error('SP-101 already exists; activation script is intentionally single-use');
const sp079 = rows.find(r => r.task_id === 'SP-079');
if (!sp079) throw new Error('SP-079 missing from registry');
sp079.status = 'BLOCKED_DEPENDENCY';
sp079.owner_review_block = '1';
sp079.gate_block = '1';
sp079.depends_on = uniq([...list(sp079.depends_on), 'SP-101']).join(',');
sp079.next_action_or_blocker = 'BLOCKED by SP-101 expanded MLB The Show × NPB universe rebuild and refreshed all-100 requirements-to-decision utilization review. Do not run final practical reappraisal from the superseded SP-078 proposal.';
rows.push({
  task_id: 'SP-101',
  status: 'PARTIAL',
  category: 'data',
  requirement_ids: 'SR-023,SR-024,SR-025,SR-026,SR-055,SR-058,SR-060',
  owner_review_block: '1',
  gate_block: '1',
  depends_on: 'SP-050,SP-051,SP-052,SP-059,SP-077',
  title: 'Expanded MLB The Show × NPB eligible universe, identity crosswalk, transition panel and current-100 evidence integration',
  next_action_or_blocker: 'EVIDENCE_STATUS=MEASURED_BOUNDED. Existing 79-player MLB bridge / 47-player The Show bridge and 6-player/7-pair same-time sample are lower bounds, not the eligible universe. Dispatch the parallel Codex task in SP101_EXPANDED_THE_SHOW_NPB_UNIVERSE_20260818.md; enumerate all NPB-before-2026 × MLB-promotion × The Show cohorts, repair identities, build time-indexed transition panels, and regenerate evidence-use receipts before any SP-078 approval.',
  artifacts: [CLARIFICATION,TASK,CENSUS_JSON,CENSUS_TSV,CENSUS_MD,SUPERSEDE_JSON,SUPERSEDE_MD].join(';'),
});
const registryOut = [header.join('\t'), ...rows.map(r => header.map(h => oneLine(r[h])).join('\t')), ''].join('\n');
write(REGISTRY, registryOut);

const oldLockSnapshot = {
  locked: lock.locked,
  unlocked_at: lock.unlocked_at ?? null,
  unlock_status: lock.unlock_status ?? null,
  active_owner_review_queue_sha256: lock.active_owner_review_queue_sha256,
  owner_verdict_count_at_unlock: lock.owner_verdict_count_at_unlock,
};
lock.locked = true;
lock.reason_code = 'THE_SHOW_ELIGIBLE_UNIVERSE_UNDERCOUNT_AND_EVIDENCE_UTILIZATION_INCOMPLETE';
lock.summary = 'Owner clarification established that the 6-player/7-pair same-time The Show comparison sample was incorrectly treated as the usable player universe. The eligible scope includes all NPB-before-2026 players with MLB promotion/appearance and The Show history, including Japanese NPB→MLB players, foreign MLB→NPB players, returnees and historical calibration cohorts. Existing local bridges are incomplete lower bounds and the current SP-078 proposal did not consume this universe. The ledger remains empty. Owner review is re-locked pending SP-101 identity, temporal-transition, coverage and decision-utilization QA.';
lock.invalidated_actions = uniq([
  ...(lock.invalidated_actions ?? []),
  'approve or capture any verdict from sp078_owner_verdict_proposal_20260818.json',
  'treat 6 players / 7 pairs, 47 The Show bridge rows, or 79 MLB bridge rows as an eligibility ceiling',
  'run SP-079 before SP-101 and a rebuilt all-100 utilization review are validated',
  'claim all usable MLB The Show evidence has been consumed',
]);
lock.preserved_valid_work = uniq([
  ...(lock.preserved_valid_work ?? []),
  'direct Statcast/T10/T30/T90 measurements already collected',
  'MLB The Show source panels and audits in L-carp55/claude-code-hub',
  'the active 100-row construct queue as evidence infrastructure, not an approval-complete packet',
]);
lock.relocked_at = '2026-08-18T00:00:00+09:00';
lock.relock_trigger = 'owner clarification: every MLB-promoted NPB-linked player and historical transition cohort is eligible for role-appropriate The Show use';
lock.unlock_status = 'RELOCKED_PENDING_SP101_EXPANDED_THE_SHOW_SCOPE';
lock.superseded_unlock_receipt_20260818 = oldLockSnapshot;
lock.sp101_scope_clarification = CLARIFICATION;
lock.sp101_task = TASK;
lock.sp101_lower_bound_census = CENSUS_JSON;
lock.sp101_unlock_conditions = [
  'all NPB-before-2026 players are screened for MLB promotion/appearance and The Show Live history with explicit denominator',
  'all current-100 players receive an explicit MLB/The Show coverage state with no silent omission',
  'canonical NPB/ProEye/MLBAM/The Show identity crosswalk passes ambiguity and negative-control QA',
  'NPB→MLB, MLB→NPB, NPB→MLB→NPB and multi-cycle transition segments are time-indexed',
  'The Show Live Speed remains separate from Stealing/Baserunning Aggressiveness and non-Live cards',
  'same-time, cross-time, trajectory, transition and population-scale roles are separately represented',
  'requirements-to-decision utilization receipts prove availability and actual decision influence for all 100 players',
  'a new SP-078 proposal is generated from the rebuilt review while the canonical ledger remains empty',
  'registry, construct, identity, coverage, determinism and SP-078 integrity QA all pass',
];
writeJson(LOCK, lock);

const supersession = {
  schema_version: 'sp078_proposal_supersession_receipt_sp101_20260818',
  generated_at: DATE,
  status: 'SUPERSEDED_NOT_APPROVABLE_PENDING_SP101',
  superseded_artifacts: [
    'outputs/derived/speed_all100_integrated_owner_review_20260818.json',
    'outputs/derived/speed_all100_owner_review_adjudicated_20260818.json',
    'outputs/derived/sp078_owner_verdict_proposal_20260818.json',
    'docs/reports/sp078_owner_verdict_proposal_20260818.md',
  ],
  reason_codes: [
    'INCOMPLETE_REQUIREMENTS_TO_DECISION_UTILIZATION',
    'THE_SHOW_ELIGIBLE_UNIVERSE_UNDERCOUNT',
    'CURRENT100_AND_HISTORICAL_NPB_MLB_IDENTITY_CROSSWALK_INCOMPLETE',
    'ALL100_INDIVIDUAL_ADJUDICATION_NOT_PROVEN',
  ],
  correcting_task: 'SP-101',
  owner_verdict_ledger: { path: LEDGER, sha256: sha(ledgerText), records: ledger.records.length, owner_verdict_count: ledger.owner_verdict_count },
  active_queue: { path: QUEUE, sha256: sha(queueText), players: queue.players.length },
  clarification: CLARIFICATION,
  census: CENSUS_JSON,
  replacement_rule: 'Do not approve or capture the superseded proposal. Complete SP-101, rebuild the all-100 requirements-to-decision review, then generate a new proposal.',
};
writeJson(SUPERSEDE_JSON, supersession);
const supersedeMd = [
  '# SP-078 proposal supersession — expanded MLB The Show scope',
  '',
  'Status: **SUPERSEDED / NOT APPROVABLE / LEDGER UNCHANGED**',
  '',
  'The current owner-verdict proposal is superseded because it did not use the full eligible MLB The Show × NPB evidence universe. The 6-player/7-pair sample was only a narrow same-time numeric-bridge test, not an eligibility ceiling.',
  '',
  'SP-101 must first enumerate and integrate:',
  '',
  '- all current-100 MLB-promoted/appeared players;',
  '- all historical NPB-before-2026 players with MLB/The Show history;',
  '- Japanese NPB→MLB players;',
  '- foreign MLB→NPB players;',
  '- NPB→MLB→NPB returnees and multi-cycle transitions;',
  '- historical calibration populations outside the current 100.',
  '',
  `The canonical SP-078 ledger remains empty: \`${LEDGER}\``,
  '',
  `Machine receipt: \`${SUPERSEDE_JSON}\``,
  '',
].join('\n');
write(SUPERSEDE_MD, supersedeMd + '\n');

if (sha(readText(LEDGER)) !== sha(ledgerText)) throw new Error('SP-078 ledger mutated');
console.log(JSON.stringify({
  status: 'PASS',
  task: 'SP-101',
  current100: current.length,
  localLowerBounds: {
    mlbBridge: mlbRows.length,
    theShowBridge: showRows.length,
    theShowRatingRows: Number(showRating.rows),
    theShowUniqueNameKeys: Number(showRating.unique_name_keys),
    liveRows: live ? Number(live.rows) : null,
    powerproNpbUniqueNames: Number(pawa.unique_name_norms),
  },
  current100Overlap: {
    mlbExactId: currentMlbIdOverlap.length,
    showExactId: currentShowIdOverlap.length,
    mlbName: currentMlbNameOverlap.map(r => r.player),
    showName: currentShowNameOverlap.map(r => r.player),
  },
  ownerReviewLocked: lock.locked,
  ownerVerdictCount: ledger.owner_verdict_count,
  sp079DependsOnSp101: true,
}));
