// 査定レポートの生成（Sol仕様 02 §15、03 §8、00 §7「出力上の絶対条件」）
//
// 仕様が要求する項目（00 §7）:
//   カード定義 / 使用年度 / 採用理由 / 入力データ / データ出典 / 欠損・推定 /
//   2019換算 / 小サンプル縮小 / 平均得能込み能力 / 得能一覧 / 得能平均との差 /
//   M/P相互作用 / 最終能力 / 走守の分解 / 信頼度 / 未確認事項 / KONAMI比較（最後）
//
// 「途中式を省略しない」（02 §15）が絶対条件。

import { AdjustmentLedger } from './ledger.mjs';

const pct = v => v == null ? '—' : (v * 100).toFixed(1) + '%';
const r3 = v => v == null ? '—' : v.toFixed(3);
const r1 = v => v == null ? '—' : v.toFixed(1);

/**
 * 1選手の査定レポートをMarkdownで生成する。
 * @param {object} p {name, team, season, cardType, line}
 * @param {object} bat 打撃査定（appraiseBattingの出力）
 * @param {object} run 走塁査定 {speed, stealing, baserunning}
 * @param {object[]} fld 守備査定（ポジション別）
 * @param {object[]} ledgers 調整台帳の結果
 * @param {object} meta {sources, unresolved, provisional}
 */
