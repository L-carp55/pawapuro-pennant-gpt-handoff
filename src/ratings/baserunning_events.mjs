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
// - description_jap が打球後の「一三塁」「二塁」等まで明示する場合は、
//   identity追跡より独立した強い結果ラベルとして使う。
// - 複数runnerでも走者順序は入れ替わらないので、人数が同じなら塁順を保った前進だけ許す。
// - 人数が変わる/後退が必要/identity不足なら推測せず uncertain とする。
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

export function runnerStateEntries(state) {
  return [
    [1, state?.first ?? null],
    [2, state?.second ?? null],
    [3, state?.third ?? null],
  ].filter(([, runner]) => !!runner);
}

function addUniqueRunner(list, runner) {
  if (!runner) return;
  if (!list.some(x => sameRunner(x, runner))) list.push(runner);
}

function normalizedDescription(description) {
  return String(description ?? '').replace(/^\d+球目:/, '');
}

/** description_japから「プレー直前」の明示塁配置を読む。 */
export function explicitPreplayBasePattern(description) {
  const s = normalizedDescription(description);
  for (const re of PREPLAY_PATTERNS) {
    const m = s.match(re);
    if (!m) continue;
    const token = m[1];
    const bases = BASE_PATTERN_MAP.get(token);
    if (bases) {
      const start = m.index ?? 0;
      return { token, bases: [...bases], match_start: start, match_end: start + m[0].length };
    }
  }
  return null;
}

/**
 * description_japのプレー直前表現より後ろに現れる最後の塁配置を、打球後明示状態として読む。
 * 例: 「二塁から…ヒットで出塁 一三塁」 -> [1,3]
 */
export function explicitPostplayBasePattern(description) {
  const s = normalizedDescription(description);
  const pre = explicitPreplayBasePattern(s);
  if (!pre) return null;
  const tail = s.slice(pre.match_end);
  const re = new RegExp(BASE_PATTERN_TOKEN, 'g');
  const found = [...tail.matchAll(re)];
  if (!found.length) return null;
  const token = found.at(-1)[1];
  const bases = BASE_PATTERN_MAP.get(token);
  return bases ? { token, bases: [...bases] } : null;
}

/**
 * kindと説明文の開始/終了塁が十分明確なときだけsuccessを独立判定する。
 * identityを必要としないため、次打席のrunner ID/name欠損とは独立したラベルになる。
 */
export function classifyAdvanceOutcomeFromPatterns(kind, startPattern, endPattern) {
  if (!startPattern || !endPattern) return null;
  const sk = startPattern.bases.join(',');
  const ek = endPattern.bases.join(',');

  if (kind === '1st_to_3rd' && sk === '1') {
    if (ek === '1,3') return 1;
    if (ek === '1,2') return 0;
    return null;
  }
  if (kind === '2nd_to_home') {
    if (sk === '2') {
      if (ek === '1') return 1;
      if (ek === '1,3') return 0;
    }
    if (sk === '1,2') {
      if (ek === '1,2') return 1;
      if (ek === '1,2,3') return 0;
    }
    return null;
  }
  if (kind === '1st_to_home_on_2b' && sk === '1') {
    if (ek === '2') return 1;
    if (ek === '2,3') return 0;
    return null;
  }
  return null;
}

/**
 * 現在のidentity stateを、説明文が明示する塁配置へ保守的に再配置する。
 * observedStateは同一PBP行のon_*由来identity pool補完用。
 * raw位置と明示配置が完全一致する時だけobserved位置をそのまま採用する。
 */
export function reconcileRunnerStateWithPattern(state, pattern, observedState = null) {
  if (!pattern) return { status: 'NO_PATTERN', state, pattern: null };
  const targets = [...new Set(pattern.bases)].sort((a, b) => a - b);
  if (targets.length === 0) return { status: 'RESOLVED', state: emptyRunnerState(), pattern };

  let current = runnerStateEntries(state).sort((a, b) => a[0] - b[0]);
  const observed = runnerStateEntries(observedState).sort((a, b) => a[0] - b[0]);
  const observedBases = observed.map(([b]) => b);
  if (observed.length === targets.length && observedBases.every((b, i) => b === targets[i])) {
    return { status: 'RESOLVED', state: observedState, pattern, basis: 'explicit_pattern_matches_raw_positions' };
  }

  if (current.length < targets.length) {
    const pool = current.map(([, r]) => r);
    for (const [, r] of observed) addUniqueRunner(pool, r);
    if (pool.length !== targets.length) {
      return { status: 'UNCERTAIN', state: null, pattern, reason: `identity_pool_${pool.length}_targets_${targets.length}` };
    }
    if (pool.length === 1 && targets.length === 1) {
      const out = emptyRunnerState();
      out[targets[0] === 1 ? 'first' : targets[0] === 2 ? 'second' : 'third'] = pool[0];
      return { status: 'RESOLVED', state: out, pattern, basis: 'single_runner_identity_pool' };
    }
    return { status: 'UNCERTAIN', state: null, pattern, reason: 'identity_positions_incomplete_for_multiple_runners' };
  }

  if (current.length !== targets.length) {
    return { status: 'UNCERTAIN', state: null, pattern, reason: `runner_count_${current.length}_targets_${targets.length}` };
  }

  for (let i = 0; i < current.length; i++) {
    if (targets[i] < current[i][0]) {
      return { status: 'UNCERTAIN', state: null, pattern, reason: `backward_move_${current[i][0]}_to_${targets[i]}` };
    }
  }

  const out = emptyRunnerState();
  for (let i = 0; i < current.length; i++) {
    const k = targets[i] === 1 ? 'first' : targets[i] === 2 ? 'second' : 'third';
    out[k] = current[i][1];
  }
  return { status: 'RESOLVED', state: out, pattern, basis: 'order_preserving_forward_relocation' };
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
