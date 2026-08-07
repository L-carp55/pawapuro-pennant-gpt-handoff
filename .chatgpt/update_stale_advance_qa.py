from pathlib import Path

p = Path('scripts/test_qa_remaining.mjs')
s = p.read_text()
start_marker = "  // ── §走塁材料 自作の走塁指標を走力へ（2026-08-05 オーナー承認）──────────\n"
end_marker = "  // ── §内野送球 内野手の送球（精度）の得能（2026-08-05・オーナー指示の要素切り分け）──\n"
if s.count(start_marker) != 1 or s.count(end_marker) != 1:
    raise SystemExit(f'markers start={s.count(start_marker)} end={s.count(end_marker)}')
a = s.index(start_marker)
b = s.index(end_marker)
replacement = """  // ── §走塁材料 追加進塁コンポーネントは再構築まで休止（2026-08-07監査）──────────
  // 旧baserunning_advancesは打席の最終行を開始走者状態として構築しており、
  // 明示状態を読めた3,062件のうち262件(8.56%)でsuccessラベルが矛盾した。
  // 数式の受け皿自体は再構築後に再利用できるよう残すが、本番pipelineはmodel_gatesで入力を遮断する。
  {
    const { speedComponents } = await import('../src/ratings/running.mjs');
    const { readFileSync: rfAdvance } = await import('node:fs');
    const modelGates = JSON.parse(rfAdvance('configs/model_gates.json', 'utf8'));
    const line = { AB: 500, SO: 100, B2: 25, B3: 3, HR: 10, GDP: 8, PA: 570 };
    const base = { gbPct: 45, infieldHits: 15, bats: 'R', season: 2024 };
    const noAdv = speedComponents(line, base, 2.0, runNorm);
    const hypothetical = speedComponents(line, { ...base, advance: 0.15, advanceChances: 40 }, 2.0, runNorm);

    t('§走塁材料-a 数式の受け皿は再構築後の再利用用に残っている',
      hypothetical.z.advance != null && hypothetical.score !== noAdv.score,
      `noAdv=${noAdv.score?.toFixed(3)} / hypothetical=${hypothetical.score?.toFixed(3)}`);
    t('§走塁材料-b ただし既存追加進塁ソースは本番利用停止',
      modelGates.baserunning_advance_source?.enabled === false
        && modelGates.baserunning_advance_source?.status === 'STALE_REBUILD_REQUIRED',
      modelGates.baserunning_advance_source?.status);
    t('§走塁材料-c ラベル矛盾の監査結果が設定に固定されている',
      modelGates.baserunning_advance_source?.evidence?.outcome_label_contradiction_rate > 0.08,
      `${((modelGates.baserunning_advance_source?.evidence?.outcome_label_contradiction_rate ?? 0) * 100).toFixed(2)}%`);
    t('§走塁材料-d 走力は追加進塁なしでも算出できる（欠損を0と見なさない）',
      noAdv.score != null && noAdv.z.advance == null, '既存の他材料だけで算出');

    const pipeSrc = rfAdvance('src/cards/pipeline.mjs', 'utf8');
    const durableSrc = rfAdvance('src/cards/durable_estimate.mjs', 'utf8');
    t('§走塁材料-e 単年経路でゲート無効時はadvanceOfを呼ばない',
      pipeSrc.includes("advanceGate?.enabled === false") && pipeSrc.includes("? null : advanceOf"),
      'pipelineで遮断');
    t('§走塁材料-f 複数年経路でも同じゲートを使う',
      durableSrc.includes('advanceEnabled ? advanceOf'), 'durable_estimateで遮断');
    t('§走塁材料-g 再開条件が設定に明示されている',
      (modelGates.baserunning_advance_source?.reopen_conditions?.length ?? 0) >= 4,
      `${modelGates.baserunning_advance_source?.reopen_conditions?.length ?? 0}条件`);
  }

"""
s = s[:a] + replacement + s[b:]
p.write_text(s)
