# Addendum — Community Recollection V3 役割分担

作成日: 2026-08-15
状態: **AUTHORITATIVE ADDENDUM**
Base task: `docs/tasks/CODEX_SPEED_COMMUNITY_RECOLLECTION_V3_20260814.md`

このaddendumは、元V3 taskの **X関連指示を上書きする**。

## 結論

- **Codex owner:** YouTube laneのみ
  - SP-033 PowerPro official YouTube
  - SP-034 Prospi official YouTube
  - official video discovery
  - comment/reply recovery
  - thread/context preservation
  - recall-first candidate extraction
  - semantic classification / player identity resolution
  - YouTube lane QA

- **Grok Build owner:** X laneのみ
  - SP-035 Official X replies / quote reactions
  - per-player X rating criticism / praise
  - X検索でのcurrent-100 coverage
  - thread/reply/quote文脈の意味解釈
  - X lane QA

- **統合owner:** 後続のOpus / GPT integrity review
  - CodexとGrokの成果を同じschemaへ統合
  - SP-033/034/035のstatusを独立監査
  - SP-075へ接続

## Codexがやってはいけないこと

元V3 taskの以下は **Codex scope外** とする。

- Agent C: Official X post/reply discovery
- Agent D: per-player X rating criticism / praise search
- Section 9: Official X / rating criticism rescue — SP-035
- X MCP / Grok-X searchの実行
- SP-035のstatus変更
- X側成果を理由にSP-075を閉じること

Xについて既存artifactを参照することは可。ただし **新規収集・再分類・close判断はしない**。

## Codexの完了条件

YouTube laneだけで以下を満たす。

1. 既知video IDの再利用だけでなくofficial channelから新規discoveryした
2. PowerPro / Prospi relevant video inventoryを作成した
3. top 100/300固定だけでなく、取得可能な範囲で深くcomment/replyを回収した
4. parent/reply/title contextを保持した
5. recall-first candidate extractionを実装した
6. semantic classificationをregex単独で終わらせなかった
7. V3 regression examples A-Gを通した
8. current-100 mappingをmaster tableからjoinした
9. false-negative sample auditを行った
10. SP-033 / SP-034だけを実データに基づいてstatus判定した

## Codex成果物のnamespace

X成果物と衝突しないよう、原則として以下を使う。

- `outputs/derived/speed_community_v3_youtube_*`
- `docs/audits/speed_community_v3_youtube_*`

raw/derivedを分離し、旧artifactは上書きしない。

## Xとの統合contract

Codex YouTube laneとGrok X laneは、最低限以下の共通列を出せるようにする。

```text
record_id
platform
source_type
source_url
source_post_or_video_id
parent_event_id
root_thread_id
published_at
text_or_excerpt
player
canonical_player_id
identity_method
identity_confidence
game
edition
claim_lane
rating_direction
speed_concept
discourse
explicit_rating_value
comparison_player
event_id
independence_group
reaction_volume
likes
source_quality
current_100
notes
```

platform固有列は追加してよい。

## Gate policy

- CodexはSP-035待ちを理由にYouTube laneを止めない。
- CodexがSP-033/034を十分に完了できた場合は、その事実を記録してpushする。
- **Speed Gate自体は閉じない。**
- **SP-075/077を最終化しない。**
- **肩力へ進まない。**

## 最終報告

Codexは完了時に以下だけ返す。

- branch
- remote head SHA
- fresh discovered video count
- recovered comments/replies count
- semantic-review candidate count
- accepted/contextual claim count
- current-100 mapped player count
- regression A-G result
- SP-033 status
- SP-034 status
- unresolved YouTube missingness

Xについては「Grok laneへ分離済み」とだけ記録する。