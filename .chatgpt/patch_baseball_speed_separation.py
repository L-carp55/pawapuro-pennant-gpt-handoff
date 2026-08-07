from pathlib import Path

p = Path('src/cards/pipeline.mjs')
s = p.read_text(encoding='utf-8')

def repl(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {n}')
    s = s.replace(old, new)

repl(
"""  let run = null;\n  let infieldHitSpecial = null;\n  if (bm) {\n""",
"""  let run = null;\n  let infieldHitSpecial = null;\n  const speedGate = ctx.modelGates?.speed_ability;\n  const stealingGate = ctx.modelGates?.stealing_ability;\n  const infieldHitGate = ctx.modelGates?.infield_hit_ability;\n  if (bm) {\n""",
'insert running gates')

repl(
"""    // infieldHitAbility 側で、最終走力zで説明できる分を除いて得能を判定する。\n    infieldHitSpecial = infieldHitAbility(gbSingleExcess, speedZFinal, cfg);\n""",
"""    // 内野安打○は純粋走力で説明できる分を引いた残差として作る。\n    // 旧走力は内野安打自身を材料に含んでおり循環するため、新baseball speed確定まで停止。\n    infieldHitSpecial = (speedGate?.enabled === false || infieldHitGate?.enabled === false)\n      ? null\n      : infieldHitAbility(gbSingleExcess, speedZFinal, cfg);\n""",
'gate infield hit')

repl(
"""    run = speedState ? {\n      // speed は内部raw目盛り。speedDisplay はscale_calibration後の最終目盛り。\n      // _z はこの最終表示値と同じ潜在脚力へ逆変換した共通z。\n      speed: speedState.rating,\n      speedDisplay: speedState.finalRating,\n      speedEvidence: speedState.evidence,\n      speedDetail: speedState.detail,\n      stealing: stealingAbility({ SB: line.SB, CS: line.CS, PA: line.PA }, bm.wsb, speedZFinal, runNorm, cfg),\n      baserunning,\n      baserunningStatus: baserunningGate?.enabled === false ? baserunningGate : null,\n      advanceSourceStatus: advanceGate?.enabled === false ? advanceGate : null,\n      _z: speedZFinal,\n      _singleYearZ: sc.score,\n      _infieldHitExcess: gbSingleExcess,\n    } : null;\n""",
"""    run = speedState ? {\n      // 旧proxyは研究/evidence用に残すが、最終走力は新baseball speedの較正まで出さない。\n      speed: speedGate?.enabled === false ? null : speedState.rating,\n      speedDisplay: speedGate?.enabled === false ? null : speedState.finalRating,\n      speedEvidence: speedState.evidence,\n      speedDetail: {\n        ...speedState.detail,\n        ...(speedGate?.enabled === false ? {\n          legacy_only: true,\n          legacy_rating: speedState.rating,\n          legacy_final_rating: speedState.finalRating,\n          _pause_reason: speedGate.reason,\n        } : {}),\n      },\n      stealing: (speedGate?.enabled === false || stealingGate?.enabled === false)\n        ? null\n        : stealingAbility({ SB: line.SB, CS: line.CS, PA: line.PA }, bm.wsb, speedZFinal, runNorm, cfg),\n      baserunning,\n      baserunningStatus: baserunningGate?.enabled === false ? baserunningGate : null,\n      stealingStatus: (speedGate?.enabled === false || stealingGate?.enabled === false)\n        ? (stealingGate ?? speedGate) : null,\n      infieldHitStatus: (speedGate?.enabled === false || infieldHitGate?.enabled === false)\n        ? (infieldHitGate ?? speedGate) : null,\n      advanceSourceStatus: advanceGate?.enabled === false ? advanceGate : null,\n      // legacy fielding evidenceの再現用。最終走力としては使わない。\n      _z: speedZFinal,\n      _legacySpeedZ: speedZFinal,\n      _singleYearZ: sc.score,\n      _infieldHitExcess: gbSingleExcess,\n    } : null;\n""",
'pause speed and stealing outputs')

repl(
"""  const speedOverride = (() => {\n    const e = run?.speedEvidence;\n""",
"""  const speedOverride = (() => {\n    if (ctx.modelGates?.speed_ability?.enabled === false) return null;\n    const e = run?.speedEvidence;\n""",
'gate speed override')

repl(
"""  if (run?.speedEvidence?.decided_by && run.speedEvidence.decided_by !== 'statistical') {\n""",
"""  if (ctx.modelGates?.speed_ability?.enabled !== false\n      && run?.speedEvidence?.decided_by && run.speedEvidence.decided_by !== 'statistical') {\n""",
'gate final speed provenance')

repl(
"""    unappraisedReasons: ctx.modelGates?.baserunning_ability?.enabled === false\n      ? { 走塁: ctx.modelGates.baserunning_ability.reason }\n      : {},\n""",
"""    unappraisedReasons: {\n      ...(ctx.modelGates?.speed_ability?.enabled === false\n        ? { 走力: ctx.modelGates.speed_ability.reason } : {}),\n      ...(ctx.modelGates?.stealing_ability?.enabled === false\n        ? { 盗塁: ctx.modelGates.stealing_ability.reason } : {}),\n      ...(ctx.modelGates?.baserunning_ability?.enabled === false\n        ? { 走塁: ctx.modelGates.baserunning_ability.reason } : {}),\n    },\n""",
'pass unappraised reasons')

repl(
"""      ...(ctx.modelGates?.baserunning_ability?.enabled === false\n        ? [`走塁: ${ctx.modelGates.baserunning_ability.reason}`] : []),\n""",
"""      ...(ctx.modelGates?.speed_ability?.enabled === false\n        ? [`走力: ${ctx.modelGates.speed_ability.reason}`] : []),\n      ...(ctx.modelGates?.stealing_ability?.enabled === false\n        ? [`盗塁: ${ctx.modelGates.stealing_ability.reason}`] : []),\n      ...(ctx.modelGates?.infield_hit_ability?.enabled === false\n        ? [`内野安打○: ${ctx.modelGates.infield_hit_ability.reason}`] : []),\n      ...(ctx.modelGates?.baserunning_ability?.enabled === false\n        ? [`走塁: ${ctx.modelGates.baserunning_ability.reason}`] : []),\n""",
'add unresolved speed skills')

p.write_text(s, encoding='utf-8')
print('patched src/cards/pipeline.mjs')
