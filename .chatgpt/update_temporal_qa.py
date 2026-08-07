from pathlib import Path

p = Path('scripts/test_qa_remaining.mjs')
s = p.read_text()

def replace_once(old, new):
    global s
    n = s.count(old)
    if n != 1:
        raise SystemExit(f'expected 1 match, got {n}: {old[:100]!r}')
    s = s.replace(old, new, 1)

replace_once(
"""  const built = buildDirectMeasurements(
    { sprint_speed_avg: 28.0, sprint_years: 3, arm_mph_avg: 95, arm_years: 2, detail: null }, dm, 2021);
  t('§直接-i 無効な能力には直接計測を作らない', built.肩力 === null, '肩力=null（enabled:false）');
  t('§直接-j 有効な能力には作る', built.走力 != null && built.走力.tier != null, `走力=${built.走力?.value}`);
""",
"""  const built = buildDirectMeasurements({
    sprint_speed_avg: 28.0, sprint_years: 2, arm_mph_avg: 95, arm_years: 2,
    detail: JSON.stringify({ sprint_speed: [
      { year: 2020, sprint_speed: 27.8 }, { year: 2021, sprint_speed: 28.2 },
    ] }),
  }, dm, 2021);
  t('§直接-i 無効な能力には直接計測を作らない', built.肩力 === null, '肩力=null（enabled:false）');
  t('§直接-j 有効かつ査定年以前の計測には作る',
    built.走力 != null && built.走力.tier != null && built.走力.measured_years?.at(-1) === 2021,
    `走力=${built.走力?.value} / 年=${built.走力?.measured_years?.join(',')}`);
"""
)

old = """    const row = { hard_hit_pct: 49, barrel_pct: 17, swing_speed_avg: 115.1, top_speed_kmh: 29.4, launch_angle_avg: 15 };
    const d = buildDirectMeasurements(row, merged, 2024);

    t('§NPB実測-a ハードヒット率からパワーの実測値が出る（アンカー無しの前提でのモデル動作確認）',
      d.パワー?.value > 0, d.パワー ? `${d.パワー.value}（${d.パワー.source}）` : 'null');
    t('§NPB実測-b 瞬間最高速度から走力の実測値が出る',
      d.走力?.value > 0, d.走力 ? `${d.走力.value}（${d.走力.source}）` : 'null');
    t('§NPB実測-c 同じ能力に候補が複数あっても1つだけ使う（重ねない）',
      d.パワー?.source?.includes('hard_hit_pct'), `${d.パワー?.source}（testの一致が最も高いもの）`);

    // ★2026-08-06 オーナー指摘で追加。NPB+のモデルはパワプロの能力値を目標に当てはめた式
    //   （scripts/calibrate_npb_plus_direct.mjs が `SELECT power ... FROM pawapuro_full`）。
    //   仕様アンカーを持つ能力へ混ぜると目盛りが2つになるので、パワーには渡さない。
    const withAnchor = buildDirectMeasurements(row, { ...merged, scale_calibration: cfg.scale_calibration }, 2024);
    t('§NPB実測-g 仕様アンカーを持つ能力（パワー）にはパワプロ目盛りの実測を入れない',
      withAnchor.パワー == null, `パワー=${withAnchor.パワー?.value ?? 'null'}`);
    t('§NPB実測-h アンカーの無い走力には引き続き入る（実測を捨てたわけではない）',
      withAnchor.走力?.value > 0, `走力=${withAnchor.走力?.value}`);
    t('§NPB実測-d ホールドアウトで保たれない材料は使わない（弾道＝打球角度 test 0.129）',
      !JSON.stringify(d).includes('launch_angle'), '弾道は入らない');
    t('§NPB実測-e 実測が無ければ何も返さない（推定で埋めない）',
      (() => { const e = buildDirectMeasurements({}, merged, 2024); return !e.パワー && !e.走力; })(), 'null');
"""
new = """    const row = { hard_hit_pct: 49, barrel_pct: 17, swing_speed_avg: 115.1, top_speed_kmh: 29.4, launch_angle_avg: 15 };
    const dPast = buildDirectMeasurements(row, merged, 2024);
    const d = buildDirectMeasurements(row, merged, 2026);

    t('§NPB実測-a 2026年NPB+実測を2024年カードへ未来情報として入れない',
      dPast.パワー == null && dPast.走力 == null,
      `2024: パワー=${dPast.パワー?.value ?? 'null'} / 走力=${dPast.走力?.value ?? 'null'}`);
    t('§NPB実測-b 計測年2026のカードでは瞬間最高速度から走力が出る',
      d.走力?.value > 0, d.走力 ? `${d.走力.value}（${d.走力.source}）` : 'null');
    t('§NPB実測-c 計測年なら同じ能力に候補が複数あっても1つだけ使う（重ねない）',
      d.パワー?.source?.includes('hard_hit_pct'), `${d.パワー?.source}（testの一致が最も高いもの）`);

    // ★2026-08-06 オーナー指摘で追加。NPB+のモデルはパワプロの能力値を目標に当てはめた式
    //   （scripts/calibrate_npb_plus_direct.mjs が `SELECT power ... FROM pawapuro_full`）。
    //   仕様アンカーを持つ能力へ混ぜると目盛りが2つになるので、パワーには渡さない。
    const withAnchor = buildDirectMeasurements(row, { ...merged, scale_calibration: cfg.scale_calibration }, 2026);
    t('§NPB実測-g 計測年でも仕様アンカーを持つ能力（パワー）にはパワプロ目盛りの実測を入れない',
      withAnchor.パワー == null, `パワー=${withAnchor.パワー?.value ?? 'null'}`);
    t('§NPB実測-h アンカーの無い走力は計測年には使える（実測自体を捨てたわけではない）',
      withAnchor.走力?.value > 0, `走力=${withAnchor.走力?.value}`);
    t('§NPB実測-d ホールドアウトで保たれない材料は使わない（弾道＝打球角度 test 0.129）',
      !JSON.stringify(d).includes('launch_angle'), '弾道は入らない');
    t('§NPB実測-e 実測が無ければ何も返さない（推定で埋めない）',
      (() => { const e = buildDirectMeasurements({}, merged, 2026); return !e.パワー && !e.走力; })(), 'null');
"""
replace_once(old, new)

replace_once(
"""    // ★2026-08-06に対象をパワー→走力へ変更。パワーは仕様アンカーを持つのでこの経路自体を
    //   止めた（§NPB実測-g）。混合の仕組み（丸ごと上書きしない）は走力で引き続き検証する。
    t('§NPB実測-f 統計値を残したまま実測と混ぜる（丸ごと上書きしない）',
      sp?.statistical_value != null && sp.value !== sp.statistical_value,
      sp ? `統計${sp.statistical_value} → 最終${sp.value}` : 'null');
""",
"""    // 2024カードには2026年NPB+を入れない。外部実測の混合規律は計測年/過去年証拠で別テストする。
    t('§NPB実測-f 2024能力欄まで2026年NPB+が漏れない',
      sp != null && sp.from_direct_measurement !== true,
      sp ? `走力=${sp.value} / direct=${sp.from_direct_measurement ?? false}` : 'null');
"""
)

p.write_text(s)
