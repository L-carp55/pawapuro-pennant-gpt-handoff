# Pennant Baseball News / History Idea Mining — 2026-08-24

## 結論

第三監査後の正本を比較対象にして、Global Baseball News / History の未完了探索を再開した。12 laneを分離し、59件の実在イベント、57件の一意primary URL、52件のsecondary URLをイベントindexへ収録した。

重複排除後の判定は次のとおり。

- ALREADY_COVERED: 27件
- PARTIAL_EXTENSION: 30件
- NEW_CANDIDATE: 0件
- INSUFFICIENT_EVIDENCE: 2件

したがって、PW-001〜PW-260へ新しい要件を直接追加する段階ではない。十分な証拠があるものは8件の隔離candidate ledgerへ分離したが、いずれも既存要件または第三監査OPEN領域を跨ぐpartial extensionであり、現時点で「新しいPW要件」として採用していない。

## 中断からの復元状態

- 共有worktreeの未整理なspeed作業は変更せず保持した。
- 対象branchの中断前commit bc58570 は、現在のremote target branchの履歴に既に包含されていた。
- 現在のtarget baselineは 73adb48b62abab0ba2a3d9da66b550967bf65697 で、design branchと一致していた。
- target treeには中断前のニュース探索成果物やsub-agent出力は存在しなかったため、再利用できるpartial mining outputは確認されなかった。
- したがって、正本・後続audit・task addendumを再読したうえで、未開始だったresearch packageのみを新規生成した。既存PW ledger、走力正本、肩力正本、SP-079、PD-001A、game codeは触れていない。

## 調査範囲

12 laneの各laneで、少なくとも2種類のquery formulation、primary check、必要に応じたreputable secondary check、二回目の発見確認、既存要件へのmappingを行った。完了状況は outputs/research/pennant_lane_receipts/ の個別receiptに固定している。

| lane | 主なカバー範囲 | primary retained events |
|---|---|---:|
| NPB_RULES_LABOR_TRANSACTIONS | posting、Active Draft、farm entry、equipment governance、franchise entry | 7 |
| NPB_ORG_PLAYER_DEVELOPMENT | Carter Stewart、academy exchange、development route | 2 |
| MLB_MILB_RULES_CBA_DRAFT | rule package、CBA、Rule 5、draft lottery、PPI、MiLB structure、labor history | 9 |
| MLB_PLAYER_DEVELOPMENT_TECH | Statcast、Hawk-Eye、bat tracking、ABS | 4 |
| EAST_ASIA_KBO_CPBL | KBO 2nd Draft、expansion、Sangmu/Futures、CPBL foreign slots/eligibility | 6 |
| LATAM_CUBA_MEXICO_CARIBBEAN | Cuba route、reversal、Dominican development、Mexico transfer、FEPCUBE | 6 |
| EUROPE_AFRICA_OCEANIA_WBSC | European tier movement、Africa funding、Oceania exchange/weather/continuity | 5 |
| INTERNATIONAL_TOURNAMENTS_GLOBALIZATION | WBC、Olympics、Premier12、global visibility | 5 |
| BUSINESS_STADIUM_EXPANSION_MEDIA | ES CON、attendance、media-rights failure、league fallback | 4 |
| PLAYER_CAREER_CONTRACT_AGENT_CASES | posting era、Carter、deferred salary、opt-out、contract options | 4 |
| INTEGRITY_SCANDAL_RULE_EXPLOIT | Black Sox、Black Mist、NPB/MLB betting and official integrity | 7 |
| INDEPENDENT_COVERAGE_QA_RED_TEAM | merged package QA/red-team | event追加なし |

Lane間で同一イベントを参照する場合があるため、primary lane countの合計は59件に合わせ、共有参照はcoverage JSONへ明記した。

## 重要なpartial extension

1. PNC-001 — rule/measurement adaptation
   Rule changeやStatcast/ABS等の導入を、単なるrule flagではなく、選手役割ごとのadaptation lag、staff/data capacity、market repricingへ接続する候補。PW-145〜158とPW-190〜193のcross-layer clarification。

2. PNC-002 — development network capacity
   farm、winter league、academy、independent、regional competitionを、固定されたclub bonusではなく、拡張・共有・縮小・再構成されるdevelopment networkとして扱う候補。PW-149〜151、PW-179〜180、OPEN-08/17のpartial。

3. PNC-003 — institutional access-route state
   posting、foreign-player slot、transfer agreement、eligibility rulingについて、開通・有効期間・逆転・grandfatheringを持つ状態オブジェクトとする候補。PW-168〜173、PW-236〜242、OPEN-03/06/07/09のpartial。

4. PNC-004 — media/stadium resilience
   stadium relocationやmedia-rights failureが、勝敗から独立してresource/visibilityを変え、league fallbackを誘発する候補。PW-141〜144、PW-247、OPEN-13/20のpartial。

