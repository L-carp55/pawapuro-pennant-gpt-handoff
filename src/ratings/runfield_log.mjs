// 走塁・守備・捕手の計算ログ（Sol仕様 04 §13）。
//
// 仕様は running / fielding / catcher の3ブロックを YAML で列挙している。
// ここでは同じ項目名・同じ並びの構造を組み立てる（保存形式はJSONだが、キーは仕様の逐語）。
// 目的は「なぜこの走力・守備力になったか」を後から完全に再現できること（02 §15 途中式を省略しない）。
//
// 値が取れない項目は **0で埋めずnull**（仕様03 §1.3）。

const r3 = v => (v == null || !Number.isFinite(v)) ? null : Math.round(v * 1000) / 1000;

/**
 * @param {object} args
 *   line: 打撃成績（SB/CS/PA/B3 等）
 *   run:  {speed, stealing, baserunning, _z}
 *   fld:  appraiseAllPositions の戻り
 *   bm:   NPB Basement の行（ubr/wsb/gb_pct）
 */
export function buildRunFieldLog({ line, run, fld, bm }) {
  const attempts = (line.SB ?? 0) + (line.CS ?? 0);

  const running = run ? {
    primary_speed_metric: 'UBR（走塁による得点貢献）',
    secondary_metrics: ['三塁打率', '内野安打率', '併殺回避率'],
    _note: 'Sprint Speedは公開が2026年以降のみのため第1階層を使えない（仕様04 §1の第2-3階層で代替）',
    speed_rating: r3(run.speed),
    steal_attempt_rate: line.PA > 0 ? r3(attempts / line.PA) : null,
    steal_success_rate: attempts > 0 ? r3((line.SB ?? 0) / attempts) : null,
    steal_residual_vs_speed: r3(run.stealing?.residZ ?? null),
    stealing_ability: r3(run.stealing?.rating ?? null),
    baserunning_ability: r3(run.baserunning?.rating ?? null),
    _speed_z: r3(run._z),
    _raw: { ubr: r3(bm?.ubr ?? null), wsb: r3(bm?.wsb ?? null) },
  } : {
    _unavailable: 'NPB Basementの範囲外の年（2019年以前）のため走塁は未査定。0で埋めない',
  };

  const fielding = (fld ?? []).map(f => ({
    position: f.pos,
    range_metric: 'RngR（守備範囲による得点貢献）',
    range_component_only: r3(f.fielding?.per1000 ?? null),
    speed_rating_fixed: r3(run?._z ?? null),
    inferred_fielding_rating: r3(f.fielding?.rating ?? null),
    error_rate: r3(f.catching?.per1000 ?? null),
    catching_rating: r3(f.catching?.rating ?? null),
    arm_metric: f.arm?.is_estimated ? '守備位置からの推定（ARM実測なし）' : 'ARM（送球による得点貢献）',
    arm_rating: r3(f.arm?.rating ?? null),
    arm_is_estimated: f.arm?.is_estimated ?? false,
    throwing_error_rate: null,
    _throwing_error_note: '送球失策と捕球失策を分けたデータが公開されていないため未取得。総失策は肩へ入れない（仕様§4.3）',
    throwing_ability: null,
    _throwing_ability_note: '送球の精度は送球得能。専用データが無いため未査定（肩力で代用しない）',
    innings: f.inn,
    confidence: r3(f.fielding?.reliability ?? f.catching?.reliability ?? null),
    aptitude: f.aptitude?.grade ?? null,
  }));

  const c = (fld ?? []).find(f => f.pos === 'C');
  const catcher = c ? {
    attempts: null, caught: null, caught_stealing_rate: null,
    _steal_note: '捕手の被盗塁企図・刺殺はNPB Basementに無く、NF3からも未取得。阻止率をそのまま肩へ変換しない（仕様§10.3）',
    pop_time: null, exchange: null, throw_velocity: null,
    _tracking_note: 'Pop Time・Exchange・送球速度は日本で未公開',
    pitcher_context: null, runner_context: null,
    _context_note: '投手のクイックと走者の走力を分離するモデルは未実装。分離できないまま肩へ配分しない',
    shoulder: r3(c.arm?.rating ?? null),
    throwing: null,
    fielding: r3(c.fielding?.rating ?? null),
    catching: r3(c.catching?.rating ?? null),
    framing: r3(c.catcher?.framing ?? null),
    blocking: r3(c.catcher?.blocking ?? null),
    _composite_note: '肩0.55/送球0.30/守備0.15の合成はREJECTED。成分のまま持ち、合成しない',
  } : null;

  return { running, fielding, catcher };
}
