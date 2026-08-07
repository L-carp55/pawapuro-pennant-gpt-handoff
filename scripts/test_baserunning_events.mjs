// 追加進塁イベント再構築の純粋関数テスト。DB・生データ不要。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyAdvanceOutcome,
  classifyAdvanceOutcomeFromPatterns,
  runnerBase,
  sameRunner,
  makeRunnerIdentity,
  explicitPreplayBasePattern,
  explicitPostplayBasePattern,
  reconcileRunnerStateWithPattern,
  addPitchRowToPlateAppearance,
} from '../src/ratings/baserunning_events.mjs';

const B = (first = null, second = null, third = null) => ({ first, second, third });

// legacy string identity互換。
assert.equal(runnerBase('R', B(null, null, 'R')), 'third');
assert.equal(runnerBase('R', B(null, 'R', null)), 'second');
assert.equal(runnerBase('R', B()), null);

// Hybrid PBP identity: IDがあれば優先、片側欠損時だけ正規化名前で補完。
const rFull = makeRunnerIdentity('1400173.0', '野間 峻祥');
const rSameId = makeRunnerIdentity('1400173', '別表記');
const rNameOnly = makeRunnerIdentity('', '野間　峻祥');
const rConflictId = makeRunnerIdentity('9999999.0', '野間峻祥');
const A = makeRunnerIdentity('A', '走者A');
const BRunner = makeRunnerIdentity('B', '走者B');
assert.deepEqual(rFull, { id: '1400173', name: '野間峻祥' });
assert.equal(sameRunner(rFull, rSameId), true, '双方IDありならID一致で同一');
assert.equal(sameRunner(rFull, rNameOnly), true, '片側ID欠損なら名前fallback');
assert.equal(sameRunner(rFull, rConflictId), false, '双方IDありで不一致なら同名でも別人');
assert.equal(runnerBase(rFull, B(null, rNameOnly, null)), 'second', 'next stateがname-onlyでも同一走者を追える');
assert.equal(makeRunnerIdentity('', ''), null, 'IDも名前も無ければ空塁');

// descriptionの打球直前base pattern。match位置metadataの有無には依存しない。
let pat = explicitPreplayBasePattern('2球目:2アウト二塁からセンターへのヒット');
assert.equal(pat.token, '二塁'); assert.deepEqual(pat.bases, [2]);
pat = explicitPreplayBasePattern('1アウト一二塁の山田からレフトへのヒット');
assert.equal(pat.token, '一二塁'); assert.deepEqual(pat.bases, [1, 2]);
pat = explicitPreplayBasePattern('ノーアウト走者なしからライトフライ');
assert.equal(pat.token, '走者なし'); assert.deepEqual(pat.bases, []);
assert.equal(explicitPreplayBasePattern('センターへのヒット'), null);

// descriptionの打球後base patternと、identity非依存のexplicit success判定。
assert.deepEqual(explicitPostplayBasePattern('1アウト二塁からレフトへのヒットで出塁 一三塁'), { token: '一三塁', bases: [1, 3] });
assert.deepEqual(explicitPostplayBasePattern('0アウト一塁からライトへのツーベース 二三塁'), { token: '二三塁', bases: [2, 3] });
assert.equal(explicitPostplayBasePattern('1アウト二塁からセンターへのヒット'), null);
assert.equal(classifyAdvanceOutcomeFromPatterns('2nd_to_home', { bases: [2] }, { bases: [1, 3] }), 0);
assert.equal(classifyAdvanceOutcomeFromPatterns('2nd_to_home', { bases: [2] }, { bases: [1] }), 1);
assert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_home_on_2b', { bases: [1] }, { bases: [2, 3] }), 0);
assert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_home_on_2b', { bases: [1] }, { bases: [2] }), 1);
assert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_3rd', { bases: [1] }, { bases: [1, 3] }), 1);
assert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_3rd', { bases: [1] }, { bases: [1, 2] }), 0);

