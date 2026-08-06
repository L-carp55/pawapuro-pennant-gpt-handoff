// 自作の走塁指標を、選手×年で引けるようにする。
//
// 出典: Nippon Baseball Data Repository（MIT License）
//
// 何を測っているか:
//   単打で一塁から三塁へ行けたか／単打で二塁から生還できたか／二塁打で一塁から生還できたか。
//   打球の落ちた位置とアウトカウントで「その場面の平均的な成功率」を作り、そこからの差を取る。
//   打球の行方を揃えるので、右前打ばかりだった選手が不当に低く出ることを防げる。
//
// なぜ走力の材料になるか（実測、2026-08-05）:
//   翌年との一致 0.527（20機会以上・197組）。いま使っているUBRの0.447より安定している。
//   UBRとの相関は0.613で、同じものを測りつつ4割は別の情報を持つ。
//
// 範囲: 2020-2026（1球データのある年）。無い年は null を返す＝走力は既存の材料だけで決まる。

const CACHE = new WeakMap();

/**
 * 選手×年の走塁指標を引く（初回に全件を読んで覚える）。
 * @returns {null|{value:number, chances:number}} 機会が無ければ null
 */
export function advanceOf(db, nameNorm, season) {
  let table = CACHE.get(db);
  if (!table) {
    table = build(db);
    CACHE.set(db, table);
  }
  if (!table) return null;
  return table.get(`${nameNorm}|${season}`) ?? null;
}

function build(db) {
  const has = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='baserunning_advances'`).get();
  if (!has) return null;
  const ev = db.prepare(
    `SELECT runner_norm, season, kind, success, outs, hc_x, hc_y FROM baserunning_advances
     WHERE hc_x IS NOT NULL`).all();

  // 場面ごとの平均的な成功率（打球の位置×アウトカウント×進塁の型）
  const key = e => `${e.kind}|${Math.floor(e.hc_x / 12)},${Math.floor(e.hc_y / 12)}|${e.outs}`;
  const cell = new Map();
  for (const e of ev) {
    const k = key(e);
    if (!cell.has(k)) cell.set(k, { n: 0, s: 0 });
    const c = cell.get(k); c.n++; c.s += e.success;
  }
  const out = new Map();
  for (const e of ev) {
    const k = `${e.runner_norm}|${e.season}`;
    if (!out.has(k)) out.set(k, { value: 0, chances: 0 });
    const v = out.get(k); const c = cell.get(key(e));
    v.chances++; v.value += e.success - c.s / c.n;
  }
  for (const v of out.values()) v.value /= v.chances;
  return out;
}
