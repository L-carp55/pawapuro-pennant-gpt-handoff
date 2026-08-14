// Opus Bulk Review — red-team で確定した知見を台帳へ書き戻す（2026-08-14 第2便）
//
// 第1便（opus_largewave_review_remediation_20260814.mjs）は「測定を伴わない前進の巻き戻し」。
// 本便は「新たに判明した欠陥・確認できた健全性・オーナー裁定が要る論点」を、
// chat にしか無い状態にせず台帳へ落とす（CLAUDE.md「final chat response にしか存在しない重要知見 = 0」）。
//
// 使い方: node scripts/opus_largewave_review_findings_writeback_20260814.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const REG = 'docs/state/speed_task_registry.tsv';
const EXCL = 'docs/state/speed_exclusion_reason_ledger.tsv';

function readTsv(rel) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^﻿/, '').trimEnd();
  const lines = raw.split(/\r?\n/);
  const head = lines[0].split('\t');
  return { head, rows: lines.slice(1).filter(Boolean).map(l => {
    const c = l.split('\t');
    return Object.fromEntries(head.map((h, i) => [h, c[i]]));
  }) };
}
function writeTsv(rel, head, rows) {
  const out = [head.join('\t'), ...rows.map(r => head.map(h => (r[h] ?? '').replace(/[\t\r\n]/g, ' ')).join('\t'))].join('\n') + '\n';
  if (!DRY) fs.writeFileSync(path.join(ROOT, rel), out, 'utf8');
}
const addArt = (r, ...paths) => {
  const cur = (r.artifacts || '').split(';').map(s => s.trim()).filter(Boolean);
  for (const p of paths) if (!cur.includes(p)) cur.push(p);
  r.artifacts = cur.join(';');
};

const reg = readTsv(REG);
const byId = new Map(reg.rows.map(r => [r.task_id, r]));
const ex = readTsv(EXCL);
const exById = new Map(ex.rows.map(r => [r.exclusion_id, r]));
const log = [];
const set = (id, patch) => {
  const r = byId.get(id);
  if (!r) { log.push(`MISSING ${id}`); return null; }
  Object.assign(r, patch);
  log.push(`${id}: ${r.status}`);
  return r;
};

// ── SP-100: v2 で汚染除去。信頼性は識別できないと確定 ──────────────────
{
  const r = set('SP-100', {
    status: 'PARTIAL',
    next_action_or_blocker:
      '【2026-08-14 Opus v2 で作り直し】(1)provenance汚染を除去: hp_to_1b_sec は MISATTRIBUTED_SOURCE のため '
      + 'parallel-forms reliability(r=0.7462) / Spearman-Brown(0.8547) / confidence / Candidate N・F から全撤去。'
      + 'rawは削除せず監査用に温存し、NPB+測定としての利用を src/ratings/npb_plus_provenance.mjs の合流点で fail closed 化。'
      + '(2)NPB+ の直接計測は最高速度のみ＝**単一測定のため generic reliability は NOT_IDENTIFIABLE**。数値を作らない。'
      + '(3)汚染とは独立の欠陥も是正: exposure(全力走機会数)は測定対象と正に相関する（corr=+0.4148）ため、'
      + 'z への乗算縮小は遅い選手を強く縮める非対称になり分布の平均が動いていた（|z|損失 fast 0.3905 / slow 0.4666、縮小後 mean=+0.0552）。'
      + 'さらに top_speed は最大値統計なので機会数が少ない選手は精度でなく水準が下振れする。よって exposure は別欄の文脈情報にした。'
      + '(4)融合の尺度混同を是正: S(階層縮小済 sd=0.5807) と N(標準化のみ sd=1.0108、比1.741)を生のまま w で混ぜると '
      + 'w が重みでなく幅の配分になる。署名 corr(S-N,N)=-0.8335 → 共通集合で尺度を揃えて -0.3466（対称）へ解消。'
      + 'percentile 版も併記。(5)Candidate F は**単一値を作らない**。w_npb を仮定として振った帯（0.25/0.5/0.75）。'
      + 'winner=NOT_DECLARED_NPB_RELIABILITY_NOT_IDENTIFIABLE。'
      + '(6)H2F 検証レーン(sp007)は出典URLを持つ VERIFIED_OTHER_SOURCE で汚染と独立と実地確認＝温存。'
      + '｜残り: production への配線判断（オーナー裁定）。N の信頼性が識別できない以上、融合比は仮定のままである点を裁定材料に含めること。',
  });
  if (r) addArt(r,
    'configs/npb_plus_field_provenance.json',
    'src/ratings/npb_plus_provenance.mjs',
    'docs/audits/luna_npb_plus_provenance_contamination_20260814.md',
    'docs/audits/opus_largewave_bulk_review_20260814.md',
    'data/manual/npb_enterprise_tracking_article_20260810.json',
    'scripts/sp100_npb_enterprise_article_lane.mjs',
    'outputs/derived/npb_enterprise_article_lane_20260814.json');
}

