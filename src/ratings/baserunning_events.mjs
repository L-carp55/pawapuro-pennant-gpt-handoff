// 1球データから追加進塁イベントを作るための純粋関数。
//
// 重要な規律:
// - PBPには打席見出し・投手交代等の非投球行が混ざる。
// - 追加進塁の起点は打球が起きた最終実投球行、打球後状態は次打席の最初の実投球行。
// - Release PBPでは on_* のplayer IDが空でも on_*_name が入る行がある。
//   したがって塁占有・走者同一性をIDだけで判定しない。
// - 両側にIDがある場合はIDを正本にし、片側でIDが欠ける場合だけ正規化名前で補完する。
// - 「次打席で走者が消えた」だけでは生還と判定しない。
//   同じプレーでアウト数が増えた場合は走塁死等と区別できないため null（除外）にする。

const normalizeName = s => String(s ?? '').normalize('NFKC').replace(/[\s　]/g, '') || null;
const normalizeId = s => {
  const v = String(s ?? '').trim();
  if (!v || v === '0' || v === '0.0' || v === 'nan' || v === 'None') return null;
  return v.replace(/\.0$/, '');
};

/**
 * PBP上の走者identityを作る。ID/名前の片方だけでも占有走者として有効。
 * @returns {null|{id:string|null,name:string|null}}
 */
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

/**
 * 次打席開始時の塁上に、対象走者がどこにいるかを返す。
 * @param {string|{id:string|null,name:string|null}} runner
 * @param {{first:any,second:any,third:any}} bases
 * @returns {'first'|'second'|'third'|null}
 */
export function runnerBase(runner, bases) {
  if (!runner) return null;
  if (sameRunner(bases?.first, runner)) return 'first';
  if (sameRunner(bases?.second, runner)) return 'second';
  if (sameRunner(bases?.third, runner)) return 'third';
  return null;
}

/**
 * 追加進塁の成否を保守的に判定する。
 * null は「得点かアウトかを現在のデータだけでは区別できない」ため標本から外す意味。
 *
 * @param {'1st_to_3rd'|'2nd_to_home'|'1st_to_home_on_2b'} kind
 * @param {string|{id:string|null,name:string|null}} runner
 * @param {{first:any,second:any,third:any}} nextBases 次打席開始時の塁状態
 * @param {number} outsBefore 打球直前アウト数
 * @param {number} outsAfter 次打席開始時アウト数
 * @returns {0|1|null}
 */
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

/**
 * 打席内の全行と実投球行を分離して保持する。
 *
 * @param {Map} map
 * @param {string} key
 * @param {Array|string|object} row
 * @param {boolean} [isPitch=true] 実投球行ならtrue。旧テスト/旧呼び出し互換のため既定true。
 */
export function addPitchRowToPlateAppearance(map, key, row, isPitch = true) {
  let x = map.get(key);
  if (!x) {
    x = { first: row, last: row, firstPitch: null, lastPitch: null };
    map.set(key, x);
  } else {
    x.last = row;
  }
  if (isPitch) {
    if (x.firstPitch == null) x.firstPitch = row;
    x.lastPitch = row;
  }
}
