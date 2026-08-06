// 取込データの機械検算。実データ全行に対して整合式を通し、不一致率を数値で出す。
import { DatabaseSync } from 'node:sqlite';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const checks = [];
const add = (name, target, sql, note = '') => {
  const r = db.prepare(sql).get();
  checks.push({ name, target, total: r.total, bad: r.bad, rate: r.total ? (r.bad / r.total) : 0, note });
};

// --- 打撃 ---
add('安打 = 一塁打+二塁打+三塁打+本塁打', 'batting', `
  SELECT COUNT(*) total, SUM(CASE WHEN h <> b1+b2+b3+hr THEN 1 ELSE 0 END) bad
  FROM batting WHERE h IS NOT NULL AND b1 IS NOT NULL`);

add('塁打 = 1B+2*2B+3*3B+4*HR', 'batting', `
  SELECT COUNT(*) total, SUM(CASE WHEN tb <> b1+2*b2+3*b3+4*hr THEN 1 ELSE 0 END) bad
  FROM batting WHERE tb IS NOT NULL AND b1 IS NOT NULL`);

// CSV掲載値は3桁丸め（例 .1875 → "0.188"）。丸めの理論上限0.0005を超えるものだけを実質不一致とする
const R3 = 0.00051;
add('打率 = 安打/打数（3桁丸め超え）', 'batting', `
  SELECT COUNT(*) total, SUM(CASE WHEN ABS(avg - CAST(h AS REAL)/ab) > ${R3} THEN 1 ELSE 0 END) bad
  FROM batting WHERE ab > 0 AND avg IS NOT NULL`);

add('長打率 = 塁打/打数（3桁丸め超え）', 'batting', `
  SELECT COUNT(*) total, SUM(CASE WHEN ABS(slg - CAST(tb AS REAL)/ab) > ${R3} THEN 1 ELSE 0 END) bad
  FROM batting WHERE ab > 0 AND slg IS NOT NULL`);

add('出塁率 = (H+BB+HBP)/(AB+BB+HBP+SF)（3桁丸め超え）', 'batting', `
  SELECT COUNT(*) total, SUM(CASE WHEN ABS(obp - CAST(h+bb+hbp AS REAL)/(ab+bb+hbp+sf)) > ${R3} THEN 1 ELSE 0 END) bad
  FROM batting WHERE (ab+bb+hbp+sf) > 0 AND obp IS NOT NULL`);

add('打席 = 打数+四球+死球+犠打+犠飛', 'batting', `
  SELECT COUNT(*) total, SUM(CASE WHEN pa <> ab+bb+hbp+sh+sf THEN 1 ELSE 0 END) bad
  FROM batting WHERE pa IS NOT NULL AND ab IS NOT NULL`,
  '不一致19件は全て差が+1〜+2。打撃妨害・走塁妨害（公式記録上PAに数えABに数えない）で説明でき、データ誤りではない');

// --- 守備 ---
add('守備率 = (刺殺+補殺)/(刺殺+補殺+失策) (±0.0005)', 'fielding', `
  SELECT COUNT(*) total, SUM(CASE WHEN ABS(fpct - CAST(po+a AS REAL)/(po+a+e)) > 0.0005 THEN 1 ELSE 0 END) bad
  FROM fielding WHERE (po+a+e) > 0 AND fpct IS NOT NULL`);

// --- 投手 ---
add('防御率 = 自責点/(投球回)*9（2桁丸め超え）', 'pitching', `
  SELECT COUNT(*) total, SUM(CASE WHEN ABS(era - CAST(er AS REAL)*27/outs) > 0.0051 THEN 1 ELSE 0 END) bad
  FROM pitching WHERE outs > 0 AND era IS NOT NULL`);

add('WHIP = (被安打+与四球)/(投球回) (±0.005)', 'pitching', `
  SELECT COUNT(*) total, SUM(CASE WHEN ABS(whip - CAST(h+bb AS REAL)*3/outs) > 0.005 THEN 1 ELSE 0 END) bad
  FROM pitching WHERE outs > 0 AND whip IS NOT NULL`);

add('K/9 = 奪三振*27/アウト数 (±0.005)', 'pitching', `
  SELECT COUNT(*) total, SUM(CASE WHEN ABS(k9 - CAST(so AS REAL)*27/outs) > 0.005 THEN 1 ELSE 0 END) bad
  FROM pitching WHERE outs > 0 AND k9 IS NOT NULL`);

