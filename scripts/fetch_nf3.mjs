// NF3（プロ野球 ヌルデータ置き場f3, https://nf3.sakura.ne.jp/）から選手個別ページを取得する。
//
// 目的（Sol仕様の未充足項目に直結）:
//   02 §5.1  ミート基準統計を AVG_vsR_nonRISP へ（Tier A化）  ← 対左右別成績 ＋ ランナー別成績
//   02 §8.3  限定起用・左右併用の対戦相手バイアス            ← 対左右別成績
//   02 §9    疲労補正（PAUSED解除の実証）                     ← 月別成績
//   05 §3    チャンス＝RISP−nonRISP（RBIを直接使わない）      ← ランナー別成績
//   05 §4    対左＝vsL−vsR                                    ← 対左右別成績
//   02 §6.4  球場係数                                          ← 球場別成績
//
// 出典・規約: えるてん(@nf3_Info) 個人運営。免責事項のみで転載禁止の記載なし・robots.txtなし。
// オーナー承認: 2026-08-01（規模と速度を明示して取得許可）。
//
// 相手サーバへの配慮:
//   - 直列（同時接続1本）・1リクエストあたり1.1秒の待機
//   - 取得済みはスキップ（再実行しても再取得しない）
//   - 保存はgzip（1ページ約100KB→約15KB）
//
// 使い方: node scripts/fetch_nf3.mjs [年,年,...] （既定 2023,2024,2025）

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'nf3');
const BASE = 'https://nf3.sakura.ne.jp/';
const DELAY_MS = 1100;
const UA = 'pawapuro-pennant-appraisal/0.1 (personal, non-commercial; low-rate 1req/1.1s)';

const YEARS = (process.argv[2] || '2023,2024,2025').split(',').map(s => s.trim());
const TEAMS = [
  ['Central', 0, ['T', 'DB', 'G', 'D', 'C', 'S']],
  ['Pacific', 1, ['H', 'F', 'B', 'E', 'L', 'M']],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** 球団×年の打者一覧ページから、選手個別ページの相対パスと名前を拾う */
async function roster(year, leg, team) {
  const y = year === 'current' ? 0 : year;
  const url = `${BASE}php/stat_disp/stat_disp.php?y=${y}&leg=${leg}&tm=${team}&fp=0&dn=1&dk=0`;
  const html = await get(url);
  const out = new Map();
  const re = /href=['"]\.\/((?:Central|Pacific)\/[A-Z]{1,2}\/f\/\d+_stat\.htm)['"][^>]*>([^<]+)</g;
  for (const m of html.matchAll(re)) out.set(m[1], m[2].trim());
  return out;
}

const log = [];
let fetched = 0, cached = 0, failed = 0;
const t0 = Date.now();

for (const year of YEARS) {
  const yearDir = path.join(RAW, String(year));
  await mkdir(yearDir, { recursive: true });

  // 1) 12球団の打者名簿（12ページ）
  const players = new Map();
  for (const [, leg, teams] of TEAMS) {
    for (const tm of teams) {
      try {
        const r = await roster(year, leg, tm);
        for (const [rel, name] of r) players.set(rel, name);
      } catch (e) {
        failed++; log.push({ year, team: tm, error: String(e.message) });
      }
      await sleep(DELAY_MS);
    }
  }
  console.error(`${year}: 打者 ${players.size}人`);

  // 2) 選手個別ページ
  const index = [];
  for (const [rel, name] of players) {
    const out = path.join(yearDir, rel.replace(/\//g, '_') + '.gz');
    index.push({ rel, name, file: path.basename(out) });
    if (existsSync(out)) { cached++; continue; }
    const url = year === 'current' ? BASE + rel : `${BASE}${year}/${rel}`;
    try {
      const html = await get(url);
      await writeFile(out, gzipSync(Buffer.from(html, 'utf8')));
      fetched++;
    } catch (e) {
      failed++; log.push({ year, rel, name, error: String(e.message) });
    }
    if (fetched % 100 === 0 && fetched) {
      console.error(`  ...${fetched}件取得 (${Math.round((Date.now() - t0) / 1000)}秒)`);
    }
    await sleep(DELAY_MS);
  }
  await writeFile(path.join(yearDir, '_index.json'), JSON.stringify(index, null, 1), 'utf8');
}

const summary = {
  years: YEARS, fetched, cached, failed,
  elapsed_sec: Math.round((Date.now() - t0) / 1000),
  errors: log.slice(0, 30),
};
await writeFile(path.join(RAW, '_fetch_summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(JSON.stringify(summary, null, 2));
