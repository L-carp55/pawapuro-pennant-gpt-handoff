// SP-098 only: identity/coverage QA.  This deliberately does not generate a
// 2026 practical rating, collect outside data, or enter an owner verdict.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appraiseCard, makeContext, resolveIdentity } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = rel => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));
const sha256 = rel => createHash('sha256').update(readFileSync(path.join(ROOT, rel))).digest('hex');
const norm = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');
const cfg = J('configs/ratings.json');
const rv = J('configs/run_values.json').values;
const runNorm = J('configs/running_norms.json');
const fldNorm = J('configs/fielding_norms.json');
const db = new DatabaseSync(path.join(ROOT, 'data/pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);
const checks = [];
const check = (id, pass, detail) => checks.push({ id, pass: !!pass, detail });
const q = (sql, ...args) => db.prepare(sql).all(...args);

// Independent source-of-truth rows: the assertions below compare the resolver
// output to these direct database records, not to another resolver result.
const stable = {
  nahara: {
    farm: q(`SELECT season, farm, player_id, team, name_ja FROM bm_player WHERE name_ja LIKE ? ORDER BY season`, '%名原%'),
    usage: q(`SELECT name, plate_appearances, games FROM npb_usage_2026 WHERE name LIKE ?`, '%名原%'),
    proeyeLinks: q(`SELECT DISTINCT proeye_id FROM player_link WHERE bm_id=?`, '20230057'),
    batting: q(`SELECT season, player_id FROM v_batting WHERE name LIKE ?`, '%名原%'),
  },
  santana: {
    expected: q(`SELECT season, player_id, name, team FROM v_batting
      WHERE player_id=? AND name=? AND team=? AND season=?`, '53755153', 'Ｄ．サンタナ', '東京ヤクルトスワローズ', 2025),
    other: q(`SELECT season, player_id, name, team FROM v_batting
      WHERE player_id=? AND name=? AND team=? AND season=?`, '83585138', 'Ｊ．サンタナ', '広島東洋カープ', 2019),
  },
  shiomi: {
    target: q(`SELECT season, player_id, name, team, g, pa, ab FROM v_batting
      WHERE player_id=? AND name=? AND team=? AND season=?`, '71975136', '塩見　泰隆', '東京ヤクルトスワローズ', 2025),
    fielding: q(`SELECT f.pos, f.inn FROM bm_fld f JOIN player_link l
      ON l.bm_id=f.player_id AND l.season=f.season
      WHERE l.proeye_id=? AND f.season=? AND f.farm=0 AND f.inn>0`, '71975136', 2025),
  },
};

const naharaIdentity = resolveIdentity(db, '名原 典彦', { team: '広島東洋カープ', season: 2025 });
const naharaPipeline = appraiseCard(ctx, {
  name: '名原 典彦', team: '広島東洋カープ', mode: '2025', statPrimarySpeed: true, cfg, rv, runNorm, fldNorm,
});
const naharaFarmSeasons = [...new Set(stable.nahara.farm.map(r => r.season))].sort((a, b) => a - b);
check('NAHARA_DB_STABLE_FARM_KEY',
  stable.nahara.farm.length >= 4
    && stable.nahara.farm.every(r => r.player_id === '20230057' && norm(r.name_ja) === norm('名原 典彦'))
    && naharaFarmSeasons.join(',') === '2023,2024,2025,2026',
  `bm_player id=20230057 seasons=${naharaFarmSeasons.join(',')}`);
check('NAHARA_DB_2026_USAGE',
  stable.nahara.usage.length === 1 && norm(stable.nahara.usage[0].name) === norm('名原 典彦')
    && stable.nahara.usage[0].plate_appearances === 187 && stable.nahara.usage[0].games === 41,
  `usage rows=${stable.nahara.usage.length}`);
check('NAHARA_DB_NO_PROEYE_LINK_OR_2025_BATTING',
  stable.nahara.proeyeLinks.length === 0 && stable.nahara.batting.length === 0,
  `proeye_links=${stable.nahara.proeyeLinks.length}; named_v_batting_rows=${stable.nahara.batting.length}`);
check('NAHARA_IDENTITY_CROSSWALK_NOT_PROEYE_ID',
  naharaIdentity.status === 'IDENTITY_RESOLVED_BATTING_COVERAGE_MISSING'
    && naharaIdentity.playerId === null
    && naharaIdentity.canonicalKey === 'BM_PLAYER:20230057'
    && naharaIdentity.identityEvidence?.bmPlayerId === '20230057'
    && naharaIdentity.identityEvidence?.linkedProeyeIds?.length === 0,
  JSON.stringify({ status: naharaIdentity.status, canonicalKey: naharaIdentity.canonicalKey, playerId: naharaIdentity.playerId }));
check('NAHARA_COVERAGE_MISSING_NOT_GENERIC_ERROR',
  naharaPipeline.error == null
    && naharaPipeline.status === 'IDENTITY_RESOLVED_BATTING_COVERAGE_MISSING'
    && naharaPipeline.card === null
    && naharaPipeline.batting === null
    && naharaPipeline.coverage?.targetSeason === 2025
    && naharaPipeline.coverage?.firstTeamBatting === 'MISSING',
  JSON.stringify({ status: naharaPipeline.status, coverage: naharaPipeline.coverage }));

const santanaIdentity = resolveIdentity(db, 'サンタナ', { team: '東京ヤクルトスワローズ', season: 2025 });
const santanaPipeline = appraiseCard(ctx, {
  name: 'サンタナ', team: '東京ヤクルトスワローズ', mode: '2025', statPrimarySpeed: true, cfg, rv, runNorm, fldNorm,
});
check('SANTANA_DB_EXACT_EXPECTED_RELATIONSHIP',
  stable.santana.expected.length === 1 && stable.santana.other.length === 1,
  `expected=${stable.santana.expected.length}; other_same_surname=${stable.santana.other.length}`);
check('SANTANA_EXACT_IDENTITY_FROM_STABLE_RELATIONSHIP',
  santanaIdentity.status === 'IDENTITY_RESOLVED'
    && santanaIdentity.playerId === stable.santana.expected[0]?.player_id
    && santanaIdentity.dbName === stable.santana.expected[0]?.name
    && santanaIdentity.identityEvidence?.teams?.includes(stable.santana.expected[0]?.team)
    && santanaIdentity.identityEvidence?.seasons?.includes(stable.santana.expected[0]?.season),
  JSON.stringify({ playerId: santanaIdentity.playerId, dbName: santanaIdentity.dbName, evidence: santanaIdentity.identityEvidence }));
check('SANTANA_PIPELINE_EXACT_ID',
  santanaPipeline.error == null && santanaPipeline.card?.player_id === stable.santana.expected[0]?.player_id,
  `pipeline_player_id=${santanaPipeline.card?.player_id ?? null}`);

const shiomiIdentity = resolveIdentity(db, '塩見 泰隆', { team: '東京ヤクルトスワローズ', season: 2025 });
const shiomiPipeline = appraiseCard(ctx, {
  name: '塩見 泰隆', team: '東京ヤクルトスワローズ', mode: '2025', statPrimarySpeed: true, cfg, rv, runNorm, fldNorm,
});
const shiomiAbility = shiomiPipeline.card?.abilities?.基礎能力 ?? {};
check('SHIOMI_DB_AB_ZERO',
  stable.shiomi.target.length === 1 && stable.shiomi.target[0].pa === 0 && stable.shiomi.target[0].ab === 0,
  JSON.stringify(stable.shiomi.target));
check('SHIOMI_EXACT_IDENTITY',
  shiomiIdentity.status === 'IDENTITY_RESOLVED'
    && shiomiIdentity.playerId === stable.shiomi.target[0]?.player_id
    && shiomiIdentity.dbName === stable.shiomi.target[0]?.name
    && shiomiIdentity.identityEvidence?.teams?.includes(stable.shiomi.target[0]?.team)
    && shiomiIdentity.identityEvidence?.seasons?.includes(2025),
  JSON.stringify({ playerId: shiomiIdentity.playerId, dbName: shiomiIdentity.dbName, evidence: shiomiIdentity.identityEvidence }));
check('SHIOMI_NO_BATTING_SCHEMA_PRESERVED',
  shiomiPipeline.error == null
    && shiomiPipeline.card?.player_id === stable.shiomi.target[0]?.player_id
    && shiomiPipeline.card?._no_batting_sample === true
    && shiomiAbility.ミート === null && shiomiAbility.パワー === null
    && Number.isFinite(shiomiAbility.走力?.value) && Number.isFinite(shiomiAbility.肩力?.value)
    && Object.hasOwn(shiomiAbility, '守備力')
    && Object.keys(shiomiPipeline.card ?? {}).length >= 20,
  JSON.stringify({ playerId: shiomiPipeline.card?.player_id, noBatting: shiomiPipeline.card?._no_batting_sample, ability: shiomiAbility }));
check('SHIOMI_FIELDING_CONTEXT_NOT_ERASED_BY_AB_ZERO',
  shiomiPipeline.card?.non_batting_evidence?.fielding?.status === 'NOT_AVAILABLE_NO_CURRENT_SEASON_FIELDING_INNINGS'
    && shiomiPipeline.card?.non_batting_evidence?.fielding?.positionRows === stable.shiomi.fielding.length
    && shiomiPipeline.card?.non_batting_evidence?.speed?.status === 'ESTIMATED_FROM_NON_BATTING_EVIDENCE'
    && shiomiPipeline.card?.non_batting_evidence?.arm?.status === 'ESTIMATED_FROM_NON_BATTING_EVIDENCE',
  JSON.stringify({ db_fielding_rows: stable.shiomi.fielding.length, non_batting_evidence: shiomiPipeline.card?.non_batting_evidence }));

// Negative controls: a non-empty id or a partial name must not be accepted as
// proof of the requested player.
const negative = {
  sameSurname: resolveIdentity(db, 'サンタナ', {}),
  wrongTeam: resolveIdentity(db, 'サンタナ', { team: '広島東洋カープ', season: 2025 }),
  wrongId: resolveIdentity(db, 'サンタナ', { playerId: '83585138', team: '東京ヤクルトスワローズ', season: 2025 }),
};
check('NEGATIVE_SAME_SURNAME_FAILS_AMBIGUOUS',
  negative.sameSurname.errorCode === 'AMBIGUOUS_IDENTITY' && negative.sameSurname.candidates?.length === 2,
  JSON.stringify(negative.sameSurname));
check('NEGATIVE_WRONG_TEAM_FAILS',
  negative.wrongTeam.errorCode === 'IDENTITY_CONSTRAINT_MISMATCH',
  JSON.stringify(negative.wrongTeam));
check('NEGATIVE_WRONG_ID_FAILS',
  negative.wrongId.errorCode === 'IDENTITY_CONSTRAINT_MISMATCH',
  JSON.stringify(negative.wrongId));

const pipelineSource = readFileSync(path.join(ROOT, 'src/cards/pipeline.mjs'), 'utf8');
const legacyQaSource = readFileSync(path.join(ROOT, 'scripts/sp063_090_098_043_022_072_074_075.mjs'), 'utf8');
check('NO_SELF_FULFILLING_OR_NONEMPTY_ID_CHECK',
  !pipelineSource.includes('|| !!') && !legacyQaSource.includes('|| !!'),
  'resolver and corrected historic SP-098 check contain no `|| !!` acceptance shortcut');

const passed = checks.filter(x => x.pass).length;
const failed = checks.filter(x => !x.pass).length;
const out = {
  generated_at: '2026-08-16',
  task: 'SP-098',
  mode: 'IDENTITY_COVERAGE_QA_ONLY_NOT_FINAL_2026_PRACTICAL_APPRAISAL',
  external_collection_performed: false,
  owner_verdicts_written: 0,
  direct_db_evidence: {
    nahara: {
      bm_player_id: '20230057',
      farm_seasons: naharaFarmSeasons,
      usage_2026: stable.nahara.usage,
      proeye_link_count: stable.nahara.proeyeLinks.length,
      named_v_batting_count: stable.nahara.batting.length,
    },
    santana: { exact_2025_yakult: stable.santana.expected, alternate_2019_hiroshima: stable.santana.other },
    shiomi: { '2025_first_team': stable.shiomi.target, current_fielding_rows: stable.shiomi.fielding.length },
  },
  outcomes: {
    nahara: {
      status: naharaPipeline.status,
      canonical_key: naharaPipeline.coverage?.canonicalKey ?? null,
      batting_coverage: naharaPipeline.coverage?.firstTeamBatting ?? null,
      card_generated: naharaPipeline.card != null,
    },
    santana: {
      status: santanaPipeline.error ? 'ERROR' : 'COMPUTED_FOR_QA',
      canonical_key: santanaIdentity.canonicalKey ?? null,
      player_id: santanaPipeline.card?.player_id ?? null,
    },
    shiomi: {
      status: shiomiPipeline.error ? 'ERROR' : 'COMPUTED_FOR_QA',
      player_id: shiomiPipeline.card?.player_id ?? null,
      no_batting_sample: shiomiPipeline.card?._no_batting_sample ?? null,
      non_batting_evidence: shiomiPipeline.card?.non_batting_evidence ?? null,
    },
  },
  negative_fixtures: Object.fromEntries(Object.entries(negative).map(([k, v]) => [k, {
    errorCode: v.errorCode ?? null, error: v.error ?? null,
  }])),
  checks,
  summary: { passed, failed, result: failed === 0 ? 'PASS' : 'FAIL' },
  key_input_hashes: {
    pipeline_mjs_sha256: sha256('src/cards/pipeline.mjs'),
    qa_script_sha256: sha256('scripts/sp098_identity_coverage_qa_20260816.mjs'),
    pennant_db_sha256: sha256('data/pennant.db'),
  },
};
writeFileSync(path.join(ROOT, 'outputs/derived/sp098_identity_coverage_qa_20260816.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out.summary));
if (failed) process.exitCode = 1;
