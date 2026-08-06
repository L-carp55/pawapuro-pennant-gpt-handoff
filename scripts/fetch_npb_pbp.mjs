// NPBの1球データ（play-by-play）を Nippon Baseball Data Repository から取得する。
//
// 出典表記（ライセンス条件）: This uses data sourced from the Nippon Baseball Data Repository.
//   https://github.com/armstjc/Nippon-Baseball-Data-Repository （MIT License）
//
// なぜ要るか（2026-08-05）:
//   NPB+ の実測（送球速度など）は **2026年しか出ない**（オーナー確認）。一方、査定対象は2024年で、
//   成績の正本にしているプロEYE球は年次更新のため 2026年がまだ無い（実際に404を確認）。
//   そのため「2026年に誰がどれだけ出ているか」「今どの守備位置か」が分からず、
//   撮影をお願いする選手を絞れなかった。
//   このリポジトリには **2026-02〜07の1球データ**があり、1行に打者・投手・守備9人の名前が入っている。
//   ここから出場量と守備位置が両方出る。
//
// 検証（2026-08-05、2026-07の1ファイルで確認）:
//   坂倉将吾 = 三塁1412球・一塁499球（オーナー談「ほぼ捕手として出ておらず一塁と三塁」と一致）
//   末包・堂林・會澤 = 7月の出場なし（オーナー談「今季ほぼ出ていない」と一致）
//
// 規模: 1シーズン6ファイル・約160MB。相手はGitHubのraw配信で、直列・取得済みスキップ。

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'npb_pbp');
const BASE = 'https://raw.githubusercontent.com/armstjc/Nippon-Baseball-Data-Repository/main/pbp';
const UA = 'pawapuro-pennant-appraisal/0.1 (personal, non-commercial; low-rate)';

const SEASON = Number(process.argv[2] ?? 2026);
const MONTHS = process.argv[3]
  ? process.argv[3].split(',')
  : ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];

await mkdir(RAW, { recursive: true });
let fetched = 0, cached = 0, bytes = 0;
const missing = [];

for (const m of MONTHS) {
  const fn = `${SEASON}-${m}_pbp.csv`;
  const dest = path.join(RAW, fn);
  if (existsSync(dest)) { cached++; continue; }
  const res = await fetch(`${BASE}/${fn}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) { missing.push(`${fn}: HTTP ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  // 見出しだけのファイルは保存しない（0で埋めない＝仕様03 §1.3と同じ規律）
  if (buf.length < 1000) { missing.push(`${fn}: 中身なし`); continue; }
  await writeFile(dest, buf);
  fetched++; bytes += buf.length;
  console.error(`  ${fn}: ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
}

console.log(JSON.stringify({
  season: SEASON, fetched, cached,
  downloaded_mb: Number((bytes / 1024 / 1024).toFixed(1)),
  not_available: missing,
  attribution: 'This uses data sourced from the Nippon Baseball Data Repository (MIT License)',
}, null, 2));