export function renderPlayerReport(p, bat, run, fld, ledgers, meta = {}) {
  const L = [];
  const o = bat?.observed ?? {};

  L.push(`# ${p.name}（${p.team}・${p.season}年）`);
  L.push('');
  L.push('## カード定義');
  L.push(`- 種別: ${p.cardType ?? 'peak_single_year（ピーク単年）'}`);
  L.push(`- 対象年度: ${p.season}`);
  L.push(`- 採用理由: ${p.reason ?? '指定年度'}`);
  L.push('');

  // --- 入力データ ---
  L.push('## 入力データ');
  const li = p.line ?? {};
  L.push('| 項目 | 値 |');
  L.push('|---|---:|');
  for (const [k, label] of [['PA', '打席'], ['AB', '打数'], ['H', '安打'], ['B2', '二塁打'], ['B3', '三塁打'],
  ['HR', '本塁打'], ['BB', '四球'], ['HBP', '死球'], ['SO', '三振'], ['SH', '犠打'], ['SF', '犠飛']]) {
    if (li[k] != null) L.push(`| ${label} | ${li[k]} |`);
  }
  L.push('');
  L.push(`データ出典: ${(meta.sources ?? ['プロEYE球', 'NPB Basement']).join(' / ')}`);
  if (meta.estimated?.length) {
    L.push('');
    L.push('**欠損・推定**:');
    for (const e of meta.estimated) L.push(`- ${e}`);
  }
  L.push('');

  // --- 第1層: 補正成績（途中式を全部出す） ---
  L.push('## 第1層: 補正成績');
  L.push('');
  L.push('### 環境補正（2019年NPB基準）');
  if (o.raw && o.envApplied) {
    L.push('| 指標 | 生値 | 環境補正後 | 倍率 |');
    L.push('|---|---:|---:|---:|');
    const avgRatio = o.preShrink?.avg && o.raw.avg ? o.preShrink.avg / o.raw.avg : null;
    const hrRatio = o.preShrink?.hrPer500 && o.raw.hrPer500 ? o.preShrink.hrPer500 / o.raw.hrPer500 : null;
    L.push(`| 打率 | ${r3(o.raw.avg)} | ${r3(o.preShrink?.avg)} | ${avgRatio ? '×' + avgRatio.toFixed(3) : '—'} |`);
    L.push(`| 500打席相当本塁打 | ${r1(o.raw.hrPer500)} | ${r1(o.preShrink?.hrPer500)} | ${hrRatio ? '×' + hrRatio.toFixed(3) : '—'} |`);
  } else {
    L.push('環境補正なし（同一年内の相対比較）');
  }
  L.push('');

  L.push('### 経験ベイズ縮小');
  if (o.priorKind) {
    L.push(`- Prior: **${o.priorKind}**（${o.priorBasis ?? '—'}）`);
    L.push('');
    L.push('| 指標 | 縮小前 | 縮小後 |');
    L.push('|---|---:|---:|');
    L.push(`| 打率 | ${r3(o.preShrink?.avg)} | ${r3(o.avg)} |`);
    L.push(`| 500打席相当本塁打 | ${r1(o.preShrink?.hrPer500)} | ${r1(o.hrPer500)} |`);
    L.push('');
    L.push(`打数${o.AB}に対しPriorの重みが効くため、打数が少ないほどPriorへ寄る（少打席は減点ではない＝仕様§8.1）`);
  } else {
    L.push('縮小なし');
  }
  L.push('');

  // --- 第2層: 平均得能込み基準 ---
  L.push('## 第2層: 平均得能込み基準');
  L.push('| 能力 | 値 | 由来 |');
  L.push('|---|---:|---|');
  L.push(`| ミート | ${r1(bat?.meet)} | 補正後打率 ${r3(o.avg)} をアンカーで変換 |`);
  L.push(`| パワー | ${r1(bat?.power)} | 500打席相当本塁打 ${r1(o.hrPer500)} をアンカーで変換 |`);
  L.push(`| コンタクト | ${r1(bat?.contact)} | 三振率 ${pct(o.soRate)} |`);
  L.push(`| 選球眼 | ${r1(bat?.eye)} | 四球率 ${pct(o.bbRate)} |`);
  L.push('');

  // --- 第3層: 個別査定能力（調整台帳） ---
  if (ledgers?.length) {
    L.push('## 第3層: 個別査定能力（調整台帳）');
    L.push('');
    L.push('得能ぶんを差し引いた基礎能力。**調整しなかった項目も理由付きで記録する**（「検討したが不要」と「見落とし」を区別するため）。');
    L.push('');
    for (const led of ledgers) {
      L.push('```');
      L.push(AdjustmentLedger.render(led));
      L.push('```');
      if (led.hasProvisional) L.push('※ [暫定]の調整を含む');
      L.push('');
    }
  }

  // --- 走塁 ---
  if (run) {
    L.push('## 走塁の分解');
    L.push('| 能力 | 値 | 根拠 |');
    L.push('|---|---:|---|');
    L.push(`| 走力 | ${r1(run.speed)} | 三塁打率・併殺回避・UBRの合成（**盗塁は入れない**＝仕様§1.1） |`);
    L.push(`| 盗塁 | ${r1(run.stealing?.rating)} | ${run.stealing?.reason ?? run.stealing?.verdict ?? '—'} |`);
    L.push(`| 走塁 | ${r1(run.baserunning?.rating)} | UBRから走力で説明できる分を引いた残差 |`);
    L.push('');
  }

  // --- 守備 ---
  if (fld?.length) {
    L.push('## 守備の分解');
    L.push('仕様§7により**失策は捕球のみに影響し、守備力には入れない**。');
    L.push('');
    L.push('| 位置 | 守備イニング | 守備力 | 捕球 | 肩 | 信頼度 |');
    L.push('|---|---:|---:|---:|---:|---:|');
    for (const f of fld) {
      L.push(`| ${f.pos}${f.isPrimary ? '（主）' : ''} | ${r1(f.inn)} | ${r1(f.fielding?.rating)} | ${r1(f.catching?.rating)} | ${r1(f.arm?.rating)} | ${r1(f.fielding?.reliability)} |`);
    }
    L.push('');
    const of = fld.find(f => ['LF', 'CF', 'RF'].includes(f.pos));
    if (of?.fielding?.speedAdjusted) {
      L.push(`外野の守備力は走力で説明できる範囲を差し引いた残差（仕様§6「同じ現実Rangeなら俊足は守備力を下げる」）。`);
      L.push('');
    }
  }

  // --- 信頼度 ---
  L.push('## 信頼度');
  L.push('| 観点 | 値 |');
  L.push('|---|---|');
  L.push(`| サンプル | ${o.PA}打席 / ${o.AB}打数 |`);
  L.push(`| 文脈 | ${meta.contextTier ?? 'C'}（A=対右×非得点圏 / B=対右 / C=総合のみ） |`);
  L.push(`| Prior品質 | ${o.priorKind ?? '—'} |`);
  L.push(`| 環境補正 | ${o.envApplied ? '適用' : '未適用'} |`);
  L.push('');

  // --- 未確認事項 ---
  L.push('## 未確認事項');
  const unresolved = meta.unresolved ?? [];
  if (meta.contextTier !== 'A') unresolved.push('対左右・得点圏の分割データ未取得のため、チャンス・対左の得能は未査定（Tier C）');
  if (!unresolved.length) L.push('なし');
  else for (const u of unresolved) L.push(`- ${u}`);
  L.push('');

  // --- KONAMI比較は最後（仕様00 §7・05 §10） ---
  L.push('## KONAMI比較');
  L.push('**未実施**。仕様05 §10により、独自査定を凍結（コミット/SHA記録）した後にのみ行う。');

  return L.join('\n');
}

/** 一覧用の1行（能力値のみ） */
export function renderRow(name, bat, run, fld) {
  const primary = fld?.find(f => f.isPrimary);
  return {
    選手: name,
    弾道: bat?.trajectory ?? '—',
    ミート: bat?.meet != null ? Math.round(bat.meet) : null,
    パワー: bat?.power != null ? Math.round(bat.power) : null,
    走力: run?.speed != null ? Math.round(run.speed) : null,
    肩力: primary?.arm?.rating != null ? Math.round(primary.arm.rating) : null,
    守備力: primary?.fielding?.rating != null ? Math.round(primary.fielding.rating) : null,
    捕球: primary?.catching?.rating != null ? Math.round(primary.catching.rating) : null,
  };
}