5. PNC-005 — integrity governance coverage
   playerだけでなくofficial/equipment/league responseも、evidence tier、investigation、sanction、trust repairで扱う候補。PW-201〜212とOPEN-04/20のpartial。

6. PNC-006 — era comparability ledger
   ball、ABS、rule、weather-format、labor-calendarの変化にtransition markerを付け、raw recordを保持したまま比較説明を可能にする候補。PW-190〜193、PW-213〜216とOPEN-10/11/12/18のpartial。

7. PNC-007 — contract cash timing and governance clauses
   headline value、cash timing、options/opt-outs、rare governance clauseを分離する候補。PW-108〜124とOPEN-05/06のpartial。

8. PNC-008 — international knowledge-transfer network
   academy、winter league、staff/data exchangeのdiffusion lagを、即時のglobal buffではなく、cost、trust、language、adoption lag付きで扱う候補。PW-145〜158、PW-179〜185のpartial。

各候補は outputs/derived/pennant_news_new_feature_candidates_20260824.tsv に隔離している。既存PW IDの行を変更したり、PW-261以降の要件番号を先取りしたりしていない。

## 既知OPEN領域の扱い

第三監査で列挙済みの以下の領域は、実在イベントが見つかっても「新発見」と数えなかった。

deployment AI、in-game tactics、retirement/comeback、special-ability lifecycle、morale/social、trade request/holdout、roster rights、farm/minor structure、amateur pipeline、schedule/weather、awards/legacy、league economy、labor stoppage、metagame、information visibility、physical maturation、officiating/ABS、external shocks、ownership succession。

これらはevent indexのexisting_requirement_ids、notes、design challenge JSONで既知のOPENとして明示した。特にActive Draft、KBO 2nd Draft、Rule 5、WBC carryover、farm structure、ABS、international accessはfalse-new red-team対象にした。

## 設計課題

outputs/derived/pennant_news_design_challenges_20260824.json に7件を収録した。中心課題は、単発イベントの追加ではなく、既存system同士の境界をどう接続するかである。

- rule/measurement transitionからadaptation lagとmarket priceへどう接続するか
- development capacityをどの粒度で扱うか
- institutional accessのreversalと既得権をどこまで再現するか
- media/stadium resilienceをdefault rare eventにするか
- integrityの安全な表現範囲とofficial scope
- era markerを通常UIへ出すかadvanced historyだけにするか
- contract clause detailを楽しさと管理負担のどこで止めるか

## ソースと限界

primary sourceを優先した。代表例は、[MLB/NPB posting agreement](https://www.mlb.com/news/mlb-npb-reach-agreement-on-posting-system/c-66013956)、[NPB Active Draft](https://c.npb.jp/geneki_draft/2022/)、[NPB Farm League expansion](https://bis.npb.or.jp/npb/farmleague_announcement_20230407.html)、[KBO 2nd Draft notice](https://www.koreabaseball.com/MediaNews/Notice/View.aspx?bdSe=8750)、[MLB 2023 rules](https://www.mlb.com/press-release/press-release-mlb-announces-rule-changes-for-2023-season)、[MLB Rule 5 glossary](https://www.mlb.com/glossary/transactions/rule-5-draft)、[MLB Cuba agreement](https://www.mlb.com/news/mlb-announces-deal-with-cuban-federation-c302036110)、[WBSC development report](https://static.wbsc.org/uploads/federations/0/cms/documents/80d35403-60ff-f021-4f4a-3e61cabf4dbd.pdf)、[ES CON Field owner material](https://www.nipponham.co.jp/eng/ir/library/annual/pdf/2023_annual/annual2023all_e.pdf)、[MLB local media fallback](https://www.mlb.com/press-release/press-release-mlb-to-produce-distribute-arizona-diamondbacks-games-july-18-2023)、[MLB betting suspensions](https://www.mlb.com/news/mlb-announces-sports-betting-violation-suspensions)。

限界はcoverage JSONとlane receiptに記録した。12 NPB球団の完全なclub-by-club qualitative history、非公開契約、proprietary model、medical threshold、internal staff outcomeは主張していない。CPBL match-fixing historyはprimary case fileを得られず、INSUFFICIENT_EVIDENCEとしてcandidateから除外した。2026 current-status項目は実装前に再確認が必要である。

## owner synthesisへのhandoff

本packageのterminal stateは DONE_WITH_BOUNDED_BLIND_SPOTS_READY_FOR_OWNER_SYNTHESIS。次に必要なのは、8 partial extensionからownerが採否・粒度・toggle/defaultを選ぶことであり、ゲーム機能実装、PD-001A、SP-079、肩力、走力正本の変更ではない。
