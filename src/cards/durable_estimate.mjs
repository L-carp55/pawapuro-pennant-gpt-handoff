// 選手の身体能力（走力・肩力）を、対象年以前の近年データもあわせて推定する。
// 設計と実測の根拠は src/ratings/durable_traits.mjs のコメントを参照。
//
// 重要（2026-08-06）:
//   年度カードは、その年度終了時点で利用できる情報だけで作る。
//   対象年より後の成績を使うと、過去カードへ未来情報が混入するため禁止する。

import { speedComponents } from '../ratings/running.mjs';
import { advanceOf } from '../ratings/baserunning_advance.mjs';
import { poolAcrossYears, combineArmSources } from '../ratings/durable_traits.mjs';

const MAX_GAP = 3; // 対象年を含む直近4年（対象年-3〜対象年）だけを使う

// SQL文は同じ文字列なら1回だけ作って使い回す。
// node:sqlite で毎回 db.prepare() を呼ぶと作った文が溜まり、呼ぶほど遅くなる
// （142人の較正で1人目0.7秒→5人目24秒と悪化して発覚。2026-08-01）
const __stmt = new Map();
const prep = (db, sql) => {
  let st = __stmt.get(sql);
  if (!st) { st = db.prepare(sql); __stmt.set(sql, st); }
  return st;
};

/**
 * @returns {{speed, arm}} それぞれ null または {z, weight, years, seasons, ...}
 */
export function estimateDurableTraits(db, proeyeId, targetSeason, ctx) {
  const { runNorm, fldNorm } = ctx;

  // --- 走力: 対象年以前の打撃＋走塁データから各年のzを出して畳む ---
  const runRows = prep(db, `
    SELECT b.season, b.name, b.pa, b.ab, b.so, b.b2, b.b3, b.hr, b.gdp, bm.ubr, m.gb_pct, t.ih, t.bats
    FROM v_batting b
    JOIN player_link l ON l.proeye_id=b.player_id AND l.season=b.season
    JOIN v_bm_by_player bm ON bm.proeye_id=b.player_id AND bm.season=b.season AND bm.farm=0
    LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
    LEFT JOIN nf3_team_link tl ON tl.proeye_id=b.player_id AND tl.season=b.season
    LEFT JOIN nf3_team_bat t ON t.season=tl.season AND t.name_norm=tl.name_norm
    WHERE b.player_id=? AND b.season BETWEEN ? AND ? AND b.pa>=100 AND b.position<>'投'`)
    .all(proeyeId, targetSeason - MAX_GAP, targetSeason);

  const nrm = s2 => (s2 ?? '').normalize('NFKC').replace(/\s+/g, '');
  const speedObs = runRows.map(r => {
    const adv = advanceOf(db, nrm(r.name), r.season);
    const sc = speedComponents(
      { AB: r.ab, SO: r.so, B2: r.b2, B3: r.b3, HR: r.hr, GDP: r.gdp, PA: r.pa },
      { gbPct: r.gb_pct, infieldHits: r.ih, bats: r.bats, season: r.season,
        // 走塁指標も年ごとに引く（片側だけ配線して複数年経路が置き去りになるのを防ぐ）
        advance: adv?.value ?? null, advanceChances: adv?.chances ?? 0 }, r.ubr, runNorm);
    return sc.score == null ? null : { z: sc.score, weight: r.pa, season: r.season };
  }).filter(Boolean);
  const speed = poolAcrossYears(speedObs, targetSeason, { maxYearGap: MAX_GAP });

  // --- 肩: ARM（2020年以降）と補殺（2006年以降）の2つを別々に畳んでから合成 ---
  const armRows = prep(db, `
    SELECT f.season, f.pos, f.inn, f.arm
    FROM bm_fld f JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
    WHERE l.proeye_id=? AND f.season BETWEEN ? AND ? AND f.farm=0
      AND f.arm IS NOT NULL AND f.inn>=100`)
    .all(proeyeId, targetSeason - MAX_GAP, targetSeason);

  const armObs = armRows.map(r => {
    const n = fldNorm.byPos[r.pos]?.arm;
    if (!n || !(n.sd > 0)) return null;
    return { z: ((r.arm / r.inn) * 1000 - n.mean) / n.sd, weight: r.inn, season: r.season };
  }).filter(Boolean);

  const asstRows = prep(db, `
    SELECT season, position, g, a FROM v_fielding
    WHERE player_id=? AND season BETWEEN ? AND ? AND position IN ('外','捕') AND g>=40`)
    .all(proeyeId, targetSeason - MAX_GAP, targetSeason);

  const asstObs = asstRows.map(r => {
    const grp = r.position === '外' ? 'OF' : 'C';
    const n = fldNorm.assistsByGroupSeason?.byGroupSeason?.[`${grp}|${r.season}`];
    if (!n || !(n.sd > 0)) return null;
    return { z: (r.a / r.g - n.mean) / n.sd, weight: r.g, season: r.season };
  }).filter(Boolean);

  const armPooled = poolAcrossYears(armObs, targetSeason, { maxYearGap: MAX_GAP });
  const asstPooled = poolAcrossYears(asstObs, targetSeason, { maxYearGap: MAX_GAP });
  const combined = combineArmSources(armPooled, asstPooled);

  return {
    speed,
    arm: combined && {
      ...combined,
      // ARMと補殺は別の情報源（相関0.402）なので、観測量は足し合わせる。
      // 試合数はイニングへ換算してから足す（1試合=9イニング）。
      // ただし2つは完全に独立ではないので、重なりぶんを相関で割り引く
      weight: (armPooled?.weight ?? 0) + (asstPooled?.weight ?? 0) * 9 * (1 - 0.402),
      years: Math.max(armPooled?.years ?? 0, asstPooled?.years ?? 0),
      seasons: [...new Set([...(armPooled?.seasons ?? []), ...(asstPooled?.seasons ?? [])])].sort(),
      isMultiYear: (armPooled?.isMultiYear || asstPooled?.isMultiYear) ?? false,
      evidence_cutoff: targetSeason,
      _weight_note: 'ARMのイニング + 補殺の試合数×9×(1-0.402)。2つは別の情報源だが相関0.402ぶんは重複するので割り引く。対象年より後のデータは使わない',
    },
  };
}