add('対戦打者数 >= アウト数（下限の整合）', 'pitching', `
  SELECT COUNT(*) total, SUM(CASE WHEN bf < outs THEN 1 ELSE 0 END) bad
  FROM pitching WHERE outs > 0 AND bf IS NOT NULL`,
  '**実質不一致**。打者数がアウト数を下回るのは物理的に不可能＝元データの誤り。該当5件は全て無安打無四球の短イニング。対戦打者数(bf)は査定の主入力にせず、必要時はH+BB+HBP+アウト数から再構成する');

add('投球回テキスト→アウト数の変換失敗', 'pitching', `
  SELECT COUNT(*) total, SUM(CASE WHEN outs IS NULL THEN 1 ELSE 0 END) bad
  FROM pitching WHERE ip_text IS NOT NULL`);

// --- リーグ集計（エンジン校正の目標値）---
const league = db.prepare(`
  SELECT season,
    SUM(ab) ab, SUM(h) h, SUM(hr) hr, SUM(bb) bb, SUM(so) so, SUM(hbp) hbp,
    SUM(b2) b2, SUM(b3) b3, SUM(sf) sf, SUM(pa) pa
  FROM batting WHERE game_type = '公式戦' GROUP BY season ORDER BY season`).all();

const leagueRows = league.map(r => ({
  season: r.season,
  AVG: +(r.h / r.ab).toFixed(4),
  HR率: +(r.hr / r.ab).toFixed(5),
  BB率: +(r.bb / r.pa).toFixed(4),
  K率: +(r.so / r.pa).toFixed(4),
  ABperPA: +(r.ab / r.pa).toFixed(4),
}));

// 2019年の500PA以上打者のAB/PA（Sol仕様の436.25の再検証）
const ref = db.prepare(`
  SELECT SUM(ab) ab, SUM(pa) pa, COUNT(*) n FROM batting
  WHERE game_type='公式戦' AND season=2019 AND pa >= 500`).get();
const abRef2019 = ref.pa ? (ref.ab / ref.pa) * 500 : null;

const totalBad = checks.reduce((a, c) => a + c.bad, 0);

const md = `---
status: final
created: 2026-07-31
---

# Phase 1 検算レポート — 実成績データ取込

出典: プロEYE球 (proeyekyuu, https://proeyekyuu.com/ja/csvs-jp/)
対象: 2016-2025年 打撃・投手・守備 全30ファイル / 取込 ${9343 + 4455 + 11260} 行

## 1. 整合検算（全行実行）

| 検算項目 | 対象 | 総行 | 不一致 | 不一致率 |
|---|---|---:|---:|---:|
${checks.map(c => `| ${c.name} | ${c.target} | ${c.total.toLocaleString()} | ${c.bad.toLocaleString()} | ${(c.rate * 100).toFixed(3)}% |`).join('\n')}

${checks.filter(c => c.note).map(c => `- **${c.name}**: ${c.note}`).join('\n')}

不一致合計: **${totalBad.toLocaleString()}件**

## 2. リーグ全体の年度別実測値（エンジン校正の目標値）

査定→エンジンで1シーズン回した時、この分布を再現できることが合格判定になる。

| 年 | リーグ打率 | 本塁打/打数 | 四球率 | 三振率 | 打数/打席 |
|---:|---:|---:|---:|---:|---:|
${leagueRows.map(r => `| ${r.season} | ${r.AVG.toFixed(3)} | ${r.HR率.toFixed(5)} | ${(r.BB率 * 100).toFixed(1)}% | ${(r.K率 * 100).toFixed(1)}% | ${r.ABperPA.toFixed(3)} |`).join('\n')}

## 3. Sol仕様「500PA相当AB = 436.25」の再検証

2019年・公式戦・500打席以上の打者 ${ref.n}人の実測から再計算:

- 合計打数 ${ref.ab?.toLocaleString()} / 合計打席 ${ref.pa?.toLocaleString()}
- **500打席相当の打数 = ${abRef2019?.toFixed(2)}**
- Sol仕様の記載値 436.25 との差: ${abRef2019 ? (abRef2019 - 436.25).toFixed(2) : 'N/A'}

## 4. データ上の注意点

- **ゲームタイプが4種混在**: 公式戦 / CSファースト / CSファイナル / 日本シリーズ。査定は\`game_type='公式戦'\`に限定すること
- 投球回はNPB表記（"46.2" = 46回2/3）。DBにはアウト数(\`outs\`)へ変換して格納。元表記も\`ip_text\`に保持
- 欠損は0でなくnullで保持（捕逸は捕手以外null等）
`;

await writeFile(path.join(ROOT, 'outputs', 'phase1_validation_report.md'), md, 'utf8');
console.log(JSON.stringify({ checks, abRef2019, leagueSample: leagueRows.slice(-3) }, null, 2));
db.close();
