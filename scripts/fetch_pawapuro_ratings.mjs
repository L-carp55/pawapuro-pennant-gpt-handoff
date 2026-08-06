// パワプロ2024-2025 の実在選手の能力値を取得する（正解ラベル）。
//
// なぜ要るか（2026-08-01 オーナー指示）:
//   CCが「この統計は脚力を測るはず」と**推論で材料を選んでいた**のが走力・肩力のズレの原因。
//   正解ラベルが数十人分あれば、どの統計が効くかを推測でなく実測で決められる。
//   オーナー指示「パワプロの値はあなたが調べて取得して」。
//
// 出典: Game8 のパワプロ2024-2025 攻略ページ（球団別12ページ）。
//   「走力：B(71)」のようにランクと数値の両方をテキストで持っている珍しいサイト。
//   ファミ通・パワプロ選手名鑑は画像掲載のため機械では読めなかった。
//
// 規模: 12ページのみ。直列・1.5秒待機・取得済みスキップ。

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'pawapuro');
const UA = 'Mozilla/5.0 (compatible; pawapuro-pennant-appraisal/0.1; personal, non-commercial)';
const DELAY_MS = 1500;

const TEAMS = [
  { id: 623538, team: '読売ジャイアンツ' },
  { id: 623540, team: '阪神タイガース' },
  { id: 623539, team: '横浜DeNAベイスターズ' },
  { id: 623541, team: '中日ドラゴンズ' },
  { id: 623542, team: '東京ヤクルトスワローズ' },
  { id: 623543, team: '広島東洋カープ' },
  { id: 623535, team: '福岡ソフトバンクホークス' },
  { id: 623532, team: 'オリックス・バファローズ' },
  { id: 623533, team: '千葉ロッテマリーンズ' },
  { id: 623534, team: '東北楽天ゴールデンイーグルス' },
  { id: 623531, team: '北海道日本ハムファイターズ' },
  { id: 623537, team: '埼玉西武ライオンズ' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
await mkdir(RAW, { recursive: true });

let fetched = 0, cached = 0;
const failed = [];

for (const t of TEAMS) {
  const out = path.join(RAW, `${t.id}.htm.gz`);
  if (existsSync(out)) { cached++; continue; }
  try {
    const res = await fetch(`https://game8.jp/pawapuro2024-2025/${t.id}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // 能力値の表記があるページだけ保存する（0で埋めない）
    if (!/[弾ミパ走肩守捕]/.test(html) || html.length < 20000) throw new Error('能力表が見当たらない');
    await writeFile(out, gzipSync(Buffer.from(html, 'utf8')));
    fetched++;
    console.error(`  ${t.team}: ${(html.length / 1024).toFixed(0)}KB`);
  } catch (e) { failed.push(`${t.team}: ${e.message}`); }
  await sleep(DELAY_MS);
}

await writeFile(path.join(RAW, '_teams.json'), JSON.stringify(TEAMS, null, 1), 'utf8');
console.log(JSON.stringify({ fetched, cached, failed: failed.length, errors: failed }, null, 2));
