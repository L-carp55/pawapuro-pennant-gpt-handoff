// 打席結果を受けて走者を進め、得点とイベントを返す。
// 塁の状態は [1塁, 2塁, 3塁]。
// legacy呼び出しでは true/false、新しいengine経路では runner object / false を保持できる。
// 併殺・犠飛・犠打・失策出塁は、それぞれ実測の年間発生数に合わせて較正する（configs/engine.json）。

export function emptyBases() {
  return [false, false, false];
}

/** 盗塁の企図と成否。打席の前に呼ぶ。
 * runner objectが塁上にある場合は、成功時もidentityをそのまま次塁へ移す。
 * player-specificな企図/成功率は未較正なので、現段階ではcfgのリーグ確率を使う。
 */
export function trySteal(bases, outs, rng, cfg, _ctx = null) {
  const [b1, b2, b3] = bases;
  // 1塁に走者・2塁が空 → 二盗。2塁に走者・3塁が空 → 三盗（頻度は二盗より低い）
  if (b1 && !b2) {
    if (rng.chance(cfg.steal_attempt_rate_2nd)) {
      if (rng.chance(cfg.steal_success_rate)) return { bases: [false, b1, b3], outs, sb: 1, cs: 0 };
      return { bases: [false, false, b3], outs: outs + 1, sb: 0, cs: 1 };
    }
  } else if (b2 && !b3 && !b1) {
    if (rng.chance(cfg.steal_attempt_rate_3rd)) {
      if (rng.chance(cfg.steal_success_rate)) return { bases: [false, false, b2], outs, sb: 1, cs: 0 };
      return { bases: [false, false, false], outs: outs + 1, sb: 0, cs: 1 };
    }
  }
  return { bases, outs, sb: 0, cs: 0 };
}

/**
 * @param {object|null} [ctx] 追加context。ctx.batter があれば出塁時にその選手objectを塁上へ保持する。
 *   legacy呼び出し（ctxなし）では従来どおり true を置く。
 * @returns {{bases:Array, outs:number, runs:number, ev:object}}
 *   ev は発生したイベント {gdp,sf,sh,roe} のカウント
 */
export function advance(bases, outs, outcome, rng, cfg, ctx = null) {
  let [b1, b2, b3] = bases;
  let runs = 0;
  let o = outs;
  const ev = { gdp: 0, sf: 0, sh: 0, roe: 0 };
  const batter = ctx?.batter ?? true;

  switch (outcome) {
    case 'HR':
      runs = 1 + (b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0);
      b1 = b2 = b3 = false;
      break;

    case 'B3':
      runs = (b1 ? 1 : 0) + (b2 ? 1 : 0) + (b3 ? 1 : 0);
      b1 = b2 = false; b3 = batter;
      break;

    case 'B2':
      if (b3) { runs++; b3 = false; }
      if (b2) { runs++; b2 = false; }
      if (b1) {
        if (rng.chance(cfg.double_runner1_scores)) runs++;
        else b3 = b1;
        b1 = false;
      }
      b2 = batter;
      break;

    case 'B1':
      if (b3) { runs++; b3 = false; }
      if (b2) {
        if (rng.chance(cfg.single_runner2_scores)) runs++;
        else b3 = b2;
        b2 = false;
      }
      if (b1) {
        if (!b3 && rng.chance(cfg.single_runner1_to_3rd)) b3 = b1;
        else b2 = b1;
        b1 = false;
      }
      b1 = batter;
      break;

    case 'BB':
    case 'HBP':
      // force advance。runner objectを失わないよう後ろの塁から移す。
      if (b1) {
        if (b2) {
          if (b3) runs++;
          b3 = b2;
        }
        b2 = b1;
      }
      b1 = batter;
      break;

    case 'SO':
      o++;
      break;

    case 'OUT': {
      // 失策出塁: アウトにならず打者が1塁へ（走者は1つ進む）
      if (rng.chance(cfg.roe_rate)) {
        ev.roe = 1;
        if (b3) { runs++; b3 = false; }
        if (b2) { b3 = b2; b2 = false; }
        if (b1) { b2 = b1; b1 = false; }
        b1 = batter;
        break;
      }

      const runnerOn = b1 || b2 || b3;

      // 犠打: 走者がいて2アウト未満。打者はアウト、走者が1つ進む
      if (runnerOn && outs < 2 && (b1 || b2) && rng.chance(cfg.bunt_rate)) {
        ev.sh = 1;
        o++;
        if (b3) { /* 3塁走者は動かさない（スクイズは別扱い） */ }
        if (b2 && !b3) { b3 = b2; b2 = false; }
        if (b1 && !b2) { b2 = b1; b1 = false; }
        break;
      }

      // 併殺: 1塁に走者・2アウト未満
      if (b1 && outs < 2 && rng.chance(cfg.gdp_rate)) {
        ev.gdp = 1;
        o += 2;
        b1 = false;
        break;
      }

      // 犠飛: 3塁に走者・2アウト未満
      if (b3 && outs < 2 && rng.chance(cfg.sacfly_rate)) {
        ev.sf = 1;
        o++;
        runs++;
        b3 = false;
        break;
      }

      // 通常のアウト。低確率で走者が1つ進む（内野ゴロの進塁打など）
      o++;
      if (o < 3 && runnerOn && rng.chance(cfg.out_runner_advance)) {
        if (b3) { runs++; b3 = false; }
        if (b2) { b3 = b2; b2 = false; }
        if (b1) { b2 = b1; b1 = false; }
      }
      break;
    }

    default:
      throw new Error(`unknown outcome: ${outcome}`);
  }

  return { bases: [b1, b2, b3], outs: o, runs, ev };
}
