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
"import { advanceOf } from '../ratings/baserunning_advance.mjs';\n",
"import { advanceOf } from '../ratings/baserunning_advance.mjs';\n"
"import { recordEvidenceEndsBy, aggregateEvidenceAvailable } from '../ratings/evidence_time.mjs';\n",
)

# 二軍Prior: 対象年より後を候補にしない。
replace_once(
"        if (f.season < season - 3 || f.season > season + 3) continue;\n",
"        if (f.season < season - 3 || f.season > season) continue;\n",
)

# 一軍Prior: target+3を除く。
replace_once(
"    .all(p.player_id, targetSeason - 3, targetSeason + 3)\n",
"    .all(p.player_id, targetSeason - 3, targetSeason)\n",
)

# targetSeason/pが解決した直後にas-of helperを定義。
old = """  const p = all.find(x => x.season === targetSeason) ?? all[all.length - 1];
  const L = lgOf(targetSeason);
"""
new = """  const p = all.find(x => x.season === targetSeason) ?? all[all.length - 1];

  // ---- 本人証拠のas-of cutoff（2026-08-07）----
  // 後年のリーグ分布を較正基準として使うことは許すが、対象選手本人の未来結果は過去年カードへ入れない。
  const aggregateEvidenceAllowed = key => {
    const maxSeason = Number(ctx.modelGates?.asof_aggregate_evidence?.[key]?.max_evidence_season);
    return aggregateEvidenceAvailable(maxSeason, targetSeason);
  };
  const throwAccuracyEvidence = pos => {
    const rec = ctx.throwAccuracyTe?.get(`${normName(p.name)}|${pos}`) ?? null;
    return recordEvidenceEndsBy(rec, targetSeason) ? rec : null;
  };

  const L = lgOf(targetSeason);
"""
replace_once(old, new)

# FE差し替えに使うTE送球判定もas-of。
replace_once(
"      const hasThrowAbility = ctx.throwAccuracyTe?.get(`${normName(p.name)}|${pj}`);\n",
"      const hasThrowAbility = throwAccuracyEvidence(pj);\n",
)

# 捕手守備は2020-2026集約値なので過去年では使わない。
replace_once(
"  const catcherFld = ctx.catcherFielding?.get(normName(p.name));\n",
"  const catcherFld = aggregateEvidenceAllowed('catcher_fielding')\n"
"    ? ctx.catcherFielding?.get(normName(p.name)) : null;\n",
)

# 送球得能: TEはrecordのseasonsでas-of、集約PBPはmax_evidence_seasonでas-of。
replace_once(
"        const byTe = ctx.throwAccuracyTe?.get(`${normName(p.name)}|${p.position}`);\n",
"        const byTe = throwAccuracyEvidence(p.position);\n",
)
replace_once(
"        const t = ctx.catcherThrow?.get(normName(p.name));\n",
"        const t = aggregateEvidenceAllowed('catcher_throw_accuracy')\n"
"          ? ctx.catcherThrow?.get(normName(p.name)) : null;\n",
)
replace_once(
"        const f = ctx.infieldThrow?.get(normName(p.name));\n",
"        const f = aggregateEvidenceAllowed('infield_throw_accuracy')\n"
"          ? ctx.infieldThrow?.get(normName(p.name)) : null;\n",
)

p.write_text(s)