// ── SP-016: 実測で3つの数学的欠陥。production 既定を control へ戻した ─────
{
  const r = set('SP-016', {
    status: 'PARTIAL',
    next_action_or_blocker:
      '【2026-08-14 Opus review: production 既定を continuous_prior → current_year_first_hard へ差し戻し】'
      + 'SP-016 が PARTIAL・EX-009 が POLICY_CONFLICT_REOPEN(gate_block=1) のまま、production の既定だけが '
      + 'continuous_prior になっていた＝fail-closed の逆。加えて採用前に直すべき欠陥を実測で確定: '
      + 'A-1 非単調性（縮小が分子だけに掛かり分母は生PA。paHist=500 で係数は paCur=0→0.9091 / 61→0.7973(最小) / 500→0.9091。'
      + 'z=+2 の選手は当年61打席の方が0打席より表示6.33点低い）｜'
      + 'A-3 正しい単一プール縮小 (n_c+λn_h)/(n_c+λn_h+κ) との誤差がPAで符号反転（6/500 で+18%過小、200/500 で-3%過剰）＝全体再較正で吸収不能｜'
      + 'A-4 規定打席級に履歴が残る（当年350-500PAで平均37.1%、≥500PAで32.4%、源田壮亮は当年361PAで54.8%）＝絶対禁止「十分なcurrent-year evidenceがある選手へ過去年を自動pool」に該当｜'
      + 'B λ=0.2703 は κ/median(PA_hist)=50/185 だが 185 は別母集団（名前キー n=480）の中央値。適用先の2025ロスター(n=260, player_idキー)の median は 520 で、規則どおりなら λ=0.0962。履歴に約2.8倍の重み｜'
      + 'F 採否ゲートが構成上落ちない（mean/sd を揃えた後 corr(delta,hard) ≡ -sqrt((1-r)/2) が恒等的に成立し予測-0.191108＝実測。閾値0.9は発火しえない。done_ready も continuous_structural_cliff=0 というリテラルとのAND）｜'
      + 'X-1 結合の重複行（2022-2025で15 player-season 重複・1628PA水増し。ロスター260人中10人が該当。hard では大半不可視だが continuous では paHist へ直接効く）｜'
      + 'X-2 sp016_continuous_prior_apply.mjs が冪等でない（cfg を読んで同じファイルを上書きするため再実行で control が新scaleになる）｜'
      + 'X-4 control 自体が27%で壊れている（260人中71人が pa>=100 フィルタで当年を消され NO_CURRENT_YEAR_OBSERVATION。'
      + 'sufficientWeight=50 の判定より前にフィルタが効くため、69打席の選手は「不十分」でなく「無かったこと」になる）｜'
      + '★確認できた健全性: 表示scale の再導出は本物の mean/sd 合わせ（交点 u*=49.7103 がロスター中心）でPowerPro個人ラベルへの再回帰ではない。'
      + '｜再開条件: A-1/A-3/A-4/B/X-1/X-4 を直し、F の採否ゲートを実際に落ちうる形へ作り替えてから再測定する',
  });
  if (r) addArt(r, 'docs/audits/opus_largewave_bulk_review_20260814.md');
}

