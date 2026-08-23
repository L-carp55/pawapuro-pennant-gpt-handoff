作業フォルダ: `/mnt/c/Users/amila/Desktop/Claude Code/repos/pawapuro-pennant-gpt-handoff`
Repo: `L-carp55/pawapuro-pennant-gpt-handoff`

# Codex task — PD-001A Age Dataset Foundation

Status: **READY FOR DISPATCH**
Date: 2026-08-23
Scope: **Phase 5 player lifecycle only**

## 0. Objective

PD-001「選手人生（成長・ピーク・衰え）」の最初の実装工程として、`data/pennant.db` の2006–2025一軍公式戦player-seasonに、信頼できる生年月日と再現可能なシーズン年齢を付与する基盤を作る。

このタスクの目的はaging curveを推定することではない。**PD-001Bが安全に学習できる、ID直結・provenance付き・coverage測定済みのage dimensionを作ること**である。

必ず最初に読む:

1. `CLAUDE.md`
2. `docs/design/integration_design_v0.md`
3. `docs/design/pd001_player_lifecycle_v0_20260823.md`
4. `docs/state/pd001_lifecycle_state_20260823.json`（存在する場合）
5. データ/ドキュメント規約、特にProEYE利用とNPB公式二次利用禁止に関する既存project rules

## 1. Branch / worktree

Target branch:

`codex/pd001a-age-dataset-foundation-20260823`

このbranchは `codex/speed-sp103-evidence-universe-completeness-20260823` から分岐済み。

開始時:

1. `git fetch origin`。
2. remote target branchが存在することとHEADを確認。
3. canonical checkoutの未commit変更を触らない。
4. reset/stash/clean/force-push禁止。
5. fresh isolated worktreeを使用する。推奨例:
   `/mnt/c/Users/amila/Desktop/Claude Code/_worktrees/pawapuro-pd001a-age-dataset-foundation-20260823`
6. branch/worktree/HEADをauditに記録。

## 2. Current measured baseline — 必ず自分で再計算する

ChatGPT側で現行 `data/pennant.db` を調べた基準値:

- 対象season: 2006–2025
- game type: 一軍公式戦 / repository上のcanonical equivalent
- batting/pitching union unique players: **2,743**
- batting/pitching union player-seasons: **13,192**

これはacceptanceを無理に合わせる固定値ではなく**canary baseline**。Codex側でSQLをpersistし、現在branch DBから再計算する。

差があれば黙って補正せず、query定義・game_type・重複・DB versionの違いを特定してauditへ残す。

### ID invariant

`player_id` は8桁の外部IDとして扱う。

**絶対にintegerへcastしない。leading zeroを落とさない。**

例: `01005133` は `1005133` ではない。

## 3. Source hierarchy

### 3.1 Primary — ProEYE Player Registry

Primary source:

`https://proeyekyuu.com/player-registry/`

現時点でこのdownloadable tableには少なくとも同じrowに:

- PlayerID
- Birthdate
- Name
- team/history等

が存在することを外部確認済み。

**ProEYE `PlayerID` と `data/pennant.db` の `player_id` をexact ID joinする。名前matchを主経路にしない。**

### 3.2 Acquisition order — bulk first

最初にPlayer Registry全体を**1つのdownload/export/table sourceとして取得できる再現可能経路**を調査・実装する。

DataTablesのCSV export、公開HTML/table payload、network endpoint等、サイトが通常提供している一括取得経路を優先する。

一括取得方法を確認する前に2,743個別ページを巡回しない。

取得時は:

- source URL
- retrieval timestamp (UTC)
- HTTP status / method
- row count
- raw column names
- content hash
- acquisition method

をmanifestへ保存する。

### 3.3 Fallback — individual ProEYE player pages

bulk registryから必要player_idのDOBが取れない、またはbulk exportが技術的に利用不能であることを測定してからのみ使用可。

Fallback URL patternの例:

`https://proeyekyuu.com/player/?PlayerID=XXXXXXXX`

対象はDBから再計算した必要unique ID集合だけ。現行canaryでは最大約**2,743 requests + bounded retries**。

これは大規模取得なので、fallbackへ切り替える前にaudit/receiptへ:

- なぜbulkが失敗したか
- 予定request数
- retry上限
- rate/concurrency policy

を明示する。

高並列でサイトへ負荷をかけない。1–2並列程度から始め、bounded retry + backoff + cacheを使う。失敗URL/statusをpersistし、無限retry禁止。

個別HTMLを大量にGitへそのままcommitする必要はない。再現性に必要なmanifest、抽出結果、hash/status、失敗/曖昧例を保存し、巨大raw dumpを避ける。

### 3.4 Secondary independent cross-check — Wikidata

Wikidata exact-ID cross-checkを実施する。

- `P4260` = NPB player ID
- `P569` = date of birth

