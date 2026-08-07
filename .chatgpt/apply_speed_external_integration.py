from pathlib import Path

p = Path('src/cards/pipeline.mjs')
s = p.read_text()

def replace_once(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'pipeline: expected exactly 1 match, got {n}: {old[:120]!r}')
    s = s.replace(old, new, 1)

replace_once(
"import { speedComponents, resolveFinalSpeed, stealingAbility, baserunningAbility } from '../ratings/running.mjs';\n",
"import { speedComponents, resolveFinalSpeed, stealingAbility, baserunningAbility } from '../ratings/running.mjs';\n"
"import { reconcileSpeedEvidence } from '../ratings/speed_evidence.mjs';\n",
)

old = """  const durable = estimateDurableTraits(db, p.player_id, targetSeason,
    { cfg, runNorm, fldNorm, lgOf, envFactorsOf, modelGates: ctx.modelGates });

  const bm = prep(`
"""
new = """  const durable = estimateDurableTraits(db, p.player_id, targetSeason,
    { cfg, runNorm, fldNorm, lgOf, envFactorsOf, modelGates: ctx.modelGates });

  // ---- 走力の上位証拠を、残差計算より前に組み立てる（2026-08-07）----
  // 統計走力はscale_calibration前の内部目盛り、直接計測/スカウティングは最終目盛りなので、
  // reconcileSpeedEvidence() で同じ最終目盛りへ写してから統合し、共通zへ逆変換する。
  // これにより「表示だけ実測、盗塁・守備は統計z」という二重の脚力を作らない。
  const scout = opts.scoutingLedger ?? null;
  const dbName = p.name;
  const speedScout = scout ? scoutLookup(scout, dbName, targetSeason, '走力') : null;
  const bridgeRow = (() => {
    try {
      return db.prepare(`SELECT sprint_speed_avg, sprint_years, arm_mph_avg, arm_years, detail
                         FROM mlb_bridge WHERE proeye_id=?`).get(p.player_id) ?? null;
    } catch { return null; }
  })();
  const npbPlusBaseRow = (() => {
    try { return db.prepare(`SELECT * FROM npb_plus_measurement WHERE player_id=?`).get(p.player_id) ?? null; }
    catch { return null; }
  })();
  const directCfg = {
    ...cfg.direct_measurement,
    npb_plus_direct: cfg.npb_plus_direct,
    scale_calibration: cfg.scale_calibration,
  };
  const speedDirect = buildDirectMeasurements(
    { ...(bridgeRow ?? {}), ...(npbPlusBaseRow ?? {}) }, directCfg, targetSeason).走力;

  const bm = prep(`
"""
replace_once(old, new)

old = """    const speedState = resolveFinalSpeed(sc.score, durable.speed, {
      weight: line.PA, season: targetSeason,
    }, cfg);
    const speedZFinal = speedState?.zFinal ?? null;
"""
new = """    const statisticalSpeedState = resolveFinalSpeed(sc.score, durable.speed, {
      weight: line.PA, season: targetSeason,
    }, cfg);
    const speedState = reconcileSpeedEvidence(
      statisticalSpeedState,
      { direct: speedDirect, scouting: speedScout },
      cfg);
    const speedZFinal = speedState?.zFinal ?? null;
"""
replace_once(old, new)

old = """    run = speedState ? {
      speed: speedState.rating,
      speedDetail: speedState.detail,
      stealing: stealingAbility({ SB: line.SB, CS: line.CS, PA: line.PA }, bm.wsb, speedZFinal, runNorm, cfg),
"""
new = """    run = speedState ? {
      // speed は内部raw目盛り。speedDisplay はscale_calibration後の最終目盛り。
      // _z はこの最終表示値と同じ潜在脚力へ逆変換した共通z。
      speed: speedState.rating,
      speedDisplay: speedState.finalRating,
      speedEvidence: speedState.evidence,
      speedDetail: speedState.detail,
      stealing: stealingAbility({ SB: line.SB, CS: line.CS, PA: line.PA }, bm.wsb, speedZFinal, runNorm, cfg),
"""
replace_once(old, new)

old = """  const scout = opts.scoutingLedger ?? null;
  const dbName = p.name;
  const runRec = scout ? scoutReconcile(r1(run?.speed), scoutLookup(scout, dbName, targetSeason, '走力')) : null;
  const armRec = scout ? scoutReconcile(r1(armForSheet?.rating), scoutLookup(scout, dbName, targetSeason, '肩力')) : null;

  // ---- 直接計測（第1階層）を能力欄へ届ける ----
"""
new = """  // 走力は上で既に統計・直接計測・スカウティングを統合済み。
  // ability_evidence用には、統計の最終目盛りとスカウティング原票を別々に残す。
  const runRec = speedScout ? {
    value: r1(run?.speedDisplay),
    statistical_value: r1(run?.speedEvidence?.statistical_final_scale),
    gap: Number.isFinite(run?.speedDisplay) && Number.isFinite(run?.speedEvidence?.statistical_final_scale)
      ? r1(run.speedDisplay - run.speedEvidence.statistical_final_scale) : null,
    scouting: speedScout,
    scouting_value: speedScout.value,
  } : null;
  const armRec = scout ? scoutReconcile(r1(armForSheet?.rating), scoutLookup(scout, dbName, targetSeason, '肩力')) : null;

  // ---- 直接計測（第1階層）を能力欄へ届ける ----
"""
replace_once(old, new)