// stale on_*位置を明示baseへreconcile。1人なら一意に移せる。
let rec = reconcileRunnerStateWithPattern(B(A, null, null), { token: '二塁', bases: [2] }, B(A, null, null));
assert.equal(rec.status, 'RESOLVED');
assert.equal(rec.state.second, A);
assert.equal(rec.state.first, null);
// 複数runnerは順序を保って前進: 1:A,2:B -> 2:A,3:B。
rec = reconcileRunnerStateWithPattern(B(A, BRunner, null), { token: '二三塁', bases: [2, 3] }, B(A, BRunner, null));
assert.equal(rec.status, 'RESOLVED');
assert.equal(rec.state.second, A);
assert.equal(rec.state.third, BRunner);
// 1:A,2:B -> 1:A,3:B も一意。
rec = reconcileRunnerStateWithPattern(B(A, BRunner, null), { token: '一三塁', bases: [1, 3] }, B(A, BRunner, null));
assert.equal(rec.status, 'RESOLVED');
assert.equal(rec.state.first, A);
assert.equal(rec.state.third, BRunner);
// 後退が必要な配置は推測しない。
rec = reconcileRunnerStateWithPattern(B(null, A, null), { token: '一塁', bases: [1] }, B(null, A, null));
assert.equal(rec.status, 'UNCERTAIN');
// raw位置と明示配置が一致するmulti-runnerはそのまま採用可能。
rec = reconcileRunnerStateWithPattern(null, { token: '一二塁', bases: [1, 2] }, B(A, BRunner, null));
assert.equal(rec.status, 'RESOLVED');
assert.equal(rec.state.first, A);
assert.equal(rec.state.second, BRunner);

// 一塁→三塁: 三塁到達=成功、二塁止まり=失敗。
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(null, null, 'R'), 0, 0), 1);
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(null, 'R', null), 0, 0), 0);
assert.equal(classifyAdvanceOutcome('1st_to_3rd', rFull, B(null, null, rNameOnly), 0, 0), 1);
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(), 1, 1), 1);
assert.equal(classifyAdvanceOutcome('1st_to_3rd', 'R', B(), 1, 2), null);

// 二塁→本塁。
assert.equal(classifyAdvanceOutcome('2nd_to_home', 'R', B(null, null, 'R'), 0, 0), 0);
assert.equal(classifyAdvanceOutcome('2nd_to_home', 'R', B(), 0, 0), 1);
assert.equal(classifyAdvanceOutcome('2nd_to_home', 'R', B(), 0, 1), null);

// 一塁→本塁（二塁打）。
assert.equal(classifyAdvanceOutcome('1st_to_home_on_2b', 'R', B(null, null, 'R'), 2, 2), 0);
assert.equal(classifyAdvanceOutcome('1st_to_home_on_2b', 'R', B(), 2, 2), 1);
assert.equal(classifyAdvanceOutcome('1st_to_home_on_2b', 'R', B(), 1, 2), null);

// 非投球ヘッダーが先に来ても実投球first/lastを別保持し、全行も保持する。
const m = new Map();
addPitchRowToPlateAppearance(m, 'pa', { kind: 'header', on1: null }, false);
addPitchRowToPlateAppearance(m, 'pa', { kind: 'pitch', pitch: 1, on1: 'R' }, true);
addPitchRowToPlateAppearance(m, 'pa', { kind: 'pitch', pitch: 2, on1: 'R' }, true);
addPitchRowToPlateAppearance(m, 'pa', { kind: 'substitution', on1: null }, false);
assert.equal(m.get('pa').first.kind, 'header');
assert.equal(m.get('pa').firstPitch.pitch, 1);
assert.equal(m.get('pa').lastPitch.pitch, 2);
assert.equal(m.get('pa').last.kind, 'substitution');
assert.equal(m.get('pa').rows.length, 4);
assert.equal(m.get('pa').pitchRows.length, 2);

// 旧呼び出し（isPitch省略）は互換維持。
const legacy = new Map();
addPitchRowToPlateAppearance(legacy, 'pa', { pitch: 1, on1: 'R' });
addPitchRowToPlateAppearance(legacy, 'pa', { pitch: 2, on1: null });
assert.equal(legacy.get('pa').firstPitch.pitch, 1);
assert.equal(legacy.get('pa').lastPitch.pitch, 2);

// ビルダーが旧ID-only / stale raw positionへ戻らないことを静的にも固定する。
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builder = await readFile(path.join(ROOT, 'scripts', 'build_baserunning_advances.mjs'), 'utf8');
assert.match(builder, /makeRunnerIdentity/);
assert.match(builder, /explicitPreplayBasePattern/);
assert.match(builder, /reconcileRunnerStateWithPattern/);
assert.match(builder, /pitchRows/);
assert.match(builder, /nxt\.firstPitch/);
assert.ok(!builder.includes('const r1 = normId(curLast[c.on1])'));

console.log('baserunning event inference: 56 checks passed');
