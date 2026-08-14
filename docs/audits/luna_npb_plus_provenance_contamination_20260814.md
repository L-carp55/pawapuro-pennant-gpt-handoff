# Luna NPB+ provenance contamination audit

- 対象 repository: L-carp55/pawapuro-pennant-gpt-handoff
- 対象 branch: agent/grok-speed-large-wave-20260814
- 対象 HEAD: f6ee09bfa06f47d27931f412b5ca0820b1018c22
- 監査日時: 2026-08-14
- 目的: provenance contamination の機械的 inventory と dependency trace。判断・モデル設計・修正は実施していない。

## 結論

1. data/manual/npb_plus_screens.jsonl の hp_to_1b_sec は、リポジトリ上では NPB+ 入力として扱われているが、owner訂正「NPB+の直接計測は最高速度のみ」と矛盾する。最終分類は MISATTRIBUTED_SOURCE。値そのものの真の出所は、画像と生成履歴が無いため PROVENANCE_UNVERIFIED のまま。
2. full_effort_run_proxy_count は、PBP・走塁記録を合算した exposure proxy であり、NPB+の直接計測ではない。最終分類は DERIVED_PROXY。
3. hp_to_1b_sec は SP-100 の raw latent speed、measurement reliability、confidence、Candidate N、Candidate F へ数値伝播している。Candidate S への hp_to_1b_sec 依存は確認されない。
4. SP-015 の最終 weight validation target は NPB_PLUS_SPRINT_SPEED_KMH、すなわち NPB+最高速度だけである。SP-015 のweight計算に hp_to_1b_sec が混入した経路は確認されない。ただし別系統の calibrate_npb_plus_direct / configs/ratings.json では hp_to_1b_sec が走力校正に数値使用されている。

## 監査方法と全量検索 receipt

実行した検索は次の1本。対象HEADのtracked repository全体を対象にした。

    git -c core.quotePath=false grep -n -I -E 'hp_to_1b_sec|hp_to_1b|一塁到達|full_effort_run_proxy_count|top_speed_kmh|npb_plus_screens' --

検索結果は物理行 5,287、対象ファイル 158、file×term の occurrence group 231。

| 検索語 | matching lines | 注記 |
|---|---:|---|
| hp_to_1b_sec | 346 | hp_to_1b の部分文字列として重複する行を含まない語別行数 |
| hp_to_1b | 1,567 | hp_to_1b_sec を含む部分文字列検索 |
| 一塁到達 | 2,239 | 外部記事・docs・カードを含む |
| full_effort_run_proxy_count | 1,127 | proxy/exposure定義とderived outputを含む |
| top_speed_kmh | 563 | NPB+最高速度と下流出力を含む |
| npb_plus_screens | 11 | manifest/input path 等 |

全出現箇所の機械的な一覧は、同梱の outputs/derived/luna_npb_plus_provenance_contamination_20260814.json にある。各 occurrence group は file、term、type、occurrence_count、全 matching line の line_ranges、NPB+主張の構造注記、downstream数値使用の構造注記を保持する。line_ranges は file×term ごとに省略していない。

種別は path に基づき raw=data/manual、normalized=data/normalized、config=configs と data/manifests、production=scripts と src、derived=outputs/derived と outputs/cards、docs=その他の文書系に機械分類した。NPB+主張と下流数値使用の注記は構造的な annotation であり、最終判定は以下の行レベル証拠を優先する。

## Task 1 — 高影響箇所の line/context inventory

