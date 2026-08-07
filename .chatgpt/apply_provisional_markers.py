from pathlib import Path
import json

# model gates
p=Path('configs/model_gates.json')
j=json.loads(p.read_text())
if 'speed_ability' not in j:
    # keep insertion near the other ability gates for human readability
    out={}
    for k,v in j.items():
        if k=='fielding_ability':
            out['speed_ability']={
                'enabled': True,
                'status': 'PROVISIONAL_REDESIGN',
                'reason': '2026 NPB+直接走力へのproxy再較正で三塁打除外は支持されたが、2024 sanity checkが周東>源田>近本となり、オーナー基準の周東>近本>源田を満たさないため未確定。現値は比較用の暫定値としてのみ表示する。',
                'evidence': {
                    'npb_plus_direct_matched': 98,
                    'proxy_cv_best_rmse_kmh': 0.868,
                    'temporal_pool_holdout_best_rmse_kmh': 0.904,
                    'temporal_pool_holdout_best_method': 'pa_weighted_3y',
                    'sanity_order_current': '周東 > 源田 > 近本',
                    'sanity_order_required': '周東 > 近本 > 源田',
                    'measured_at': '2026-08-07'
                },
                'reopen_conditions': [
                    '盗塁行動に依存しない追加の速度proxyを探索する',
                    '2026 NPB+直接速度のplayer-holdoutで現行proxy以上を確認する',
                    '周東>近本>源田を教師ラベルにせずsanity checkとして満たす',
                    '自作エンジン内の速度目盛りと結びつけて100段階を確定する'
                ]
            }
        out[k]=v
    j=out
p.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')

# ability sheet
p=Path('src/cards/ability_sheet.mjs')
s=p.read_text()
def once(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)

once(
"    arm = null, speedOverride = null, powerOverride = null, specialAbilities = {},\n    unappraisedReasons = {},\n",
"    arm = null, speedOverride = null, powerOverride = null, specialAbilities = {},\n    unappraisedReasons = {}, provisionalStatus = {},\n",
'ability args')

once(
"  const primary = fld.find(f => f.isPrimary) ?? null;\n",
"  const primary = fld.find(f => f.isPrimary) ?? null;\n  const provisionalMeta = name => {\n    const g = provisionalStatus?.[name];\n    return g?.status?.startsWith('PROVISIONAL')\n      ? { provisional: true, _status: g.status, _note_provisional: g.reason }\n      : {};\n  };\n",
'provisional helper')

old="""    走力: speedOverride
      ? graded(speedOverride.value, cfg, speedOverride._direct
          ? { from_direct_measurement: true, statistical_value: speedOverride._statistical_rating,
              source: speedOverride._direct.source, measured: speedOverride._direct.measured }
          : { from_scouting: true, statistical_value: speedOverride.statistical_value, gap: speedOverride.gap })
      : graded(run?.speed, cfg, {}, '走力'),"""
new="""    走力: speedOverride
      ? graded(speedOverride.value, cfg, { ...(speedOverride._direct
          ? { from_direct_measurement: true, statistical_value: speedOverride._statistical_rating,
              source: speedOverride._direct.source, measured: speedOverride._direct.measured }
          : { from_scouting: true, statistical_value: speedOverride.statistical_value, gap: speedOverride.gap }),
          ...provisionalMeta('走力') })
      : graded(run?.speed, cfg, provisionalMeta('走力'), '走力'),"""
once(old,new,'speed provisional')

once(
"    捕球: graded(primary?.catching?.rating, cfg, primary ? { position: primary.pos } : {}),\n",
"    捕球: graded(primary?.catching?.rating, cfg, { ...(primary ? { position: primary.pos } : {}), ...provisionalMeta('捕球') }),\n",
'catching provisional')
p.write_text(s)

# pipeline pass metadata
p=Path('src/cards/pipeline.mjs')
s=p.read_text()
def oncep(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)
oncep(
"    unappraisedReasons: ctx.modelGates?.baserunning_ability?.enabled === false\n      ? { 走塁: ctx.modelGates.baserunning_ability.reason }\n      : {},\n",
"    unappraisedReasons: ctx.modelGates?.baserunning_ability?.enabled === false\n      ? { 走塁: ctx.modelGates.baserunning_ability.reason }\n      : {},\n    provisionalStatus: {\n      走力: ctx.modelGates?.speed_ability ?? null,\n      捕球: ctx.modelGates?.catching_ability ?? null,\n    },\n",
'pipeline provisional pass')
p.write_text(s)

# CLI visible marker
p=Path('scripts/build_card.mjs')
s=p.read_text()
def oncec(old,new,label):
    global s
    n=s.count(old)
    if n!=1: raise SystemExit(f'{label}: expected 1 match, got {n}')
    s=s.replace(old,new,1)
oncec(
"const show = (v) => v == null ? '—' : (v.scale === '1-4' ? String(v.value) : `${v.rank}${v.value}${v.is_estimated ? '推' : ''}`);",
"const show = (v) => v == null ? '—' : (v.scale === '1-4' ? String(v.value) : `${v.rank}${v.value}${v.is_estimated ? '推' : ''}${v.provisional ? '暫' : ''}`);",
'cli marker')
p.write_text(s)
