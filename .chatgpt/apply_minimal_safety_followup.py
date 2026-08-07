from pathlib import Path
import json, subprocess

ROOT=Path('.')

def replace_one(path, old, new, label):
    p=Path(path); s=p.read_text(encoding='utf-8'); n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    p.write_text(s.replace(old,new),encoding='utf-8')

def copy_from_archive(path):
    r=subprocess.run(['git','show',f'origin/agent/satei-phase1-safety:{path}'],capture_output=True)
    if r.returncode: raise SystemExit(r.stderr.decode())
    Path(path).write_bytes(r.stdout)

# Isolated safety files only. No research engines/audits copied.
for f in ['src/ratings/direct_measurement.mjs','src/ratings/scouting_input.mjs','src/ratings/ability_evidence.mjs','configs/scouting.json']:
    copy_from_archive(f)

# Compact safety gates: decisions only, not the large research payload.
gates={
  '_comment':'未完成・定義不一致モデルを仮査定で確定値として出さないための整理版安全ゲート。',
  'asof_aggregate_evidence':{
    'catcher_fielding':{'max_evidence_season':2026},
    'catcher_throw_accuracy':{'max_evidence_season':2026},
    'infield_throw_accuracy':{'max_evidence_season':2026}
  },
  'speed_ability':{'enabled':False,'status':'PAUSED_REDEFINE_BASEBALL_SPEED','reason':'旧走力は内野安打・UBR・併殺回避等の走塁結果を含み、純粋な野球上の脚力と技術を分離できていないため未査定'},
  'stealing_ability':{'enabled':False,'status':'PAUSED_DEPENDS_ON_NEW_SPEED','reason':'盗塁技術は純粋走力で説明できる分を除いた残差として再設計するため、新走力確定まで未査定'},
  'infield_hit_ability':{'enabled':False,'status':'PAUSED_DEPENDS_ON_NEW_SPEED','reason':'内野安打○は純粋走力と打球難度を除いた技術残差として再設計するため未査定'},
  'baserunning_ability':{'enabled':False,'status':'PAUSED','reason':'走塁得能は走力との循環・機会選択・低再現性があるため未査定'},
  'fielding_ability':{'enabled':False,'status':'PAUSED_REDEFINE','reason':'旧RngR−走力残差の定義を撤回。反応・一歩目・加速・判断等を含み走力と共同で範囲を作るモデルへ再設計するため未査定'},
  'infield_arm_ability':{'enabled':False,'status':'PAUSED_INVALID_POSITION_PRIOR','reason':'内野肩の守備位置ベース推定は外部検証で無効。直接根拠のない内野肩は未査定'},
  'catching_ability':{'enabled':True,'status':'PROVISIONAL_REDESIGN','reason':'捕球は現行ErrR/FE値を暫定表示。難易度調整expected-error研究は本番未採用'}
}
Path('configs/model_gates.json').write_text(json.dumps(gates,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Strict as-of cutoffs for same-player priors.
replace_one('src/cards/pipeline.mjs',
"if (f.season < season - 3 || f.season > season + 3) continue;",
"if (f.season < season - 3 || f.season > season) continue;",
'farm as-of cutoff')
replace_one('src/cards/pipeline.mjs',
".all(p.player_id, targetSeason - 3, targetSeason + 3)",
".all(p.player_id, targetSeason - 3, targetSeason)",
'batting prior as-of cutoff')

# Speed / running-special gates while keeping legacy calculations in logs.
replace_one('src/cards/pipeline.mjs',
"  let run = null;\n  let infieldHitSpecial = null;\n  if (bm) {",
"  let run = null;\n  let infieldHitSpecial = null;\n  const speedGate = ctx.modelGates?.speed_ability;\n  const stealingGate = ctx.modelGates?.stealing_ability;\n  const infieldHitGate = ctx.modelGates?.infield_hit_ability;\n  if (bm) {",
'run gates')
replace_one('src/cards/pipeline.mjs',
"    infieldHitSpecial = infieldHitAbility(gbSingleExcess, speedZFinal, cfg);",
"    infieldHitSpecial = (speedGate?.enabled === false || infieldHitGate?.enabled === false)\n      ? null : infieldHitAbility(gbSingleExcess, speedZFinal, cfg);",
'infield hit gate')
replace_one('src/cards/pipeline.mjs',
"      speed: speedState.rating,\n      speedDetail: speedState.detail,\n      stealing: stealingAbility({ SB: line.SB, CS: line.CS, PA: line.PA }, bm.wsb, speedZFinal, runNorm, cfg),",
"      speed: speedGate?.enabled === false ? null : speedState.rating,\n      speedDetail: { ...speedState.detail, ...(speedGate?.enabled === false ? { legacy_only: true, legacy_rating: speedState.rating, _pause_reason: speedGate.reason } : {}) },\n      stealing: (speedGate?.enabled === false || stealingGate?.enabled === false)\n        ? null : stealingAbility({ SB: line.SB, CS: line.CS, PA: line.PA }, bm.wsb, speedZFinal, runNorm, cfg),",
'speed and stealing gates')

# Aggregate future evidence helpers + defense gates.
replace_one('src/cards/pipeline.mjs',
"  const fld = fldRows.length ? appraiseAllPositions(fldRows, run?._z ?? 0, fldNorm, cfg) : [];\n\n  // 捕手の守備力を差し込む",
"  const fld = fldRows.length ? appraiseAllPositions(fldRows, run?._z ?? 0, fldNorm, cfg) : [];\n  const fieldingGate = ctx.modelGates?.fielding_ability;\n  const infieldArmGate = ctx.modelGates?.infield_arm_ability;\n  const aggregateEvidenceAllowed = key => {\n    const maxSeason = Number(ctx.modelGates?.asof_aggregate_evidence?.[key]?.max_evidence_season);\n    return !Number.isFinite(maxSeason) || targetSeason >= maxSeason;\n  };\n  const recordEvidenceEndsBy = rec => {\n    const ys = rec?.seasons;\n    const end = Array.isArray(ys) && ys.length ? Number(ys[ys.length - 1]) : null;\n    return Number.isFinite(end) && end <= targetSeason;\n  };\n\n  // 捕手の守備力を差し込む",
'defense/asof helpers')
replace_one('src/cards/pipeline.mjs',
"  const catcherFld = ctx.catcherFielding?.get(normName(p.name));\n  if (catcherFld) {",
"  const catcherFld = aggregateEvidenceAllowed('catcher_fielding') ? ctx.catcherFielding?.get(normName(p.name)) : null;\n  if (catcherFld && fieldingGate?.enabled !== false) {",
'catcher aggregate cutoff')
# After any catcher injection, suppress the rejected fielding definition but preserve legacy object.
replace_one('src/cards/pipeline.mjs',
"  // ---- チャンス・対左の素点（splits と ctxSel は査定の前で決めてある） ----",
"  if (fieldingGate?.enabled === false) {\n    for (const f of fld) { if (f.fielding) f._legacy_fielding = f.fielding; f.fielding = null; }\n  }\n\n  // ---- チャンス・対左の素点（splits と ctxSel は査定の前で決めてある） ----",
'fielding output gate')

# Disable invalid infield arm prior after durable arm is calculated.
replace_one('src/cards/pipeline.mjs',
"  if (armForSheet) for (const f of fld) f.arm = armForSheet;",
"  if (armForSheet) for (const f of fld) f.arm = armForSheet;\n  const primaryIsInfield = ['一','二','三','遊'].includes(p.position);\n  const pauseInfieldArm = primaryIsInfield && infieldArmGate?.enabled === false;\n  if (pauseInfieldArm) for (const f of fld) { if (f.arm) f._legacy_arm = f.arm; f.arm = null; }",
'infield arm output gate')

# Direct > decision scouting > statistical. evidence_only returns source=statistical in copied reconcile().
replace_one('src/cards/pipeline.mjs',
"    // 優先順: スカウティング評価 > 直接計測 > 統計（仕様04 §1.2 の階層どおり）\n    arm: (armRec?.scouting ? { ...armForSheetFinal, rating: armRec.value, _reconciled: armRec } : armForSheetFinal),",
"    // 優先順: 直接計測 > decisionスカウティング > 統計。evidence_onlyは上書きしない。\n    arm: pauseInfieldArm && !armDirect ? null : (armDirect\n      ? armForSheetFinal\n      : armRec?.source?.startsWith('scouting:') ? { ...armForSheetFinal, rating: armRec.value, _reconciled: armRec } : armForSheetFinal),",
'arm priority/gate')
replace_one('src/cards/pipeline.mjs',
"    speedOverride: runRec?.scouting ? runRec : blendDirect(run?.speed, directs.走力),",
"    speedOverride: speedGate?.enabled === false ? null\n      : (runRec?.source?.startsWith('scouting:') ? runRec : blendDirect(run?.speed, directs.走力)),",
'speed priority/gate')
replace_one('src/cards/pipeline.mjs',
"    unappraisedReasons: ctx.modelGates?.baserunning_ability?.enabled === false\n      ? { 走塁: ctx.modelGates.baserunning_ability.reason }\n      : {},",
"    unappraisedReasons: {\n      ...(speedGate?.enabled === false ? { 走力: speedGate.reason } : {}),\n      ...(stealingGate?.enabled === false ? { 盗塁: stealingGate.reason } : {}),\n      ...(ctx.modelGates?.baserunning_ability?.enabled === false ? { 走塁: ctx.modelGates.baserunning_ability.reason } : {}),\n      ...(fieldingGate?.enabled === false ? { 守備力: fieldingGate.reason } : {}),\n      ...(pauseInfieldArm ? { 肩力: infieldArmGate.reason } : {}),\n    },\n    provisionalStatus: { 捕球: ctx.modelGates?.catching_ability ?? null },",
'unappraised/provisional status')

# TE/aggregate throw evidence must not use future aggregated player evidence.
replace_one('src/cards/pipeline.mjs',
"        const byTe = ctx.throwAccuracyTe?.get(`${normName(p.name)}|${p.position}`);",
"        const byTeRaw = ctx.throwAccuracyTe?.get(`${normName(p.name)}|${p.position}`);\n        const byTe = recordEvidenceEndsBy(byTeRaw) ? byTeRaw : null;",
'trow TE cutoff')
replace_one('src/cards/pipeline.mjs',
"        const t = ctx.catcherThrow?.get(normName(p.name));",
"        const t = aggregateEvidenceAllowed('catcher_throw_accuracy') ? ctx.catcherThrow?.get(normName(p.name)) : null;",
'catcher throw cutoff')
replace_one('src/cards/pipeline.mjs',
"        const f = ctx.infieldThrow?.get(normName(p.name));",
"        const f = aggregateEvidenceAllowed('infield_throw_accuracy') ? ctx.infieldThrow?.get(normName(p.name)) : null;",
'infield throw cutoff')

# Card raw ratings must mirror safe display state.
replace_one('src/cards/pipeline.mjs',
"      speed: r1(run?.speed), stealing: r1(run?.stealing?.rating), baserunning: r1(run?.baserunning?.rating),",
"      speed: r1(run?.speed), stealing: r1(run?.stealing?.rating), baserunning: r1(run?.baserunning?.rating),",
'ratings anchor')  # explicit no-op anchor validates expected clean block exists

# Unresolved list gets explicit safety reasons.
replace_one('src/cards/pipeline.mjs',
"      ...(ctx.modelGates?.baserunning_ability?.enabled === false\n        ? [`走塁: ${ctx.modelGates.baserunning_ability.reason}`] : []),",
"      ...(speedGate?.enabled === false ? [`走力: ${speedGate.reason}`] : []),\n      ...(stealingGate?.enabled === false ? [`盗塁: ${stealingGate.reason}`] : []),\n      ...(infieldHitGate?.enabled === false ? [`内野安打○: ${infieldHitGate.reason}`] : []),\n      ...(ctx.modelGates?.baserunning_ability?.enabled === false ? [`走塁: ${ctx.modelGates.baserunning_ability.reason}`] : []),\n      ...(fieldingGate?.enabled === false ? [`守備力: ${fieldingGate.reason}`] : []),\n      ...(pauseInfieldArm ? [`肩力: ${infieldArmGate.reason}`] : []),",
'unresolved safety reasons')

# Ability-sheet can mark provisional catching without changing its number.
replace_one('src/cards/ability_sheet.mjs',
"    arm = null, speedOverride = null, powerOverride = null, specialAbilities = {},\n    unappraisedReasons = {},",
"    arm = null, speedOverride = null, powerOverride = null, specialAbilities = {},\n    unappraisedReasons = {}, provisionalStatus = {},",
'ability provisional input')
replace_one('src/cards/ability_sheet.mjs',
"    捕球: graded(primary?.catching?.rating, cfg, primary ? { position: primary.pos } : {}),",
"    捕球: graded(primary?.catching?.rating, cfg, primary ? { position: primary.pos,\n      ...(provisionalStatus?.捕球 ? { provisional: true, status: provisionalStatus.捕球.status, _note: provisionalStatus.捕球.reason } : {}) } : {}),",
'catching provisional marker')

print('minimal safety follow-up patched')
