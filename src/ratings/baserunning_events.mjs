// 1球データから追加進塁イベントを作るための純粋関数。
//
// 重要な規律:
// - PBPには打席見出し・投手交代等の非投球行が混ざる。
// - 追加進塁の起点は打球が起きた最終実投球行、打球後状態は次打席の最初の実投球行。
// - Release PBPでは on_* のplayer IDが空でも on_*_name が入る行がある。
//   したがって塁占有・走者同一性をIDだけで判定しない。
// - on_* の「塁位置」は打席途中の盗塁/暴投後も古い位置を保持する場合がある。
//   description_jap が「二塁から」「一二塁から」等の打球直前配置を明示する場合は、
//   known runner identityをその配置へ保守的にreconcileする。
// - 複数runnerの割当が一意に決まらない場合は推測せず uncertain とする。
// - 「次打席で走者が消えた」だけでは生還と判定しない。
//   同じプレーでアウト数が増えた場合は走塁死等と区別できないため null（除外）にする。

const normalizeName = s => String(s ?? '').normalize('NFKC').replace(/[\s　]/g, '') || null;
const normalizeId = s => {
  const v = String(s ?? '').trim();
  if (!v || v === '0' || v === '0.0' || v === 'nan' || v === 'None') return null;
  return v.replace(/\.0$/, '');
};

const BASE_PATTERN_MAP = new Map([
  ['満塁', [1, 2, 3]], ['一二三塁', [1, 2, 3]], ['1,2,3塁', [1, 2, 3]],
  ['一二塁', [1, 2]], ['1,2塁', [1, 2]],
  ['一三塁', [1, 3]], ['1,3塁', [1, 3]],
  ['二三塁', [2, 3]], ['2,3塁', [2, 3]],
  ['一塁', [1]], ['1塁', [1]],
  ['二塁', [2]], ['2塁', [2]],
  ['三塁', [3]], ['3塁', [3]],
  ['走者なし', []],
]);
const BASE_PATTERN_TOKEN = '(満塁|一二三塁|一二塁|一三塁|二三塁|一塁|二塁|三塁|1,2,3塁|1,2塁|1,3塁|2,3塁|1塁|2塁|3塁|走者なし)';
const PREPLAY_PATTERNS = [
  new RegExp(`(?:^|[0-3]アウト|ノーアウト|無死|一死|二死|ランナー)${BASE_PATTERN_TOKEN}(?:の|から)`),
  new RegExp(`^${BASE_PATTERN_TOKEN}(?:の|から)`),
];

/** PBP上の走者identity。ID/名前の片方だけでも占有走者として有効。 */
export function makeRunnerIdentity(id, name) {
  const out = { id: normalizeId(id), name: normalizeName(name) };
  return out.id || out.name ? out : null;
}

/**
 * 同一走者判定。
 * - legacy string同士は完全一致。
 * - object同士で双方にIDがあるならIDだけで判定。
 * - どちらかのIDが欠ける場合のみname fallback。
 */
export function sameRunner(a, b) {
  if (!a || !b) return false;
  if (typeof a === 'string' || typeof b === 'string') {
    return typeof a === 'string' && typeof b === 'string' && a === b;
  }
  const aid = normalizeId(a.id), bid = normalizeId(b.id);
  if (aid && bid) return aid === bid;
  const an = normalizeName(a.name), bn = normalizeName(b.name);
  return !!(an && bn && an === bn);
}

export function emptyRunnerState() {
  return { first: null, second: null, third: null };
}

export function runnerStateOccupants(state) {
  return [state?.first, state?.second, state?.third].filter(Boolean);
}

function addUniqueRunner(list, runner) {
  if (!runner) return;
  if (!list.some(x => sameRunner(x, runner))) list.push(runner);
}

/**
 * description_japから「プレー直前」の明示塁配置を読む。
 * 最初のpre-play表現だけを採用し、打球後の「一三塁」等は拾わない。
 */
export function explicitPreplayBasePattern(description) {
  const s = String(description ?? '').replace(/^\d+球目:/, '');
  for (const re of PREPLAY_PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    const token = m[1];
    const bases = BASE_PATTERN_MAP.get(token);
    if (bases) return { token, bases: [...bases] };
  }
  return null;
}

