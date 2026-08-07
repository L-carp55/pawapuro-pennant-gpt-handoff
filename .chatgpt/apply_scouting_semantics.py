from pathlib import Path

def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'{path}: expected 1 match, got {n}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1))

def replace_exact_count(path, old, new, expected):
    p = Path(path)
    s = p.read_text()
    n = s.count(old)
    if n != expected:
        raise SystemExit(f'{path}: expected {expected} matches, got {n}: {old[:120]!r}')
    p.write_text(s.replace(old, new))

# scouting_input: applicationを検証し、evidence_onlyは数値決定に使わない。
replace_once('src/ratings/scouting_input.mjs',
"""  if (!(e.value >= 1 && e.value <= 100)) {
    throw new ScoutingProvenanceError(`値は1-100の範囲（${e.player} の ${e.ability} = ${e.value}）`);
  }
  return {
    ...e,
""",
"""  if (!(e.value >= 1 && e.value <= 100)) {
    throw new ScoutingProvenanceError(`値は1-100の範囲（${e.player} の ${e.ability} = ${e.value}）`);
  }
  const application = e.application ?? 'decision';
  if (!['decision', 'evidence_only'].includes(application)) {
    throw new ScoutingProvenanceError(`applicationが不正: ${application}（decision / evidence_only）`);
  }
  return {
    ...e,
    application,
""")
replace_once('src/ratings/scouting_input.mjs',
"""  const gap = statValue == null ? null : Math.round((scouting.value - statValue) * 10) / 10;
  const useStat = opts.preferStatistical === true;
  return {
    value: useStat ? statValue : scouting.value,
    source: useStat ? 'statistical' : `scouting:${scouting.evaluator}`,
""",
"""  const gap = statValue == null ? null : Math.round((scouting.value - statValue) * 10) / 10;
  // evidence_only は値そのものをPrior候補・常識チェックとして残すが、最終能力へ全置換しない。
  const useStat = opts.preferStatistical === true || scouting.application === 'evidence_only';
  return {
    value: useStat ? statValue : scouting.value,
    source: useStat ? 'statistical' : `scouting:${scouting.evaluator}`,
""")
replace_once('src/ratings/scouting_input.mjs',
"""    scouting: {
      evaluator: scouting.evaluator, basis: scouting.basis,
      source: scouting.source ?? null, dated: scouting.dated ?? null,
      confidence: scouting._weight,
    },
""",
"""    scouting: {
      evaluator: scouting.evaluator, basis: scouting.basis,
      source: scouting.source ?? null, dated: scouting.dated ?? null,
      confidence: scouting._weight,
      application: scouting.application,
    },
""")
replace_once('src/ratings/scouting_input.mjs',
"""    note: gap == null ? null
      : Math.abs(gap) >= 15
""",
"""    note: scouting.application === 'evidence_only'
      ? `スカウティング${scouting.value}はevidence_only。統計値${statValue ?? '—'}を上書きせず、Prior候補・常識チェックとして保持`
      : gap == null ? null
      : Math.abs(gap) >= 15
""")

# speed_evidence: 直接計測を第1階層として最優先。evidence_only scoutingは判断に使わない。
replace_once('src/ratings/speed_evidence.mjs',
"""  // 現行カードの裁定を保つため、この修正では既存の優先順
  // 「スカウティング > 直接計測 > 統計」は変えない。
  // 直接計測とスカウティングの優先順位そのものは別監査で扱う。
  if (scouting) {
    finalRating = scouting.value;
    decidedBy = 'scouting';
    external = scouting;
  } else if (direct) {
    weight = directSpeedWeight(direct, cfg);
    finalRating = statFinal * (1 - weight) + direct.value * weight;
    decidedBy = 'direct_blend';
    external = direct;
  }
""",
"""  // 仕様04 §1.2の階層どおり、直接計測（第1階層）をスカウティング（第2階層）より優先する。
  // evidence_only のスカウティングは値決定に使わず、証拠束にだけ残す。
  if (direct) {
    weight = directSpeedWeight(direct, cfg);
    finalRating = statFinal * (1 - weight) + direct.value * weight;
    decidedBy = 'direct_blend';
    external = direct;
  } else if (scouting && scouting.application !== 'evidence_only') {
    finalRating = scouting.value;
    decidedBy = 'scouting';
    external = scouting;
  }
""")
replace_exact_count('src/ratings/speed_evidence.mjs',
"""      external_source: direct?.source ?? scouting?.source ?? null,
""",
"""      external_source: external?.source ?? null,
""", 2)
replace_once('src/ratings/speed_evidence.mjs',
"""      _note: decidedBy === 'statistical'
        ? '外部証拠なし。統計由来の複数年走力を使用'
""",
"""      _note: decidedBy === 'statistical'
        ? (scouting?.application === 'evidence_only'
          ? 'スカウティングはevidence_onlyとして保持し、数値決定は統計由来の複数年走力を使用'
          : '外部証拠なし。統計由来の複数年走力を使用')
""")

# ability_evidence: evidence_only priorはposterior候補にしないが欄には残す。
replace_once('src/ratings/ability_evidence.mjs',
"""    prior && { tier: prior.tier ?? 'scouting_document', value: prior.value, src: prior },
""",
"""    prior && prior.application !== 'evidence_only'
      && { tier: prior.tier ?? 'scouting_document', value: prior.value, src: prior },
""")
replace_once('src/ratings/ability_evidence.mjs',
"""    scouting_prior: prior,
""",
"""    scouting_prior: prior ? {
      ...prior,
      _role: prior.application === 'evidence_only'
        ? 'Prior候補・常識チェック。最終能力の直接決定には使わない'
        : '数値決定に利用可能なスカウティング証拠',
    } : null,
""")

# pipeline: ability_evidenceへapplicationを伝播。
replace_once('src/cards/pipeline.mjs',
"""      source: scoutRec.scouting.source, basis: scoutRec.scouting.basis, dated: scoutRec.scouting.dated,
""",
"""      source: scoutRec.scouting.source, basis: scoutRec.scouting.basis, dated: scoutRec.scouting.dated,
      application: scoutRec.scouting.application ?? scoutRec.scouting_application ?? 'decision',
""")

# armは直接計測があればscouting decisionより優先。evidence_onlyなら統計/直接のまま。
replace_once('src/cards/pipeline.mjs',
"""    // 優先順: スカウティング評価 > 直接計測 > 統計（仕様04 §1.2 の階層どおり）
    arm: (armRec?.scouting ? { ...armForSheetFinal, rating: armRec.value, _reconciled: armRec } : armForSheetFinal),
""",
"""    // 優先順: 直接計測（第1階層） > decisionスカウティング（第2階層） > 統計。
    // evidence_only は証拠束へ残すだけで能力値を上書きしない。
    arm: (armDirect
      ? armForSheetFinal
      : armRec?.source?.startsWith('scouting:')
        ? { ...armForSheetFinal, rating: armRec.value, _reconciled: armRec }
        : armForSheetFinal),
""")

# runRecにapplicationの明示フィールドも残す（監査しやすくする）。
replace_once('src/cards/pipeline.mjs',
"""    scouting: speedScout,
    scouting_value: speedScout.value,
""",
"""    scouting: speedScout,
    scouting_value: speedScout.value,
    scouting_application: speedScout.application,
""")