PlayerID exact joinを原則とし、name fuzzy matchingで穴埋めしない。

取得結果にはWikidata QID、date precision、retrieval timestampを保持する。

Wikidataがyear/month precisionしか持たない場合、exact DOBとして扱わない。

### 3.5 Tertiary conflict resolution

ProEYEとWikidataがexact DOBで食い違う場合:

1. conflictを自動でどちらかに潰さない。
2. player_id単位でconflict ledgerへ出す。
3. feasibleなら第三の独立した合法なsourceで限定照合する。
4. **NPB公式サイトを第三sourceとして使用しない。**
5. 解決できなければ `canonical_birth_date = null` / unresolved conflictとしてPD-001Bから除外できる状態にする。

既存の公開player directoryはcurrent-player補助QAには使ってよいが、過去に確認した「年次roster CSV」を歴史snapshotとして使わない。2018等のファイルへ2026/current情報が混入しているため。

## 4. Forbidden shortcuts

- NPB公式からDOBを収集する。
- 名前だけでDOBをproduction採用する。
- ドラフト年、初出場年、年齢表示からDOBを逆算してproduction採用する。
- 欠損DOBへ `YYYY-01-01` 等の仮日付を入れる。
- `Age` 表示列をcanonical ageとして保存する。
- player ID leading zeroを落とす。
- missing/conflictを0件に見せるため推測する。
- age datasetタスクでaging curve自体をfitし始める。
- 走力のSP-078/SP-079、shoulder、SP-101/102/103成果を変更する。

## 5. Canonical age definition

DOBをcanonical source dataとして保存し、ageは必ずDOBからderiveする。

Season representative date = **July 1**。

各player-seasonに:

- `age_july1_completed`: `YYYY-07-01` 時点の満年齢。calendar arithmeticで計算。
- `age_july1_decimal`: `(YYYY-07-01 - birth_date in days) / 365.2425`。

を生成する。

`Age`列の表示値を流用しない。

全計算はtimezoneに依存しないdate-only arithmeticにする。

## 6. Target universe construction

`data/pennant.db` からPD-001Bの対象player-season universeを再現可能SQLで構築する。

原則:

- 2006–2025
- 一軍公式戦
- batting または pitching に存在するplayer-seasonのunion
- same player-seasonを1行にdedupe

必要ならfielding presenceを付加してよいが、target denominatorを勝手にfielding参加者だけへ縮小しない。

canonical target outputには最低限:

```text
player_id
season
birth_date
age_july1_completed
age_july1_decimal
birthdate_status
birthdate_source
birthdate_confidence
```

を持たせる。

## 7. Canonical player-level schema

`data/normalized/player_birthdate.csv` を第一候補とし、repo conventionsに合わせて必要ならgzip/TSV可。ただしmachine-readableであること。

最低限のfield:

```text
player_id
canonical_birth_date
status
primary_source
primary_birth_date
primary_source_key_or_url
primary_retrieved_at
secondary_source
secondary_birth_date
secondary_qid
secondary_date_precision
secondary_retrieved_at
match_method
confidence
conflict_flag
resolution_method
notes
```

Recommended status taxonomy:

- `VERIFIED_PRIMARY_SECONDARY_AGREE`
- `PRIMARY_ONLY`
- `SECONDARY_ONLY_EXACT_ID`
- `RESOLVED_CONFLICT`
- `UNRESOLVED_CONFLICT`
- `MISSING`
- `INVALID_SOURCE_DATE`

status名は必要に応じて改善してよいが、意味をschema/auditへ固定する。

## 8. Required outputs

最低限以下を作る。repo conventionに合わせて拡張可。

### Source / normalized

- `data/normalized/player_birthdate.csv`（or compressed equivalent）
- `data/normalized/player_season_age_2006_2025.csv.gz`
- `data/manifests/pd001a_proeye_player_registry_manifest.json`
- `data/manifests/pd001a_wikidata_birthdate_manifest.json`

### Derived QA

- `outputs/derived/pd001a_age_dataset_coverage.json`
- `outputs/derived/pd001a_birthdate_conflicts.tsv`
- `outputs/derived/pd001a_unresolved_players.tsv`
- `outputs/derived/qa_pd001a_age_dataset.json`

### Code

- reproducible builder script(s)
- independent QA script(s)
- target-universe SQL/queryをcodeまたはauditへpersist

`data/pennant.db` 97MB binaryをこのタスクで直接書き換えてcommitしない。必要ならcopy DB上でload testし、後工程用のloader/migrationをcodeとして残す。

### Audit

- `docs/audits/pd001a_age_dataset_foundation_20260823.md`

ここには重要なpositive/negative finding、coverage、source制約、失敗した取得方法と理由、conflict、残課題を残す。

**Codex最終チャットにしか存在する重要知見 = 0** にする。

## 9. Mandatory parallel structure