/**
 * 現在のidentity stateを、説明文が明示する塁配置へ保守的に再配置する。
 * observedStateは同一PBP行のon_*由来identity pool補完用で、位置そのものは補助証拠に留める。
 * 複数identityの割当が一意に決まらない場合はUNCERTAIN。
 */
export function reconcileRunnerStateWithPattern(state, pattern, observedState = null) {
  if (!pattern) return { status: 'NO_PATTERN', state, pattern: null };
  const targets = [...new Set(pattern.bases)].sort((a, b) => a - b);
  if (targets.length === 0) return { status: 'RESOLVED', state: emptyRunnerState(), pattern };

  const pool = [];
  for (const r of runnerStateOccupants(state)) addUniqueRunner(pool, r);
  for (const r of runnerStateOccupants(observedState)) addUniqueRunner(pool, r);
  if (pool.length < targets.length) {
    return { status: 'UNCERTAIN', state: null, pattern, reason: `identity_pool_${pool.length}_lt_targets_${targets.length}` };
  }

  const out = emptyRunnerState();
  const key = b => b === 1 ? 'first' : b === 2 ? 'second' : 'third';
  const used = [];

  // まず現在stateで明示target baseにいるrunnerを固定する。
  for (const b of targets) {
    const k = key(b);
    const r = state?.[k];
    if (r && !used.some(x => sameRunner(x, r))) {
      out[k] = r;
      used.push(r);
    }
  }

  // 同一行のraw stateも、まだ空いているtarget baseだけidentity補助証拠に使う。
  for (const b of targets) {
    const k = key(b);
    if (out[k]) continue;
    const r = observedState?.[k];
    if (r && pool.some(x => sameRunner(x, r)) && !used.some(x => sameRunner(x, r))) {
      out[k] = r;
      used.push(r);
    }
  }

  const openBases = targets.filter(b => !out[key(b)]);
  const remaining = pool.filter(r => !used.some(x => sameRunner(x, r)));

  if (openBases.length === 0) return { status: 'RESOLVED', state: out, pattern };
  if (openBases.length === 1 && remaining.length === 1) {
    out[key(openBases[0])] = remaining[0];
    return { status: 'RESOLVED', state: out, pattern };
  }
  // 走者1人なら、raw positionが古くても明示された唯一のbaseへ一意に移せる。
  if (targets.length === 1 && pool.length === 1) {
    out[key(targets[0])] = pool[0];
    return { status: 'RESOLVED', state: out, pattern };
  }

  return {
    status: 'UNCERTAIN',
    state: null,
    pattern,
    reason: `ambiguous_assignment_open_${openBases.length}_remaining_${remaining.length}_pool_${pool.length}`,
  };
}

/** 次打席開始時の塁上に、対象走者がどこにいるかを返す。 */
export function runnerBase(runner, bases) {
  if (!runner) return null;
  if (sameRunner(bases?.first, runner)) return 'first';
  if (sameRunner(bases?.second, runner)) return 'second';
  if (sameRunner(bases?.third, runner)) return 'third';
  return null;
}

/** 追加進塁の成否を保守的に判定する。 */
export function classifyAdvanceOutcome(kind, runner, nextBases, outsBefore, outsAfter) {
  const where = runnerBase(runner, nextBases);

  if (kind === '1st_to_3rd') {
    if (where === 'third') return 1;
    if (where === 'first' || where === 'second') return 0;
  } else if (kind === '2nd_to_home' || kind === '1st_to_home_on_2b') {
    if (where != null) return 0;
  } else {
    throw new Error(`unknown advancement kind: ${kind}`);
  }

  if (!Number.isFinite(outsBefore) || !Number.isFinite(outsAfter)) return null;
  if (outsAfter === outsBefore) return 1;
  return null;
}

/** 打席内の全行と実投球行を分離して保持する。 */
export function addPitchRowToPlateAppearance(map, key, row, isPitch = true) {
  let x = map.get(key);
  if (!x) {
    x = { first: row, last: row, firstPitch: null, lastPitch: null, rows: [], pitchRows: [] };
    map.set(key, x);
  } else {
    x.last = row;
  }
  x.rows.push(row);
  if (isPitch) {
    if (x.firstPitch == null) x.firstPitch = row;
    x.lastPitch = row;
    x.pitchRows.push(row);
  }
}
