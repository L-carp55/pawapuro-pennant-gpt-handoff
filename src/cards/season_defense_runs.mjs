// ピーク年度選定用の「その年の実測守備得点」を組み立てる。
//
// bm_fld の各成分はすべて得点（runs）単位だが、守備位置ごとに定義される成分が違う。
// 2026-08-07の全行監査で、非nullパターンは位置ごとに100%一貫していた:
//   IF: RngR + ErrR + DPR
//   OF: RngR + ErrR + ARM
//   C : ErrR + ARM + Framing + Blocking
//   DH: 守備機会なし = 0 runs
//
// nullを0で埋めるのではなく、その位置で必須の成分が欠けていたら年度守備得点全体をnullにする。

export const FIELDING_RUN_COMPONENTS_BY_POS = Object.freeze({
  '1B': ['rngr', 'errr', 'dpr'],
  '2B': ['rngr', 'errr', 'dpr'],
  '3B': ['rngr', 'errr', 'dpr'],
  SS: ['rngr', 'errr', 'dpr'],
  LF: ['rngr', 'errr', 'arm'],
  CF: ['rngr', 'errr', 'arm'],
  RF: ['rngr', 'errr', 'arm'],
  C: ['errr', 'arm', 'framing', 'blocking'],
  DH: [],
});

/** 1守備位置の得点。DHは守備機会が無いので明示的に0。欠損はnull。 */
export function fieldingRunsForPosition(row) {
  if (!row?.pos) return null;
  const components = FIELDING_RUN_COMPONENTS_BY_POS[row.pos];
  if (!components) return null;
  if (components.length === 0) {
    return {
      pos: row.pos,
      runs: 0,
      components: {},
      component_names: [],
      innings: Number.isFinite(row.inn) ? row.inn : null,
      basis: 'DHは守備機会なし。欠損の0埋めではなく役割上の0 runs',
    };
  }

  const values = {};
  for (const key of components) {
    if (!Number.isFinite(row[key])) return null;
    values[key] = row[key];
  }
  const runs = components.reduce((s, key) => s + values[key], 0);
  return {
    pos: row.pos,
    runs,
    components: values,
    component_names: components,
    innings: Number.isFinite(row.inn) ? row.inn : null,
    basis: `${components.join(' + ')}（bm_fldの得点成分）`,
  };
}

/**
 * 1選手・1年の全守備位置を合算する。
 * 1位置でも必須成分が欠ける/未知位置なら、比較可能性を壊すのでnullを返す。
 */
export function fieldingRunsForSeason(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const byPosition = [];
  for (const row of rows) {
    const x = fieldingRunsForPosition(row);
    if (!x) return null;
    byPosition.push(x);
  }
  return {
    runs: byPosition.reduce((s, x) => s + x.runs, 0),
    complete: true,
    positions: byPosition,
    innings: byPosition.reduce((s, x) => s + (x.innings ?? 0), 0),
    method: 'position_specific_additive_run_components',
    source: 'NPB Basement bm_fld',
  };
}
