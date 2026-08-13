# SP-099 review note（production 変更なし）

生成日: 2026-08-13  
読んだ: `src/cards/pipeline.mjs` の `blendDirect` と `speedOverride`

## 観察

- `blendDirect` は統計値と NPB+ 実測を `test_r` で混ぜる
- `speedOverride` は `statPrimarySpeed ? null : blendDirect(run?.speed, directs.走力)`
- production 既定は `statPrimarySpeed=false` なので、走力欄は blend 経路に入る
- `applyScale` は `buildAbilitySheet` の `graded(..., '走力')` 側。blend の入力がすでに較正後か較正前かは、この読みだけでは確定していない
- 100人 before/after は `statPrimarySpeed:true` なので、この bypass を避けていた、という既存 registry 記述と矛盾しない

## やらないこと

production の blend / scale は触っていない。最終判断は Opus。
