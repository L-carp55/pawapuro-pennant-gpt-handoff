# 走力 v1 完了監査

日付: 2026-08-09  
状態: **COMPLETE_V1_ON_BRANCH**  
対象ブランチ: `agent/t90-speed-foundation`

## 1. Definition of Done

2026-08-09のスコープ制御ルールに従い、走力v1の完成条件を以下に固定した。

1. T90ベースの新走力経路をproductionカード生成へ接続する。
2. T90が未査定の選手は、旧走力を暫定fallbackと明示してカード生成を止めない。
3. 新T90基礎走力へ盗塁・走塁技術を混ぜない。
4. production resolverの回帰テストを通す。
5. 30m/50m完全表・加速profile本採用・NPB基準CDF精密化は完成条件から外し、Parking Lotへ送る。

## 2. 実装

### production resolver

`src/ratings/speed_production.mjs`

優先順位:

```text
T90 Tier A-D
  > 明示的なスカウティング値
  > T90 Tier E proxy
  > 旧走力の暫定fallback
  > null
```

旧走力を使う場合は `LEGACY_FALLBACK_PENDING_T90` とし、`provisional=true` / `legacy_fallback=true` を必ず残す。旧direct-scale値もT90へ読み替えず `legacy_direct_scale` として扱う。

### card adapter

`src/cards/t90_pipeline_adapter.mjs`

既存の巨大な `pipeline.mjs` を直接書き換えず、`appraiseCard()` の直後でT90を解決する薄いadapterにした。

接続先:

- `scripts/build_card.mjs`
- `scripts/build_cards_batch.mjs`
- `scripts/appraise_season.mjs`

カードには `speed_model` と `calc_log.speed_t90` を追加し、T90のstatus / evidence / reference / fallback理由を保存する。

production v1ではadapter側からoutcome proxyを追加しない。物理・文脈T90が作れない場合は、旧モデルを隠さずfallbackする。

## 3. 回帰テスト

`node scripts/test_speed_production.mjs`

**PASS**

確認項目:

- Tier A-D T90が既存値より優先される。
- scoutingはTier-E outcome proxyより優先される。
- T90未査定時に既存走力を維持するが、必ずlegacy/provisionalと表示する。
- 旧direct-scale値をT90と偽装しない。
- strict modeではfallbackを切ってnullにできる。

## 4. 代表選手QA

現時点では凍結NPB T90 reference / production NPB bridgeが未完成なので、実選手のproduction経路は主にfallback branchを通る。この状態で「接続しただけで既存カードを壊していない」ことを確認した。

| 選手 | 年 | 接続前走力 | 接続後走力 | 差 | status |
|---|---:|---:|---:|---:|---|
| 周東佑京 | 2024 | 86.7 | 86.7 | 0.0 | LEGACY_FALLBACK_PENDING_T90 |
| 山川穂高 | 2024 | 45.3 | 45.3 | 0.0 | LEGACY_FALLBACK_PENDING_T90 |
| 鈴木誠也 | 2018 | 68.0 | 68.0 | 0.0 | SCOUTING_FALLBACK_PENDING_T90 |

さらに:

- WBC検証野手15人の一括カード生成: **15/15成功**
- `appraise_season.mjs 2024 300`: **完走**
- 主要変更ファイル: `node --check` **PASS**

T90 primary branchそのものは `test_speed_production.mjs` のsynthetic caseで検査済み。凍結referenceが入った後は同じresolverが自動的にT90を優先する。

## 5. 二重計上・分離

新T90 production経路の基礎走力は、T90 evidenceから作る。adapterは追加進塁・UBR・盗塁数・三塁打などを新T90 evidenceへ追加しない。

旧 `running.mjs` はfallbackとして残っているため、fallbackカードは完全分離済みとは主張しない。これを隠さず `legacy_fallback=true` で機械判定できるようにした。

つまり:

```text
T90_PRIMARY = 新設計の純粋な基礎走力
LEGACY_FALLBACK_PENDING_T90 = 互換性のため残した暫定値
```

を構造上区別する。

## 6. Parking Lot

以下はv1完成を止めない。

### IMPROVEMENT

- NPB+ top speed / acceleration → T90 bridgeのproduction較正
- NPB T90 reference CDFの凍結
- T90 uncertainty posteriorの全対象への付与
- prime_compositeカードでの身体能力の年度合成方法

### RESEARCH

- 2026大学代表候補31人の30m完全表
- 30m/50m acceleration profileのproduction反映
- protocol差を跨ぐ30m/50m → Statcast-equivalent T90 bridge

これらを理由に走力v1を再び未完了へ戻さない。BLOCKERが見つかった場合のみ再オープンする。

## 7. 判定

**走力 v1 は完成扱い。**

科学的に全ての選手がT90_PRIMARYへ移行したという意味ではない。production経路・優先順位・fallbackの可視化・回帰テストまで完成し、未較正部分を安全に将来改善できる状態になった、という完成判定である。

次の査定能力へ移る。
