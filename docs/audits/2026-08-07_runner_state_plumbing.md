# Runner identity / physical-skill plumbing

日付: 2026-08-07
状態: **runner identity・event resolver・runtime config接続済み。player-specific event係数は未較正のため本番無効。**

## 問題

旧 `src/engine/baserunning.mjs` は塁上状態を `[true/false, true/false, true/false]` で保持していた。
そのため打者が出塁した瞬間に「誰が走者か」を失い、選手別の走力・盗塁・走塁skillをエンジンへ接続できなかった。

## 1. runner identity

- `emptyBases()` のlegacy表現は維持。
- `advance(..., { batter })` を追加し、新engine経路では出塁者objectをそのまま塁上へ保持。
- 単打・二塁打・三塁打・四死球・失策・犠打・通常進塁でrunner identityを失わない。
- 盗塁成功時も同じrunner objectを次塁へ移す。
- legacy呼び出し（batter contextなし）は従来どおりboolean runnerを使える。

## 2. physical / skill schema

`src/engine/runner_context.mjs`:

```js
runner.running = {
  physical: {
    topSpeedZ,
    accelerationZ,
  },
  skills: {
    stealingZ,
    baserunningZ,
    infieldHitZ,
    gdpZ,
  },
};
```

身体軸と技術軸を別入力にする。
`runner_context` は `configs/baseball_running_response.json` が渡された場合だけ、top speed + accelerationから5→90ft physical performanceを計算する。

加速欠損は0=平均と仮定せず、complete performanceはnull。

## 3. event response API

`src/engine/running_event_response.mjs` と `configs/running_event_responses.json` を追加。

現在別eventとして用意したもの:

```text
steal_attempt_2nd
steal_attempt_3rd
steal_success
single_1st_to_3rd
single_2nd_to_home
double_1st_to_home
```

各eventは:

```text
global league probability
+ physical running performance
+ event-specific skill
```

という構造を受けられる。
実装形式は、将来較正された係数をglobal base probabilityのlogitへ差分として加える `delta_logit_from_global_base`。

ただしproduction registryは全event `calibrated=false`。
**本番係数は1つも入れていない。**

未較正・ゲートOFF・physical欠損・skill欠損のどれでも、必ずglobal probabilityへfallbackする。

GDPは現段階でplayer-specific化しない。
理由は、GDPには打席から一塁への0→5ft離脱が重要で、現在較正した5→90ft physical responseだけでは不足するため。

## 4. safety gate

`configs/engine.json`:

```text
player_running.enabled = false
player_running.status = PLUMBING_READY_EVENT_RESPONSES_UNCALIBRATED
```

塁上にrunner profileが存在しても、このゲートが閉じている間は盗塁・追加進塁等の確率を変えない。

## 5. runtime config loader

`src/engine/config.mjs` を追加。

主要シミュ入口:

```text
scripts/run_pennant.mjs
scripts/run_identity_test.mjs
scripts/run_season_test.mjs
```

は `loadEngineConfig(ROOT)` を使う。

loaderは:

- `configs/baseball_running_response.json`
- `configs/running_event_responses.json`

をruntime objectとしてhydrateする。

さらに `player_running.enabled=true` なのにphysical/event responseが未較正なら、**シミュ開始前にthrowして停止**する。
「ゲートを開けたのにconfigを読み忘れて黙ってglobal確率のまま走る」状態を禁止する。

## 6. 検証

### runner identity導入

GitHub Actions `31180533917` SUCCESS。

```text
engine runner state       18 checks passed
running response           14 checks passed
engine identity            完走
2024 season engine         完走
cards                      13 PASS
qa_remaining              173 PASS
phase1 safety               5 PASS
```

### event resolver

GitHub Actions `31181050803` SUCCESS。

```text
runner state               PASS
physical response          PASS
running event response     17 checks passed
engine identity            PASS
2024 season engine         PASS
cards                      13 PASS
qa_remaining              173 PASS
phase1 safety               5 PASS
```

テスト専用synthetic係数でのみ:

- 同じphysicalでもbaserunning skill差が別に効く
- physical成分はskill差で変わらない
- acceleration欠損を0扱いしない
- skill欠損を0扱いしない
- production gate OFFでは従来確率のまま

を確認した。synthetic係数はproduction configへ保存していない。

### runtime loader

GitHub Actions `31181273840` SUCCESS。

```text
engine config loader        9 checks passed
engine runner state        18 checks passed
running event response     17 checks passed
engine identity             完走
2024 season engine          完走
```

loader接続後も同一seedの出力は変わっていない。

2024 engine identity:

```text
得点/試合(1チーム) 3.2471 vs 実測3.2861 = -1.2%
```

2024 season test:

```text
得点/試合(1チーム) 3.2395 vs 実測3.2861 = -1.4%
```

## 7. 現在のデータ制約

修正版 `scripts/build_baserunning_advances.mjs` は存在するが、handoff repositoryには `data/raw/npb_pbp` が含まれていない。
現在DBに残る旧 `baserunning_advances` は、打席開始状態を最終投球行から取っていた失効版なので較正へ使わない。

したがって現時点でevent response係数を推定してはいけない。

## 次

1. Nippon Baseball Data Repository等の元PBPを再取得できるか確認する。
2. 修正版builderで `baserunning_advances` を再生成する。
3. 打球方向/深さ・アウト数・外野守備文脈を追加する。
4. physical performanceとbaserunning skillを別係数でeventごとにplayer-holdout較正する。
5. 盗塁は投手/捕手文脈を別途接続する。
6. 改善しないeventはglobal probabilityのまま維持する。
7. 最後に143試合リーグ分布を再較正する。