// ── SP-015: 独立検証で clean。巻き戻さない。ただし記録すべき限界あり ─────
{
  const r = set('SP-015', {
    next_action_or_blocker:
      '【2026-08-14 Opus 独立検証: CLEAN。巻き戻さない】hp_to_1b_sec 汚染は3段階で否定した。'
      + '(1)スクリプト全走査で hp_to_1b の出現0件、SQLの6ビュー/テーブルはいずれも npb_plus_measurement を参照しない。'
      + '(2)入力ファイルの実値照合: metric=NPB_PLUS_SPRINT_SPEED_KMH の100件が npb_plus_screens.top_speed_kmh と'
      + '**100/100 完全一致(|Δ|<1e-9)**、hp_to_1b_sec と一致するものは**0/100**。値域も 29.0-35.0 km/h で秒の3-5帯は0件。'
      + '(3)重みをDBから独立に再計算し configs と**完全一致**（infieldHit 0.300 / gdpAvoid 0.1892 / ubr 0.1892 / triple 0.1637 / advance 0.0926）。'
      + '翌年再現性の項は式に無く（信頼性は季節内の二項誤差分散）、PowerPro個人ラベルも無い。'
      + '｜★記録すべき限界（巻き戻し理由ではない）: (a)有効Nの過大表示＝axis6の n=328 は player-season で、実体は**93人**（32人×5季ほか）。'
      + '重み比は頑健だが 0.563 対 0.437 の差の確からしさは主張できない。(b)temporal proximity を SAME_SEASON(=1) と表示しているが、'
      + '検証基準の NPB+ は全件2026 snapshot で、成分は2021-2025＝最大5年離れている。ラベルが実態と違う。'
      + '(c)結合の重複 player-season 7件（中田翔2021ほか）。t.ih が片チーム分の小計なのに分母は通年で infieldHit が下振れ。約1%。'
      + '(d)source_name が3ソースを並べた複合ラベルだが実体は top_speed_kmh 単独＝今回の誤帰属事故と同型の過大帰属。狭めること。'
      + '(e)baserunning_advance.mjs の材料採用理由コメントが「翌年との一致 0.527」と翌年再現性の言葉で書かれている（値は不使用と実証済みだが文言を直すこと）',
  });
  if (r) addArt(r, 'docs/audits/opus_largewave_bulk_review_20260814.md');
}

// ── SP-042: SP-100 v2 の改名で静かに0件化する経路があった。fail closed 化して再生成 ──
{
  const r = set('SP-042', {
    next_action_or_blocker:
      '【2026-08-14 Opus review: SP-100 v2 へ追随して再生成】入力フィールドが latent_speed_z_unshrunk → npb_top_speed_z へ変わり、'
      + '旧名のままだと filter が全件落として**静かに0件**になる経路だった（成果物は生成されるので気づけない）。fail closed を追加。'
      + 'contaminated だった confidence は撤去し、latent_reliability_status=NOT_IDENTIFIABLE と exposure 文脈に置換。'
      + '再実行結果: 比較95人、尺度検査 corr(gap,pp)=-0.4049 / corr(gap,latent)=0.2951 で健全。'
      + 'flag内訳 NONE73 / EXTERNAL15 / INTERNAL5 / BOTH2（汚染除去で latent の順序が変わったため前回と件数が異なる）。'
      + '用途は疑いの入口のみ・自動補正しない（SP-046 A-2 / B-1）',
  });
  if (r) addArt(r, 'docs/audits/opus_largewave_bulk_review_20260814.md');
}

