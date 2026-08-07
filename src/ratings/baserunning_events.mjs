// 1球データから追加進塁イベントを作るための純粋関数。
//
// 重要な規律:
// - 打席開始状態はその打席の first row から取る。
// - 打球後状態は次打席の first row から取る。
// - 「次打席で走者が消えた」だけでは生還と判定しない。
//   同じプレーでアウト数が増えた場合は走塁死等と区別できないため null（除外）にする。

/**
 * 次打席開始時の塁上に、対象走者がどこにいるかを返す。
 * @param {string} runner 正規化済みの走者識別子
 * @param {{first:string|null,second:string|null,third:string|null}} bases
 * @returns {'first'|'second'|'third'|null}
 */
export function runnerBase(runner, bases) {
  if (!runner) return null;
  if (bases?.first === runner) return 'first';
  if (bases?.second === runner) return 'second';
  if (bases?.third === runner) return 'third';
  return null;
}

/**
 * 追加進塁の成否を保守的に判定する。
 * null は「得点かアウトかを現在のデータだけでは区別できない」ため標本から外す意味。
 *
 * @param {'1st_to_3rd'|'2nd_to_home'|'1st_to_home_on_2b'} kind
 * @param {string} runner 正規化済み走者識別子
 * @param {{first:string|null,second:string|null,third:string|null}} nextBases 次打席開始時の塁状態
 * @param {number} outsBefore 現打席開始時アウト数
 * @param {number} outsAfter 次打席開始時アウト数
 * @returns {0|1|null}
 */
export function classifyAdvanceOutcome(kind, runner, nextBases, outsBefore, outsAfter) {
  const where = runnerBase(runner, nextBases);

  if (kind === '1st_to_3rd') {
    if (where === 'third') return 1;
    if (where === 'first' || where === 'second') return 0;
  } else if (kind === '2nd_to_home' || kind === '1st_to_home_on_2b') {
    // 本塁生還が目的なので、次打席開始時にどこかの塁へ残っていれば失敗。
    if (where != null) return 0;
  } else {
    throw new Error(`unknown advancement kind: ${kind}`);
  }

  // 走者が塁上から消えた場合。
  // アウト数が増えていなければ生還とみなせる。
  // 増えていれば、対象走者の走塁死・別走者/打者のアウトを識別できないため除外する。
  if (!Number.isFinite(outsBefore) || !Number.isFinite(outsAfter)) return null;
  if (outsAfter === outsBefore) return 1;
  return null;
}

/**
 * 打席の各投球行から first / last を保持するための小さなヘルパー。
 * これにより「最終行の on_1b を打席開始状態として使う」回帰を防ぐ。
 */
export function addPitchRowToPlateAppearance(map, key, row) {
  const x = map.get(key);
  if (!x) map.set(key, { first: row, last: row });
  else x.last = row;
}
