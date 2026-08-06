// 12球団のシーズン進行。総当たりで games_per_team に達するまで日程を組む。
import { playGame } from './game.mjs';

/** 各チームが均等に対戦する日程を作る（総当たりを繰り返す） */
export function buildSchedule(teamCount, gamesPerTeam) {
  const pairs = [];
  for (let i = 0; i < teamCount; i++) {
    for (let j = i + 1; j < teamCount; j++) pairs.push([i, j]);
  }
  const gamesPerRound = (teamCount - 1); // 1巡で各チームが戦う試合数
  const rounds = Math.round(gamesPerTeam / gamesPerRound);
  const schedule = [];
  for (let r = 0; r < rounds; r++) {
    for (const [a, b] of pairs) {
      // 巡ごとにホームを入れ替える
      schedule.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
  }
  return schedule;
}

/**
 * @param {object} [opts]
 *   onGame(record) 1試合ごとに呼ばれる。記録層（通算成績・タイトル・球団史）が使う。
 *     渡すのは {index, home, away, homeRuns, awayRuns, innings, batting:Map, pitching:Map}。
 *     **打席の生ログは渡さない**——143試合×12球団で数十万件になり、
 *     記録層が要るのは集計であって1球ごとの再現ではないため（必要になったら別途設計する）。
 */
export function playSeason(teams, league, rng, cfg, opts = null) {
  const schedule = buildSchedule(teams.length, cfg.season.games_per_team);
  const standings = teams.map(t => ({ name: t.name, w: 0, l: 0, d: 0, rf: 0, ra: 0 }));
  const playerStats = new Map();
  const tally = { sb: 0, cs: 0, gdp: 0, sf: 0, sh: 0, roe: 0 };

  const blank = () => ({ PA: 0, BB: 0, HBP: 0, SO: 0, B1: 0, B2: 0, B3: 0, HR: 0, OUT: 0 });
  const bump = (map, id, outcome) => {
    let s = map.get(id);
    if (!s) { s = blank(); map.set(id, s); }
    s.PA++; s[outcome]++;
  };

  for (let gi = 0; gi < schedule.length; gi++) {
    const g = schedule[gi];
    const res = playGame(teams[g.home], teams[g.away], league, rng, cfg, tally);
    const H = standings[g.home], A = standings[g.away];
    H.rf += res.homeRuns; H.ra += res.awayRuns;
    A.rf += res.awayRuns; A.ra += res.homeRuns;
    if (res.homeRuns > res.awayRuns) { H.w++; A.l++; }
    else if (res.homeRuns < res.awayRuns) { A.w++; H.l++; }
    else { H.d++; A.d++; }

    // 1試合分だけを別に集める（記録層が要る時のみ。既定では作らない）
    const gameBat = opts?.onGame ? new Map() : null;
    const gamePit = opts?.onGame ? new Map() : null;
    for (const e of res.log) {
      bump(playerStats, e.batter, e.outcome);
      bump(playerStats, 'P:' + e.pitcher, e.outcome);
      if (gameBat) { bump(gameBat, e.batter, e.outcome); bump(gamePit, e.pitcher, e.outcome); }
    }
    if (opts?.onGame) {
      opts.onGame({
        index: gi, home: teams[g.home].name, away: teams[g.away].name,
        homeRuns: res.homeRuns, awayRuns: res.awayRuns, innings: res.innings,
        batting: gameBat, pitching: gamePit,
      });
    }
  }

  return { standings, playerStats, tally, games: schedule.length };
}
