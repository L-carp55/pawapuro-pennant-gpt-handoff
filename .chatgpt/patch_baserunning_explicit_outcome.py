from pathlib import Path

p = Path('scripts/build_baserunning_advances.mjs')
s = p.read_text(encoding='utf-8')

def repl(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s = s.replace(old, new)

repl(
"""  explicitPreplayBasePattern,\n  reconcileRunnerStateWithPattern,\n""",
"""  explicitPreplayBasePattern,\n  explicitPostplayBasePattern,\n  classifyAdvanceOutcomeFromPatterns,\n  reconcileRunnerStateWithPattern,\n""",
'import explicit outcome helpers')

repl(
"""const reconciliation = { explicitResolved: 0, explicitUncertain: 0, noPattern: 0 };\nconst rowsBySeason = new Map();\n""",
"""const reconciliation = { explicitResolved: 0, explicitUncertain: 0, noPattern: 0 };\nconst outcomeLabels = { explicit: 0, nextState: 0, explicitVsStateDisagreement: 0 };\nconst rowsBySeason = new Map();\n""",
'add outcome label stats')

repl(
"""    const isDouble = /二塁打|ツーベース/.test(d);\n    if (!isSingle && !isDouble) continue;\n\n    if (!curState?.last) { excludedUncertainState.current++; continue; }\n""",
"""    const isDouble = /二塁打|ツーベース/.test(d);\n    if (!isSingle && !isDouble) continue;\n    const explicitStartPattern = explicitPreplayBasePattern(d);\n    const explicitEndPattern = explicitPostplayBasePattern(d);\n\n    if (!curState?.last) { excludedUncertainState.current++; continue; }\n""",
'capture explicit start/end patterns')

repl(
"""    const classifyAndPush = (kind, runner) => {\n      const success = classifyAdvanceOutcome(kind, runner, nextBases, outsBefore, outsAfter);\n      if (success == null) { excludedAmbiguous[kind]++; return; }\n      push(kind, runner, success);\n    };\n""",
"""    const classifyAndPush = (kind, runner) => {\n      const stateSuccess = classifyAdvanceOutcome(kind, runner, nextBases, outsBefore, outsAfter);\n      const explicitSuccess = classifyAdvanceOutcomeFromPatterns(kind, explicitStartPattern, explicitEndPattern);\n      if (explicitSuccess != null) {\n        if (stateSuccess != null && stateSuccess !== explicitSuccess) outcomeLabels.explicitVsStateDisagreement++;\n        outcomeLabels.explicit++;\n        push(kind, runner, explicitSuccess);\n        return;\n      }\n      if (stateSuccess == null) { excludedAmbiguous[kind]++; return; }\n      outcomeLabels.nextState++;\n      push(kind, runner, stateSuccess);\n    };\n""",
'prefer explicit post-play outcome')

repl(
"""console.log(`  reconciliation explicitResolved=${reconciliation.explicitResolved} explicitUncertain=${reconciliation.explicitUncertain} noPattern=${reconciliation.noPattern}`);\n""",
"""console.log(`  reconciliation explicitResolved=${reconciliation.explicitResolved} explicitUncertain=${reconciliation.explicitUncertain} noPattern=${reconciliation.noPattern}`);\nconsole.log(`  outcome labels explicit=${outcomeLabels.explicit} nextState=${outcomeLabels.nextState} explicitVsStateDisagreement=${outcomeLabels.explicitVsStateDisagreement}`);\n""",
'print outcome label stats')

p.write_text(s, encoding='utf-8')
print('patched builder explicit outcome')

p = Path('scripts/test_baserunning_events.mjs')
s = p.read_text(encoding='utf-8')

def repl2(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, got {n}')
    s = s.replace(old, new)

repl2(
"""  explicitPreplayBasePattern,\n  reconcileRunnerStateWithPattern,\n""",
"""  explicitPreplayBasePattern,\n  explicitPostplayBasePattern,\n  classifyAdvanceOutcomeFromPatterns,\n  reconcileRunnerStateWithPattern,\n""",
'test import explicit outcome helpers')

anchor = """assert.equal(explicitPreplayBasePattern('センターへのヒット'), null);\n"""
addition = """assert.equal(explicitPreplayBasePattern('センターへのヒット'), null);\nassert.deepEqual(explicitPostplayBasePattern('1アウト二塁からレフトへのヒットで出塁 一三塁'), { token: '一三塁', bases: [1, 3] });\nassert.deepEqual(explicitPostplayBasePattern('0アウト一塁からライトへのツーベース 二三塁'), { token: '二三塁', bases: [2, 3] });\nassert.equal(explicitPostplayBasePattern('1アウト二塁からセンターへのヒット'), null);\nassert.equal(classifyAdvanceOutcomeFromPatterns('2nd_to_home', { bases: [2] }, { bases: [1, 3] }), 0);\nassert.equal(classifyAdvanceOutcomeFromPatterns('2nd_to_home', { bases: [2] }, { bases: [1] }), 1);\nassert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_home_on_2b', { bases: [1] }, { bases: [2, 3] }), 0);\nassert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_home_on_2b', { bases: [1] }, { bases: [2] }), 1);\nassert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_3rd', { bases: [1] }, { bases: [1, 3] }), 1);\nassert.equal(classifyAdvanceOutcomeFromPatterns('1st_to_3rd', { bases: [1] }, { bases: [1, 2] }), 0);\n"""
repl2(anchor, addition, 'add explicit outcome tests')

s = s.replace("baserunning event inference: 47 checks passed", "baserunning event inference: 56 checks passed")
p.write_text(s, encoding='utf-8')
print('patched tests explicit outcome')
