// MLB Statcast（Baseball Savant）から身体能力の実測値を取得する。
//
// なぜ要るか（2026-08-01 オーナー提案）:
//   NPBには走力・肩力の直接測定が公開されていないが、**MLBには実測が全選手分ある**。
//   Sprint Speed（走塁の最高速度 ft/sec）と Arm Strength（送球の最高球速 mph）は
//   仕様04 §1.2 の**第1階層データそのもの**。
//
// リーグ差をどう扱うか:
//   オーナー指摘「MLBとNPBではレベルに差があるので、MLBを高めに査定しないと
//   NPB選手が軒並み低くなる」。これは**推定で埋めない**。
//   NPBとMLBを**両方経験した選手（橋渡し）**を使えば、同一人物で
//   「NPB時代の統計」と「MLBでの実測身体能力」が対応づき、リーグ差は式に自動的に織り込まれる。
//   橋渡し = NPB→MLB（鈴木誠也・吉田正尚・筒香・秋山・青木・大谷）
//          ＋ MLB→NPB の外国人選手（毎年数十人）
//
// 規模: 3指標 × 11年 = 約33リクエスト。CSVで1リクエスト1ページ。
// 相手サーバへの配慮: 直列・1.5秒待機・取得済みスキップ。
//
// 使い方: node scripts/fetch_mlb_statcast.mjs [開始年] [終了年]

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'mlb_statcast');
const UA = 'pawapuro-pennant-appraisal/0.1 (personal, non-commercial; low-rate)';
const DELAY_MS = 1500;

const FROM = Number(process.argv[2] ?? 2015);
const TO = Number(process.argv[3] ?? 2025);

/** 指標ごとのURL。Sprint Speedは2015年から、Arm Strengthは2020年から */
const FEEDS = [
  {
    key: 'sprint_speed', from: 2015,
    url: y => `https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=${y}&position=&team=&min=10&csv=true`,
  },
  // 注(2026-08-05発見): arm-strengthエンドポイントは type=OF/IF を無視し、
  // 全ポジション統合の同一CSVを返す（arm_of_*.csv と arm_if_*.csv は全年で完全一致）。
  // ただし中身には arm_inf/arm_of 等ポジション別内訳列が入っているため実害はない。
  // 二重取得は残すが無駄なリクエストなので、次に取り直す時は片方に統合してよい。
  {
    key: 'arm_of', from: 2020,
    url: y => `https://baseballsavant.mlb.com/leaderboard/arm-strength?type=OF&year=${y}&minThrows=20&csv=true`,
  },
  {
    key: 'arm_if', from: 2020,
    url: y => `https://baseballsavant.mlb.com/leaderboard/arm-strength?type=IF&year=${y}&minThrows=20&csv=true`,
  },
  {
    key: 'poptime', from: 2015,
    url: y => `https://baseballsavant.mlb.com/leaderboard/poptime?year=${y}&team=&min2b=5&min3b=0&csv=true`,
  },
  {
    // 守備力(RngR由来・第3階層)の代替材料。OAAは守備範囲の実測(第1階層に近い)。2026-08-05 T-0097
    key: 'oaa', from: 2016,
    url: y => `https://baseballsavant.mlb.com/leaderboard/outs_above_average?type=Fielder&startYear=${y}&endYear=${y}&team=&range=year&min=1&pos=&roles=&viz=hide&csv=true`,
  },
  {
    // 捕球(失策率のみ・第3階層)の代替材料。打球の難度別成功率(5star=最難)。2026-08-05 T-0097
    key: 'catch_prob', from: 2016,
    url: y => `https://baseballsavant.mlb.com/leaderboard/catch_probability?type=Fielder&startYear=${y}&endYear=${y}&min=1&csv=true`,
  },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
await mkdir(RAW, { recursive: true });

let fetched = 0, cached = 0;
const failed = [];
const t0 = Date.now();

for (const feed of FEEDS) {
  for (let y = Math.max(FROM, feed.from); y <= TO; y++) {
    const out = path.join(RAW, `${feed.key}_${y}.csv`);
    if (existsSync(out)) { cached++; continue; }
    try {
      const res = await fetch(feed.url(y), { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines = text.split('\n').filter(l => l.trim());
      // 見出しだけ・空の年は保存しない（0で埋めない＝仕様03 §1.3）
      if (lines.length < 2) { failed.push(`${feed.key} ${y}: 中身なし`); await sleep(DELAY_MS); continue; }
      await writeFile(out, text, 'utf8');
      fetched++;
      console.error(`  ${feed.key} ${y}: ${lines.length - 1}人`);
    } catch (e) { failed.push(`${feed.key} ${y}: ${e.message}`); }
    await sleep(DELAY_MS);
  }
}

console.log(JSON.stringify({
  years: [FROM, TO], fetched, cached, failed: failed.length,
  elapsed_sec: Math.round((Date.now() - t0) / 1000),
  errors: failed,
}, null, 2));
