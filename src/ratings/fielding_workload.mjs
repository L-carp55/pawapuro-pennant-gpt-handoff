// 捕球expected-error用の守備負荷コンテキスト。
//
// 係数や「疲労点」はここで作らない。
// PBPの fielder_2_name〜fielder_9_name から、各試合でその野手が守備についていた球数を数え、
// 各プレーの直前までに観測できる生の負荷だけを返す。
//
// 重要:
// - current game の最終球数は、そのプレーより後の情報を含むので説明変数にしない。
// - 直近7/14日も「当該試合より前の守備試合」だけを数える。
// - 疲労効果があるか、各列をどう重み付けるかは expected-error の較正で決める。

const DAY_MS = 24 * 60 * 60 * 1000;
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const parseDateMs = value => {
  if (!value) return null;
  const t = Date.parse(String(value).replaceAll('/', '-'));
  return Number.isFinite(t) ? t : null;
};

/**
 * @param {Array} rows [{season,date,game_id,player,pitches}]
 * @returns {Map<string,object>} key=`season|game_id|playerNorm`
 */
export function buildDefensiveWorkloadContexts(rows) {
  const byPlayer = new Map();
  for (const r of rows ?? []) {
    const player = norm(r.player);
    const season = Number(r.season);
    const pitches = Number(r.pitches);
    if (!player || !Number.isFinite(season) || !r.game_id || !(pitches >= 0)) continue;
    const rec = {
      season,
      date: r.date ?? null,
      dateMs: parseDateMs(r.date),
      game_id: String(r.game_id),
      player,
      pitches,
    };
    if (!byPlayer.has(player)) byPlayer.set(player, []);
    byPlayer.get(player).push(rec);
  }

  const out = new Map();
  for (const [player, recs] of byPlayer) {
    recs.sort((a, b) => a.season - b.season
      || ((a.dateMs ?? Infinity) - (b.dateMs ?? Infinity))
      || a.game_id.localeCompare(b.game_id));

    let season = null;
    let prior = [];
    let seasonGames = 0;
    let seasonPitches = 0;

    for (const r of recs) {
      if (r.season !== season) {
        season = r.season;
        prior = [];
        seasonGames = 0;
        seasonPitches = 0;
      }

      const prev = prior.at(-1) ?? null;
      const gapDays = (r.dateMs != null && prev?.dateMs != null)
        ? Math.max(0, (r.dateMs - prev.dateMs) / DAY_MS)
        : null;

      let games7 = 0, games14 = 0, pitches7 = 0, pitches14 = 0;
      if (r.dateMs != null) {
        for (const p of prior) {
          if (p.dateMs == null) continue;
          const days = (r.dateMs - p.dateMs) / DAY_MS;
          if (days < 0) continue;
          if (days <= 7) { games7++; pitches7 += p.pitches; }
          if (days <= 14) { games14++; pitches14 += p.pitches; }
        }
      }

      out.set(`${r.season}|${r.game_id}|${player}`, {
        prev_def_game_gap_days: gapDays,
        prior_def_games_7d: games7,
        prior_def_games_14d: games14,
        prior_def_pitches_7d: pitches7,
        prior_def_pitches_14d: pitches14,
        season_def_games_before: seasonGames,
        season_def_pitches_before: seasonPitches,
      });

      prior.push(r);
      seasonGames++;
      seasonPitches += r.pitches;
    }
  }
  return out;
}