# bridgeRow was moved before the running/fielding residual calculations.
old = """  const bridgeRow = (() => {
    try {
      return db.prepare(`SELECT sprint_speed_avg, sprint_years, arm_mph_avg, arm_years, detail
                         FROM mlb_bridge WHERE proeye_id=?`).get(p.player_id) ?? null;
    } catch { return null; }   // mlb_bridge が無いDBでも査定は動く
  })();

"""
replace_once(old, "")

old = """  const npbPlusRow = (() => {
    try {
      // ★2026-08-05修理: ここは捕手の送球速度だけを取る作りだった。
      //   パワー・走力の実測（打球速度・ハードヒット率・瞬間最高速度など）を足したので、
      //   全選手・全項目を取る。送球速度だけは捕手にしか使わないので、その印だけ残す。
      const r = db.prepare(`SELECT * FROM npb_plus_measurement WHERE player_id=?`).get(p.player_id);
      if (!r) return null;
      const isCatcher = fldRows.some(f => f.pos === 'C') || p.position === '捕';
      return { ...r, is_catcher: isCatcher };
    } catch { return null; }
  })();
"""
new = """  const npbPlusRow = (() => {
    if (!npbPlusBaseRow) return null;
    // 送球速度だけは捕手にしか使わないので、守備行が揃った後で印を足す。
    const isCatcher = fldRows.some(f => f.pos === 'C') || p.position === '捕';
    return { ...npbPlusBaseRow, is_catcher: isCatcher };
  })();
"""
replace_once(old, new)

old = """  const directs = buildDirectMeasurements(
    { ...(bridgeRow ?? {}), ...(npbPlusRow ?? {}) },
    {
      ...cfg.direct_measurement,
      npb_plus_direct: cfg.npb_plus_direct,
      // ★仕様アンカーを持つ能力（ミート・パワー）を渡す。NPB+のモデルはパワプロの能力値を
      //   目標に当てはめた式なので、アンカーで作った値へ混ぜると目盛りが2つになる（2026-08-06）。
      //   ここで抜き出して渡さないと、direct_measurement 側からは scale_calibration が見えない。
      scale_calibration: cfg.scale_calibration,
    }, targetSeason);
"""
new = """  const directs = buildDirectMeasurements(
    { ...(bridgeRow ?? {}), ...(npbPlusRow ?? {}) }, directCfg, targetSeason);
"""
replace_once(old, new)

old = """  // 能力欄をゲームの構成どおりに組み立てる（オーナー確定 2026-08-01）。
  // ミート・パワーは得能付与Phase3b(2026-08-04)で台帳反映後の値(batAdjusted)を使う
  const abilitySheet = buildAbilitySheet({
"""
new = """  // 走力の能力欄には、上で共通zへ反映済みの最終目盛りを渡す。
  // ここで再びblendDirect()すると同じ実測を二重適用するため禁止。
  const speedOverride = (() => {
    const e = run?.speedEvidence;
    if (!e || e.decided_by === 'statistical') return null;
    if (e.decided_by === 'direct_blend') return {
      value: r1(run.speedDisplay),
      _direct: e.direct,
      _statistical_rating: r1(e.statistical_final_scale),
      _weight: e.external_weight,
    };
    if (e.decided_by === 'scouting') return {
      value: r1(run.speedDisplay),
      scouting: e.scouting,
      statistical_value: r1(e.statistical_final_scale),
      gap: Number.isFinite(run.speedDisplay) && Number.isFinite(e.statistical_final_scale)
        ? r1(run.speedDisplay - e.statistical_final_scale) : null,
    };
    return null;
  })();

  // 外部証拠を使った走力のprovenanceを、Basement単独と誤表示しない。
  if (run?.speedEvidence?.decided_by && run.speedEvidence.decided_by !== 'statistical') {
    provenanceByValue.speed = withProvenance(r1(run.speedDisplay), SOURCES.derived, {
      season: targetSeason, isEstimated: true,
      method: '統計走力を最終目盛りへ変換し、直接計測/スカウティングと統合後に共通zへ逆変換',
      notes: `決定=${run.speedEvidence.decided_by}; 外部=${run.speedEvidence.external_source ?? 'scouting'}; `
        + `統計最終目盛り=${r1(run.speedEvidence.statistical_final_scale)} → 最終=${r1(run.speedDisplay)}`,
    });
  }

  // 能力欄をゲームの構成どおりに組み立てる（オーナー確定 2026-08-01）。
  // ミート・パワーは得能付与Phase3b(2026-08-04)で台帳反映後の値(batAdjusted)を使う
  const abilitySheet = buildAbilitySheet({
"""
replace_once(old, new)

replace_once(
"    speedOverride: runRec?.scouting ? runRec : blendDirect(run?.speed, directs.走力),\n",
"    speedOverride,\n",
)

replace_once(
"      speed: r1(run?.speed), stealing: r1(run?.stealing?.rating), baserunning: r1(run?.baserunning?.rating),\n",
"      speed: r1(run?.speed), speed_display: r1(run?.speedDisplay),\n"
"      speed_evidence: run?.speedEvidence ?? null,\n"
"      stealing: r1(run?.stealing?.rating), baserunning: r1(run?.baserunning?.rating),\n",
)

replace_once(
"    走力: evOf('走力', runRec, r1(run?.speed), ['三塁打率', '併殺回避率', 'UBR']),\n",
"    // proxyは直接計測と同じ最終目盛りに揃える。run.speed（内部raw）を渡すと単位が混ざる。\n"
"    走力: evOf('走力', runRec, r1(run?.speedEvidence?.statistical_final_scale ?? run?.speedDisplay),\n"
"      ['三塁打率', '併殺回避率', 'UBR', '内野安打率']),\n",
)

p.write_text(s)
