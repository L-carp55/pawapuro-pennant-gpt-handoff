from pathlib import Path

p = Path('scripts/test_qa_remaining.mjs')
s = p.read_text()

def replace_once(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'expected 1 match, got {n}: {old[:120]!r}')
    s = s.replace(old, new, 1)

# 捕手肩の単体テスト: 2026計測は2026カードで使い、2024では使わない。
old = """  const { buildDirectMeasurements } = await import('../src/ratings/direct_measurement.mjs');
  const dm = cfg.direct_measurement;

  const fast = buildDirectMeasurements({ throw_speed_kmh: 130.0, is_catcher: true }, dm, 2024);
  const slow = buildDirectMeasurements({ throw_speed_kmh: 107.0, is_catcher: true }, dm, 2024);
  t('§捕手肩-a 捕手の送球速度から肩力が出る',
    fast.肩力?.value != null, `130km/h → ${fast.肩力?.value}`);
  t('§捕手肩-b 速いほど肩力が高い',
    fast.肩力.value > slow.肩力.value, `130km/h=${fast.肩力.value} > 107km/h=${slow.肩力.value}`);

  // ★捕手以外へは適用しない（内野・外野では効いていないため）
  const notCatcher = buildDirectMeasurements({ throw_speed_kmh: 145.0, is_catcher: false }, dm, 2024);
  t('§捕手肩-c 捕手以外には適用しない（層別漏れの再発検知）',
    notCatcher.肩力 == null, '外野手145km/hでも null');

  t('§捕手肩-d 実測が無ければ肩力はnull（0で埋めない）',
    buildDirectMeasurements({ is_catcher: true }, dm, 2024).肩力 == null, 'null');
  t('§捕手肩-e どの材料から来たかが残る',
    /NPB\\+/.test(fast.肩力.source ?? ''), fast.肩力.source);
  t('§捕手肩-f 実測2026×査定2024の年ずれが階層に反映される',
    fast.肩力.tier === 'direct_near_year', fast.肩力.tier);
  t('§捕手肩-g 暫定であることが値に添えられている',
    /暫定/.test(fast.肩力.note ?? ''), '注記あり');
"""
new = """  const { buildDirectMeasurements } = await import('../src/ratings/direct_measurement.mjs');
  const dm = { ...cfg.direct_measurement, npb_plus_direct: cfg.npb_plus_direct };

  const futureBlocked = buildDirectMeasurements({ throw_speed_kmh: 130.0, is_catcher: true }, dm, 2024);
  const fast = buildDirectMeasurements({ throw_speed_kmh: 130.0, is_catcher: true }, dm, 2026);
  const slow = buildDirectMeasurements({ throw_speed_kmh: 107.0, is_catcher: true }, dm, 2026);
  t('§捕手肩-a NPB+2026送球速度は2024カードへ未来情報として入れない',
    futureBlocked.肩力 == null, `2024肩力=${futureBlocked.肩力?.value ?? 'null'}`);
  t('§捕手肩-b 計測年2026なら捕手の送球速度から肩力が出て、速いほど高い',
    fast.肩力?.value != null && fast.肩力.value > slow.肩力.value,
    `130km/h=${fast.肩力?.value} > 107km/h=${slow.肩力?.value}`);

  // ★捕手以外へは適用しない（内野・外野では効いていないため）
  const notCatcher = buildDirectMeasurements({ throw_speed_kmh: 145.0, is_catcher: false }, dm, 2026);
  t('§捕手肩-c 捕手以外には適用しない（層別漏れの再発検知）',
    notCatcher.肩力 == null, '外野手145km/hでも null');

  t('§捕手肩-d 実測が無ければ肩力はnull（0で埋めない）',
    buildDirectMeasurements({ is_catcher: true }, dm, 2026).肩力 == null, 'null');
  t('§捕手肩-e どの材料から来たかが残る',
    /NPB\\+/.test(fast.肩力.source ?? ''), fast.肩力.source);
  t('§捕手肩-f 計測年2026は同年直接計測として扱う',
    fast.肩力.tier === 'direct_same_year', fast.肩力.tier);
  t('§捕手肩-g 暫定であることが値に添えられている',
    /暫定/.test(fast.肩力.note ?? ''), '注記あり');
"""
replace_once(old, new)

old = """    const sheetArm = res.card?.abilities?.基礎能力?.肩力?.value;
    const evArm = res.card?.ability_evidence?.肩力?.posterior_rating;
    t('§捕手肩-h 実測が能力欄まで届く（証拠だけ出て能力が動かない状態の再発検知）',
      sheetArm != null && evArm != null && Math.abs(sheetArm - evArm) < 0.5,
      `能力欄=${sheetArm} / 証拠=${evArm}`);
"""
new = """    const sheetArm = res.card?.abilities?.基礎能力?.肩力?.value;
    const directArm = res.card?.ability_evidence?.肩力?.direct_measurement;
    t('§捕手肩-h 2024実カードにもNPB+2026の肩力直接計測が漏れない',
      sheetArm != null && directArm == null,
      `能力欄=${sheetArm} / direct=${directArm?.value ?? 'null'}`);
"""
replace_once(old, new)

# 内野送球の集約2020-2026は2024カードへ入れない。
old = """      t('§内野送球-d 内野手の送球が能力欄まで届く（証拠だけ出て能力が動かない状態の再発検知）',
        th?.ability === '送球×' && th.wild_throws > 0,
        th ? `${th.ability} ${th.wild_throws}件/${th.events}打球` : 'null');
"""
new = """      t('§内野送球-d 2020-2026集約の本人送球を2024カードへ未来情報として入れない',
        th == null,
        th ? `${th.ability} ${th.wild_throws}件/${th.events}打球` : 'null（as-of遮断）');
"""
replace_once(old, new)

# TE集約も本人レコードの最終年がtargetを超えるならFE差し替えへ使わない。
old = """    t('§案2-e 送球得能を持つ菊池涼介はFE材料',
      logWith?.catching?.material === 'fe_only', `material=${logWith?.catching?.material}`);
"""
new = """    t('§案2-e 2024終了後まで含むTE集約を菊池2024のFE差し替えへ使わない',
      logWith?.catching?.material !== 'fe_only', `material=${logWith?.catching?.material}`);
"""
replace_once(old, new)

p.write_text(s)