// ── SP-033/034/035/075: 判断価値の実測とデッドロックの明示（オーナー裁定待ち・CCは動かさない） ──
const DEADLOCK = '【2026-08-14 Opus review: 判断価値を実測。★構造デッドロックをオーナーへ提起（CC側で blocker を外していない）】'
  + 'YouTube 7,145コメントの実測: 選手が付いたのは313件(4.4%)、自動採用は70件(0.98%)、'
  + '姓+タイトル一致による採用は**0件**、速度の主張を含むのは**11件(0.15%)**、'
  + 'そのうち同定まで通ったのは**0件**。唯一マップされた1件は「足が速い山川」＝皮肉の取りこぼし。'
  + '採用70件の67%(47件)がファビアン・モンテロの2人に集中。'
  + 'ボトルネックはコメント量ではなく上流の claim 分類器（タイトル一致した242件中31件が弱いラベルだけで弾かれている）。'
  + 'X側は81行中 current-100 の査定批判が**0件**、current_100 は行ごとに null のハードコード。'
  + '★デッドロック: NOT_COLLECTED は DONE 系で閉じられず（validator）、DONE_NEGATIVE_FINDING と書けば'
  + '「取得不能を証拠不存在と混同」で絶対禁止に触れる。SP-075 は SP-033/034/035 に依存し、SP-077 は SP-075 に依存するため、'
  + '**収集経路が塞がったままだと owner review queue は構造的に到達不能**。'
  + 'SR-016/017/018 の origin は「owner explicit request」なので、CCの判断で blocker を外すのは scope 削減にあたる＝実行していない。'
  + '推奨する決着形: 除外台帳へ scope=speed_community の行を新設し、上の実測値を evidence として '
  + 'NOT_COLLECTED を可視のまま残しつつ blocker から外す（前例=NOT_IDENTIFIABLE_PROVISIONAL_CURRENT_BEHAVIOR）。**オーナー裁定待ち**。';
for (const id of ['SP-033', 'SP-034', 'SP-035']) {
  const r = byId.get(id);
  if (r) { r.next_action_or_blocker = DEADLOCK; addArt(r, 'docs/audits/opus_largewave_bulk_review_20260814.md'); log.push(`${id}: deadlock recorded`); }
}
{
  const r = byId.get('SP-075');
  if (r) {
    r.next_action_or_blocker = '【2026-08-14 Opus review】自身の出力は閉じた入力で完成している（100人分類・stale NONE77/EXT11/INT5/BOTH2）。'
      + 'H2Fレーンの出所も VERIFIED_OTHER_SOURCE で汚染と独立と確認済み。'
      + 'ブロックは**純粋に transitive**（SP-033/034/035 が NOT_COLLECTED だから閉じられないだけ）。'
      + '上記3件のオーナー裁定が付けば同時に決着する。' + DEADLOCK;
    addArt(r, 'docs/audits/opus_largewave_bulk_review_20260814.md');
    log.push('SP-075: transitive block recorded');
  }
}

// ── EX-009: production 既定を control へ戻したことを記録 ──────────────
{
  const r = exById.get('EX-009');
  if (r) {
    r.corrected_policy = '【2026-08-14 Opus review】production の speedPooling 既定を continuous_prior → current_year_first_hard へ差し戻した。'
      + '本除外が POLICY_CONFLICT_REOPEN（gate_block=1）のまま既定だけが候補側になっていたため。'
      + 'continuous_prior は opts.poolingMode で明示した時だけ使う候補として保持。'
      + '採用前に直す欠陥は SP-016 の next_action へ列挙（非単調性・符号反転誤差・規定打席級への履歴pool・λの母集団取り違え・落ちないゲート・重複行・非冪等・controlの27%破損）。 ｜前回の記述: '
      + r.corrected_policy;
    log.push('EX-009: production default reverted, recorded');
  }
}

writeTsv(REG, reg.head, reg.rows);
writeTsv(EXCL, ex.head, ex.rows);
console.log(log.join('\n'));
console.log(`\n${DRY ? '[DRY]' : '[APPLIED]'} findings write-back done`);
