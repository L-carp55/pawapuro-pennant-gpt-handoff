# Runner identity / physical-skill plumbing

日付: 2026-08-07
状態: **構造接続済み。player-specific event responseは未較正のため無効。**

## 問題

旧 `src/engine/baserunning.mjs` は塁上状態を `[true/false, true/false, true/false]` で保持していた。
そのため打者が出塁した瞬間に「誰が走者か」を失い、選手別の走力・盗塁・走塁skillをエンジンへ接続できなかった。

## 修正

- `emptyBases()` のlegacy表現は維持。
- `advance(..., { batter })` を追加し、新engine経路では出塁者objectをそのまま塁上へ保持。
- 単打・二塁打・三塁打・四死球・失策・犠打・通常進塁でrunner identityを失わない。
- 盗塁成功時も同じrunner objectを次塁へ移す。
- legacy呼び出し（batter contextなし）は従来どおりboolean runnerを使える。

## physical / skill schema

`src/engine/runner_context.mjs` を追加。

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

## safety gate

`configs/engine.json`:

```text
player_running.enabled = false
player_running.status = PLUMBING_READY_EVENT_RESPONSES_UNCALIBRATED
```

塁上にrunner profileが存在しても、このゲートが閉じている間は盗塁・追加進塁・併殺等の確率を変えない。

次に必要なのはイベント別responseの実データ較正であり、仮係数は置かない。

## 検証

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

2024 engine identity:

```text
得点/試合(1チーム) 3.2471 vs 実測3.2861 = -1.2%
```

2024 season test:

```text
得点/試合(1チーム) 3.2395 vs 実測3.2861 = -1.4%
```

今回のplumbingだけで既存の確率モデルを変えていないことを確認した。

## 次

1. event decisionへrunner contextを渡す。
2. single 1→3、single 2→home、double 1→home、盗塁企図、盗塁成功、GDP回避を別responseとして扱う。
3. 各responseで `physical running performance` と固有skillを別説明変数にする。
4. player-level holdoutで改善しないeventはplayer-specific化しない。
5. 最後に143試合リーグ分布を再較正する。
