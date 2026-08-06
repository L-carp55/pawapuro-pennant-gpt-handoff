// NF3の球団別打撃ページを取得する（1球団1ページに全選手が載る）。
//
// なぜ要るか:
//   仕様04 §1.2 の第3階層に「内野安打率」が挙がっているのに実装できていなかった。
//   プロEYE球にもNPB Basementにも内野安打の列が無く、唯一この球団別ページにある。
//   内野ゴロを安打にできるのは足が速いからなので、**三塁打より脚力に直結する**
//   （三塁打は長打力・球場・打球方向が混ざる、と仕様§1.2自身が警告している）。
//
//   さらにこのページは 2005年から取れるので、選手個別ページ（2023-2025で取得済み）より
//   ずっと広い年代をカバーできる。得点圏打率も全選手・全年で入る。
//
// 規模: 12球団 × 22年 = 264ページ。前回の選手個別ページ2,098件より小さい。
// 作法は前回と同じ（直列・1.1秒待機・gzip保存・取得済みスキップ）。
//
// 使い方: node scripts/fetch_nf3_team_batting.mjs [開始年] [終了年]

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'nf3_team');
const BASE = 'https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php';
const DELAY_MS = 1100;
const UA = 'pawapuro-pennant-appraisal/0.1 (personal, non-commercial; low-rate 1req/1.1s)';

const FROM = Number(process.argv[2] ?? 2005);
const TO = Number(process.argv[3] ?? 2025);
const TEAMS = [
  ...['T', 'DB', 'G', 'D', 'C', 'S'].map(t => ({ tm: t, leg: 0 })),
  ...['H', 'F', 'B', 'E', 'L', 'M'].map(t => ({ tm: t, leg: 1 })),
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
await mkdir(RAW, { recursive: true });

let fetched = 0, cached = 0;
const failed = [];
const t0 = Date.now();

for (let y = FROM; y <= TO; y++) {
  for (const { tm, leg } of TEAMS) {
    const out = path.join(RAW, `${y}_${tm}.htm.gz`);
    if (existsSync(out)) { cached++; continue; }
    const url = `${BASE}?y=${y}&leg=${leg}&tm=${tm}&fp=0&dn=1&dk=0`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // 選手行が無いページ（その年に存在しない球団など）は保存しない
      if (!/_stat\.htm/.test(html)) { failed.push(`${y} ${tm}: 選手行なし`); await sleep(DELAY_MS); continue; }
      await writeFile(out, gzipSync(Buffer.from(html, 'utf8')));
      fetched++;
    } catch (e) { failed.push(`${y} ${tm}: ${e.message}`); }
    await sleep(DELAY_MS);
  }
  if ((y - FROM) % 5 === 4) console.error(`  ...${y}年まで完了（${fetched}件取得 / ${Math.round((Date.now() - t0) / 1000)}秒）`);
}

console.log(JSON.stringify({
  years: [FROM, TO], fetched, cached, failed: failed.length,
  elapsed_sec: Math.round((Date.now() - t0) / 1000),
  errors: failed.slice(0, 20),
}, null, 2));
