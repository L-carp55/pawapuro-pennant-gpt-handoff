import json
from pathlib import Path
p=Path('configs/model_gates.json')
d=json.loads(p.read_text(encoding='utf-8'))
s=d['baserunning_advance_source']
s['enabled']=False
s['status']='REBUILT_VALIDATED_RESEARCH_ONLY'
s['reason']='旧baserunning_advancesは失効。Nippon Baseball Data Repositoryのraw PBPから打席内盗塁・暴投等をreconcileして2020-2026を再構築し、説明文明示ケースで開始塁・success矛盾0%まで検証済み。ただし追加進塁残差から身体走力を除いた単年split-half再現性がほぼ0のため、本番走力・走塁得能の材料にはまだ使わない。'
s['evidence']={
  'old_source_valid': False,
  'rebuilt_source_valid_for_research': True,
  'rebuilt_events_2020_2025': 20787,
  'rebuilt_events_2026_partial': 2231,
  'yearly_label_audit_2020_2025_bad_start_rate': 0.0,
  'yearly_label_audit_2020_2025_success_contradiction_rate': 0.0,
  'direct_speed_matched_players_2026': 82,
  'corr_direct_top_speed_vs_context_residual_2026': 0.259,
  'split_half_common_players_2026': 46,
  'split_half_raw_residual_pearson': 0.122,
  'split_half_speed_adjusted_pearson': 0.039,
  'split_half_raw_residual_spearman': 0.096,
  'split_half_speed_adjusted_spearman': 0.029,
  'measured_at': '2026-08-07'
}
s['reopen_conditions']=[
  '再構築済みイベントはcontext難度モデルの研究入力としてのみ利用する',
  '最高走行速度・加速など身体走力を先に説明変数として分離する',
  '追加進塁単独ではなくタッチアップ・走塁死・UBR等の独立情報を統合し、技術latentを再設計する',
  'player/game holdoutまたはsplit-halfで身体補正後skillの再現性を確認する',
  '十分な再現性が出るまでは100段階の走塁得能へ変換しない'
]
b=d['baserunning_ability']
b['enabled']=False
b['status']='PAUSED_LOW_SKILL_RELIABILITY_AFTER_SPEED_SEPARATION'
b['reason']='再構築PBP自体は検証を通過したが、2026 NPB+最高走行速度を使って身体成分を除くと追加進塁残差の試合split-half再現性はPearson 0.039 / Spearman 0.029。単年追加進塁から安定した走塁技術を100段階化する根拠が無いため停止継続。'
b['evidence']={
  'advance_source_rebuilt_valid_for_research': True,
  'events_2020_2025': 20787,
  'events_2026_partial': 2231,
  'direct_speed_context_residual_corr': 0.259,
  'split_half_raw_pearson': 0.122,
  'split_half_speed_adjusted_pearson': 0.039,
  'split_half_raw_spearman': 0.096,
  'split_half_speed_adjusted_spearman': 0.029,
  'measured_at': '2026-08-07'
}
b['reopen_conditions']=[
  '追加進塁以外の走塁イベント（タッチアップ・走塁死・ベース回り等）をイベント単位で追加する',
  '身体走力を直接観測または独立latentとして先に分離する',
  '複数年階層モデルで技術成分と年ノイズを分ける',
  '独立holdoutで技術成分の再現性が十分か確認する'
]
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('updated baserunning gates')
