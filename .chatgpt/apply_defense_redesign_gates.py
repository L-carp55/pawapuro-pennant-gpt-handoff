from pathlib import Path

# ---- fielding.mjs ----
p=Path('src/ratings/fielding.mjs')
s=p.read_text()

def once(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)

once(
"export function appraiseAllPositions(fieldRows, speedScore, norm, cfg) {",
"export function appraiseAllPositions(fieldRows, speedScore, norm, cfg, modelGates = {}) {",
'fielding signature')
once(
"  const hasMeasuredArm = rows.some(f => armRating(f, norm, cfg) != null);\n  const inferredArm = hasMeasuredArm ? null : inferredInfieldArm(rows, norm, cfg);\n\n  return rows.map((f, i) => {\n    const measured = armRating(f, norm, cfg);\n    return {\n      pos: f.pos, inn: f.inn, isPrimary: i === 0,\n      fielding: fieldingRating(f, speedScore, norm, cfg),\n      catching: catchingRating(f, norm, cfg),\n      arm: measured ?? (INFIELD.includes(f.pos) ? inferredArm : null),",
"  const hasMeasuredArm = rows.some(f => armRating(f, norm, cfg) != null);\n  const inferredArmLegacy = hasMeasuredArm ? null : inferredInfieldArm(rows, norm, cfg);\n  const inferredArm = modelGates?.infield_arm_ability?.enabled === false && inferredArmLegacy\n    ? { ...inferredArmLegacy, legacy_rating: inferredArmLegacy.rating, rating: null,\n        _status: modelGates.infield_arm_ability.status,\n        _note: modelGates.infield_arm_ability.reason }\n    : inferredArmLegacy;\n\n  return rows.map((f, i) => {\n    const measured = armRating(f, norm, cfg);\n    const fieldingLegacy = fieldingRating(f, speedScore, norm, cfg);\n    const fielding = modelGates?.fielding_ability?.enabled === false && fieldingLegacy\n      ? { ...fieldingLegacy, legacy_rating: fieldingLegacy.rating, rating: null,\n          _status: modelGates.fielding_ability.status,\n          _note: modelGates.fielding_ability.reason }\n      : fieldingLegacy;\n    const catchingLegacy = catchingRating(f, norm, cfg);\n    const catching = catchingLegacy && modelGates?.catching_ability\n      ? { ...catchingLegacy, _status: modelGates.catching_ability.status,\n          _note_redesign: modelGates.catching_ability.reason }\n      : catchingLegacy;\n    return {\n      pos: f.pos, inn: f.inn, isPrimary: i === 0,\n      fielding,\n      catching,\n      arm: measured ?? (INFIELD.includes(f.pos) ? inferredArm : null),",
'fielding gate body')
p.write_text(s)

# ---- pipeline.mjs ----
p=Path('src/cards/pipeline.mjs')
s=p.read_text()
def oncep(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)
oncep(
"  const fld = fldRows.length ? appraiseAllPositions(fldRows, run?._z ?? 0, fldNorm, cfg) : [];",
"  const fld = fldRows.length ? appraiseAllPositions(fldRows, run?._z ?? 0, fldNorm, cfg, ctx.modelGates) : [];",
'pipeline fielding gate pass')
oncep(
"  if (catcherFld) {\n    const cRow = fld.find(f => f.pos === 'C');",
"  if (catcherFld && ctx.modelGates?.fielding_ability?.enabled !== false) {\n    const cRow = fld.find(f => f.pos === 'C');",
'pipeline catcher fielding gate')
p.write_text(s)

# ---- ability_sheet.mjs ----
p=Path('src/cards/ability_sheet.mjs')
s=p.read_text()
def oncea(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)
oncea(
"  肩力: '実測（ARM・補殺）も守備位置からの推定も作れない',",
"  肩力: '内野の守備位置ベース推定は外部検証で不合格のため停止。実測ARM等の有効な肩材料が無い場合は未査定',",
'ability reason arm')
oncea(
"  守備力: '守備範囲（RngR）が無い',",
"  守備力: '旧RngR−走力残差の定義を停止中。反応・一歩目・加速等を含むspeed×fielding応答モデルへ再設計中',",
'ability reason fielding')
# catcher-specific reason should not overwrite the new global redesign reason while the gate is active.
oncea(
"      if (name === '守備力' && primary?.pos === 'C') {",
"      if (name === '守備力' && primary?.pos === 'C' && !primary?.fielding?._status) {",
'ability catcher reason gate')
p.write_text(s)