| file:line | 種別 | NPB+由来の主張 | downstream数値使用 | context |
|---|---|---|---|---|
| data/manual/npb_plus_screens.jsonl:1-101 | raw | yes | yes/indirect | top_speed_kmh と hp_to_1b_sec が同じ raw row に保存される。 |
| scripts/ingest_npb_plus_screens.mjs:1-11,23-31,40-48,81-87,102-117 | production | yes | yes | NPB+ screenshot input と説明し、両フィールドをSQLiteへ取り込み、sourceを全行に NPB+アプリ と設定する。 |
| scripts/parse_npb_plus_input.mjs:18-23,33,81,106 | production | yes | yes | NPB+画面の項目として「最速タイム（一塁到達）」をschema/source付きで扱う。 |
| outputs/derived/npb_plus_sprint_exposure_2026.json:7,38-49,155-173 | derived | mixed | yes | full_effort_run_proxy_count をPBP等の合算と明記し、speed measurementではないと定義する。 |
| scripts/sp100_npb_raw_latent_speed.mjs:35-42,58-80,83-110,123-143 | production | yes | yes | raw screen hpを読み、符号反転・標準化・rPF・relCombined・latent/confidenceへ使う。 |
| scripts/sp100_wiring_candidates_compare.mjs:27-35,71-95,109-120 | production | yes/mixed | yes/indirect | wiringはlatent outputを読み、N/Fへ渡す。H2Fは比較diagnosticとして別laneにも出る。 |
| scripts/calibrate_npb_plus_direct.mjs:1-5,40-44,115-128 | production | yes | yes | top_speed_kmh と hp_to_1b_sec をともに走力校正の入力として定義する。 |
| configs/ratings.json:760-783 | config | yes | yes | top speed と hp_to_1b_sec の両方に走力モデル係数が保存される。 |
| data/manual/hp_to_1b_measurements_curated.json:2-3,14-53 | raw | no / other source | yes/indirect | web measurement collection と source_name/source_url を保持する別系統。 |
| outputs/cards/*: player card line ranges | derived | not asserted or other | no/context-only | 外部・過去資料の一塁到達記述。NPB+ raw入力とは別系統。全43行はJSON inventoryに列挙。 |

上表以外の低影響docs、normalized rows、derived outputs、search receipts、manifest、過去カードもJSONの occurrence_groups に全件収録した。レポートでは同じ説明を5,287行分繰り返さず、機械一覧を正本とした。

## Task 2 — data/manual/npb_plus_screens.jsonl の provenance trace

### repository内で確認できる事実

- JSONLは109行。hp_to_1b_sec が非nullなのは100行、top_speed_kmh が非nullなのも100行。
- source_images は109行すべてにあり、参照文字列189件、unique 182件。ただし対象repositoryで tracked image file は0件。最初の例は data/manual/npb_plus_screens.jsonl:1 の 1000005049.png / 1000005050.png。
- ファイルblobは bcdb3716a71f89cae6115887be0a2f4e6ecc34d7。
- git log --follow -- data/manual/npb_plus_screens.jsonl は root commit 863740518aebb59eec2eee93e3f046fcd28d2486 の1件だけ。親commitはなく、当該HEADに至る過去のfield追加・変換履歴は無い。
- git log --follow -- scripts/ingest_npb_plus_screens.mjs も同じroot commitの1件だけ。
- ingest_npb_plus_screens.mjs はJSONLを読み、SQLiteの npb_plus_measurement に insert する。JSONLを書き出す処理はこのscriptには無い。repository内で source_images はJSONLとこのingest scriptにしか現れない。

### owner訂正との照合と分類

| 対象 | 機械的分類 | 根拠 |
|---|---|---|
| data/manual/npb_plus_screens.jsonl[].hp_to_1b_sec | MISATTRIBUTED_SOURCE | ingest/parser/下流コードはNPB+入力として扱うが、owner訂正によりNPB+直接計測項目ではない。 |
| hp_to_1b_sec の真の出所 | PROVENANCE_UNVERIFIED | raw画像、capture metadata、JSONL生成writer、親履歴がrepositoryに無い。真の出所を推測しない。 |
| data/manual/npb_plus_screens.jsonl[].top_speed_kmh | VERIFIED_NPB_PLUS | owner訂正がNPB+の直接計測として最高速度だけを認め、repositoryも同じfieldをNPB+として取り込む。画像そのものの再検証は不可。 |
| full_effort_run_proxy_count | DERIVED_PROXY | PBP・走塁記録の合算exposureで、speed measurementではない。 |
| data/manual/hp_to_1b_measurements_curated.json の seconds | VERIFIED_OTHER_SOURCE | web measurement fileが source_name/source_url を明示している。NPB+ rawとは別系統。 |

したがって「hp_to_1b_secがどこから作られたか」について、repositoryから確認できるのは「NPB+入力として記録された経路」までであり、実際の作成元は未確認である。owner訂正によりそのNPB+表示は誤帰属と分類するが、別の具体的出所へ置換はしない。

## Task 3 — SP-100 dependency trace

### 機械的な依存グラフ

    npb_plus_screens.hp_to_1b_sec
      -> sp100 row.hp_to_1b_sec
      -> z_h2f = standardize(-hp_to_1b_sec)
      -> rPF = corr(z_top, z_h2f)
      -> relCombined = Spearman-Brown(rPF)
      -> latent_speed_z / latent_speed_z_unshrunk / confidence
      -> Candidate N: N_npb_z / N_confidence
      -> Candidate F: F_fuse_z

    full_effort_run_proxy_count
      -> exposure_runs
      -> KAPPA_EXP / exposure_weight
      -> latent_speed_z / confidence
      -> Candidate N / Candidate F

| node | hp_to_1b_sec依存 | full_effort_run_proxy_count依存 | 事実 |
|---|---|---|---|
| sp100_npb_raw_latent_speed | yes, direct | yes, indirect | lines 58-65で入力、75-87でh2f/reliability、100-110でlatent/confidence。 |
| sp100_npb_raw_latent_speed.reliability | yes | no direct; proxyは別のexposure weight | rPF/relCombinedはtopとhpの2測定から計算。 |
| sp100_npb_raw_latent_speed.confidence | yes | yes | confidence = relCombined × exposure weight。 |
| Candidate S | no | no hp edge | DBの統計・proxy observationsから作る独立lane。 |
| Candidate N | yes, via latent output | yes, via latent confidence | N_npb_z と N_confidence はsp100 raw output由来。 |
| Candidate F | yes, indirect via N | yes, indirect via N confidence | relN=N_confidenceをw_nとしてSとNをfuse。 |

注意点として、sp100_wiring_candidates_compare.mjs:34 の used 配列には hp_to_1b_sec が明記されるが、同scriptがraw JSONLからhpを再読しているわけではない。実際の依存edgeは sp100_npb_raw_latent_speed.json のlatent/confidence経由である。H2F laneは同script:28,81,94,109-120で比較diagnosticに出るが、Candidate Sのweight教師ではない。

## Task 4 — SP-015 validation target

SP-015 final weight designの読込・計算を追跡した結果、targetは NPB+最高速度だけ。

- scripts/sp015_final_weight_design.mjs:57-62 は speed_historical_physical_measurements_2015_2026.json を読み、metric === NPB_PLUS_SPRINT_SPEED_KMH の行だけを npbSpeed mapへ入れる。
- 同script:129-146 は各componentと r.npb のconvergence / partial correlationを計算する。r.npb は上記top-speed metricのmap値。
- 同script:152-167 は reliability × partial convergence でweightを作る。hp_to_1b_sec を読み込む処理、map、formula edgeは無い。
- 同script:175-176、configs/running_norms.json:373-380、docs/audits/sp015_final_weight_design_20260814.md:17-36 はいずれも NPB+ raw sprint speed をaxis 6 / validation targetと明記する。

よって、SP-015そのものへの hp_to_1b_sec 混入は false。

ただし隣接する別経路として、scripts/calibrate_npb_plus_direct.mjs:40-44 は top_speed_kmh と hp_to_1b_sec をともに走力へmapし、同script:115-128でモデルを書き出す。configs/ratings.json:760-783にも両方の係数が保存される。これはSP-015のweight validation targetではないが、provenance contaminationとして報告対象であり、修正はしていない。

## 変更範囲

変更したのは新規の次の2ファイルだけ。

- docs/audits/luna_npb_plus_provenance_contamination_20260814.md
- outputs/derived/luna_npb_plus_provenance_contamination_20260814.json

production code、configs、registry、exclusion ledger、既存derived outputは変更していない。
