// 1試合の進行。盗塁→打席→進塁→イニング→試合。
import { combine, combineViaBattedBall, toPickTable } from './odds.mjs';
import { advance, emptyBases, trySteal } from './baserunning.mjs';
import { inplayOutcomes } from './batted_ball.mjs';

function playHalfInning(offense, defense, league, rng, cfg, state, tally) {
  let outs = 0;
  let bases = emptyBases();
  let runs = 0;
  const runningCtx = {
    playerRunningCfg: cfg.player_running ?? null,
    // engine.jsonにはpathだけを保存し、実際の較正objectはruntime loaderが後で注入する。
    // gate OFFの現在はnullでもglobal probabilityへ必ずfallbackする。
    runningResponseCfg: cfg.player_running?.running_response ?? null,
    eventResponseCfg: cfg.player_running?.event_responses ?? null,
  };

  while (outs < cfg.game.outs_per_inning) {
    // 打席前の盗塁企図。塁上にはrunner objectが残るため、後続のplayer-specific
    // running responseを接続できる。未較正/gate OFFなら従来のリーグ較正値。
    const st = trySteal(bases, outs, rng, cfg.baserunning, runningCtx);
    bases = st.bases; outs = st.outs;
    tally.sb += st.sb; tally.cs += st.cs;
    if (outs >= cfg.game.outs_per_inning) break;

    const batter = offense.lineup[state.batterIndex % offense.lineup.length];
    const pitcher = defense.currentPitcher;

    // 打球データが揃っていれば中間層を通す（相互作用が式から生じる）。
    // 揃っていない年代・選手は従来どおり直結で解決する。
    const useBb = cfg.battedBall?.enabled && batter.battedBall && pitcher.battedBall && league.battedBall;
    const probs = useBb
      ? combineViaBattedBall(batter, pitcher, league, cfg.battedBall.coefficients, inplayOutcomes)
      : combine(batter.rates, pitcher.rates, league.rates ?? league);
    const outcome = rng.pick(toPickTable(probs));

    state.log.push({ batter: batter.id, pitcher: pitcher.id, outcome });
    defense.pitcherBF++;

    // 出塁時にtrueだけでなくbatter objectそのものを保持する。
    // これにより次の打席で「誰が塁上にいるか」を失わず、身体走行性能と
    // 盗塁/走塁skillを別々に参照できる。
    const res = advance(bases, outs, outcome, rng, cfg.baserunning, { batter, ...runningCtx });
    bases = res.bases;
    outs = res.outs;
    runs += res.runs;
    tally.gdp += res.ev.gdp; tally.sf += res.ev.sf;
    tally.sh += res.ev.sh; tally.roe += res.ev.roe;
    state.batterIndex++;

    if (defense.pitcherBF >= defense.currentTarget && defense.bullpen.length > 0) {
      defense.currentPitcher = defense.bullpen.shift();
      defense.pitcherBF = 0;
      defense.currentTarget = cfg.pitching.reliever_bf_target;
    }
  }
  return runs;
}

export function playGame(home, away, league, rng, cfg, tally) {
  const mk = (team) => ({
    lineup: team.lineup,
    currentPitcher: team.starter,
    bullpen: [...team.bullpen],
    pitcherBF: 0,
    currentTarget: Math.max(
      6,
      Math.round(cfg.pitching.starter_bf_target + (rng() * 2 - 1) * cfg.pitching.starter_bf_variance)
    ),
  });

  const homeD = mk(home);
  const awayD = mk(away);
  const homeState = { batterIndex: 0, log: [] };
  const awayState = { batterIndex: 0, log: [] };

  let homeRuns = 0, awayRuns = 0;
  let inning = 1;

  while (true) {
    awayRuns += playHalfInning(away, homeD, league, rng, cfg, awayState, tally);

    const skipBottom = inning >= cfg.game.innings && homeRuns > awayRuns;
    if (!skipBottom) {
      homeRuns += playHalfInning(home, awayD, league, rng, cfg, homeState, tally);
    }

    if (inning >= cfg.game.innings && homeRuns !== awayRuns) break;
    if (inning >= cfg.game.max_extra_innings) break;
    inning++;
  }

  return { homeRuns, awayRuns, innings: inning, log: [...awayState.log, ...homeState.log] };
}