独立分割できるのでsub-agentsを並列使用する。同一fileを同時編集させない。

最低限:

### Worker A — target universe / ID integrity

- DB schema確認
- 2006–2025 official target SQL
- unique players/player-seasons
- 8-digit invariant / duplicates / nulls
- intermediate receiptを別fileへ

### Worker B — ProEYE primary acquisition

- bulk Player Registry取得方法の特定
- raw schema/row count/hash
- exact ID coverage
- fallbackが必要ならbounded collection
- intermediate receiptを別fileへ

### Worker C — Wikidata independent verification

- P4260/P569 bulk exact-ID acquisition
- precision validation
- primaryとのagreement/conflict table
- primary workerの実装をコピーせず独立経路

### Worker D — independent QA / red-team

Parent integration後のcanonical outputを別観点で検査。

Parent agentだけがcanonical normalized/QA/auditを最終統合する。

## 10. QA requirements

### 10.1 Coverage

必ず報告:

- target unique player denominator
- DOB canonical resolved player count / rate
- target player-season denominator
- resolved DOB player-season count / rate
- primary ProEYE coverage
- secondary Wikidata exact-ID coverage
- primary/secondary agreement count
- conflict count
- unresolved/missing count
- unresolvedが占めるplayer-season数と年代分布

100%でなくてもよい。**測定済みで、欠損が明示されていることが優先。**

### 10.2 ID integrity

- target `player_id` length distribution
- leading-zero count
- no accidental numeric coercion
- no duplicate canonical rows per player_id
- no player_id join through names when exact IDs exist

### 10.3 DOB validity

- parseable ISO date
- impossible month/day無し
- future DOB無し
- target seasonとの明らかな不可能年齢をflag
- exact source conflictをsilent overwriteしない
- partial Wikidata dateをexact扱いしない

### 10.4 Age arithmetic

独立fixtureで少なくとも:

- 誕生日が7月1日前
- 7月1日当日
- 7月1日後
- leap-day birth

を検査。

calendar completed ageとdecimal ageの双方を検証する。

### 10.5 Known canaries

少なくともsourceを再確認した上でcanaryを固定する。

例:

- `01005133` 千賀滉大 / Senga, Koudai — DOB `1993-01-30`。leading-zero preservation canary。
- `91395138` 太田椋 — DOBをProEYE exact page/registryで再確認。

canary値はtask proseを盲信せず、実取得sourceで再検証する。

### 10.6 Determinism

同じraw/cacheからbuilderを2回走らせ、canonical normalized outputsとdeterministic QAが同一になること。

retrieval timestamp等の非決定fieldはraw manifest側へ分離する。

### 10.7 Downstream join canary

`player_season_age` を既存batting/pitchingのunionへjoinし:

- row countがtarget universeと一致
- duplicate expansion無し
- unresolvedはnull/explicit statusのまま

であること。

## 11. Source-policy verification

ProEYEの公開ページが現在:

- downloadable `Player Registry` を提供していること
- registryにBirthdate + PlayerIDが同じtableに存在すること
- CSV/stat dataの自由利用を案内していること

を取得時点で再確認し、URLとretrieval dateをauditへ残す。

サイト構造が変わっていた場合、推測でendpointを作らず、実際のHTML/network/exportを調査する。

## 12. Definition of Done

PD-001AをDONEにできるのは全て満たしたとき:

1. target universeが再現可能に固定されている。
2. ProEYE PlayerID→DOBのdirect-ID primary pipelineが再現可能。
3. secondary Wikidata exact-ID cross-checkが実施済み、または測定可能な理由でbounded negative findingとして閉じている。
4. player-level canonical DOB datasetが生成済み。
5. 2006–2025 player-season age datasetが生成済み。
6. coverage / missing / conflict / player-season impactが全て数値化されている。
7. no silent guessing / no leading-zero loss / no duplicate expansion。
8. independent QAが実計算を検査してPASS、またはmaterial blockerを明示してPARTIAL。
9. deterministic rerun PASS。
10. important findings/limitations/failed methodsがGitHub audit/JSON/TSVへ保存済み。
11. `data/pennant.db` binaryは不要に書き換えていない。
12. speed owner ledger/SP-079/shoulder artifactsは変更していない。
13. commit + push済みでlocal HEAD == remote branch HEADを確認。

Terminal state:

- `DONE_VALIDATED_READY_FOR_PD001B`
- `DONE_WITH_BOUNDED_MISSINGNESS_READY_FOR_PD001B`
- `PARTIAL_BLOCKED`

のいずれかをaudit/stateへ記録する。

## 13. Stop condition

**PD-001Bのaging curve推定には進まない。**

PD-001Aをcommit/pushし、remote HEAD、coverage、conflicts、QA結果、terminal stateを報告したところで停止する。ChatGPT側で独立レビューしてからPD-001Bへ進める。
