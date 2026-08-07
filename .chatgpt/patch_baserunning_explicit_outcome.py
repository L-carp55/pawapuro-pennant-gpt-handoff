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
