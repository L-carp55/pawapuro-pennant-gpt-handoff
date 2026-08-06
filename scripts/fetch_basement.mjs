// NPB Basement のデータバンドルを取得してJSONへ変換する。
// 出典: NPB Basement (https://npbbasement.com/) — ぼーの(Data & Analytics) / せあぶら(Development & Design)
// サイトが各ページで CSV ダウンロードを公式提供しているデータと同一内容。
// バンドルは年度×軍で13ファイルのみ（打撃・守備・投手・球種価値を内包）。
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw', 'basement');
const BASE = 'https://npbbasement.com/assets/';

await mkdir(RAW, { recursive: true });

// 0) index のファイル名はビルドごとにハッシュが変わる（2026-08-05 に CExxCcwY → CIm4idW- で失敗）。
//    トップページのHTMLから毎回引き直す。取れなければ最後に確認できた名前へ落とす。
const FALLBACK_INDEX = 'index-CIm4idW-.js';
let indexName = FALLBACK_INDEX;
try {
  const home = await fetch('https://npbbasement.com/').then(r => r.text());
  const found = [...new Set([...home.matchAll(/assets\/(index-[A-Za-z0-9_-]+\.js)/g)].map(m => m[1]))];
  if (found.length) indexName = found[0];
  console.error(`index: ${indexName}${found.length ? '' : '（HTMLから取れず既定値）'}`);
} catch (e) {
  console.error(`indexの取得に失敗（${e.message}）。既定値 ${FALLBACK_INDEX} を使う`);
}
const INDEX_URL = BASE + indexName;

// 1) index バンドルから、年度×軍のデータファイル名（ハッシュ付き）を拾う
const idxRes = await fetch(INDEX_URL);
if (!idxRes.ok) throw new Error(`index fetch failed: ${idxRes.status}`);
const idxText = await idxRes.text();
const names = [...new Set(
  [...idxText.matchAll(/[\w./-]*?((?:20\d\d)_\dg-[A-Za-z0-9_-]{6,})\.js/g)].map(m => m[1])
)].sort();

if (!names.length) throw new Error('データバンドル名が見つからない。index のハッシュが変わった可能性');
console.log(`対象 ${names.length} ファイル: ${names.join(', ')}\n`);

// 2) 各バンドルを取得し、埋め込まれたJSONを取り出して保存
const results = [];
for (const name of names) {
  const [season, farmTag] = name.split('-')[0].split('_');
  const outPath = path.join(RAW, `${season}_${farmTag}.json`);
  if (existsSync(outPath)) {
    const buf = await readFile(outPath, 'utf8');
    results.push({ name, status: 'cached', players: JSON.parse(buf).length });
    continue;
  }

  const res = await fetch(BASE + name + '.js');
  if (!res.ok) { results.push({ name, status: `HTTP ${res.status}` }); continue; }
  const text = await res.text();

  // var e=JSON.parse(`[...]`) の形。バッククォート内を取り出す
  const m = text.match(/JSON\.parse\(`([\s\S]*?)`\)/);
  if (!m) { results.push({ name, status: 'JSONの取り出しに失敗' }); continue; }
  // JS文字列リテラル内のエスケープを戻す
  const json = m[1].replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
  let data;
  try { data = JSON.parse(json); }
  catch (e) { results.push({ name, status: 'JSON parse失敗: ' + e.message }); continue; }

  await writeFile(outPath, JSON.stringify(data), 'utf8');
  results.push({ name, status: 'ok', players: data.length, bytes: text.length });
  await new Promise(r => setTimeout(r, 400)); // 相手サーバへの配慮
}

console.log(JSON.stringify({
  ok: results.filter(r => r.status === 'ok').length,
  cached: results.filter(r => r.status === 'cached').length,
  failed: results.filter(r => !['ok', 'cached'].includes(r.status)),
  totalPlayerRows: results.reduce((a, r) => a + (r.players || 0), 0),
  detail: results,
}, null, 2));
