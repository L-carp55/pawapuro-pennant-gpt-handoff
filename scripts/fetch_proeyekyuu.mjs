// プロEYE球CSVの取得（出典: proeyekyuu / https://proeyekyuu.com/ja/csvs-jp/）
// 利用条件: 自由利用可・出典表記歓迎（サイト記載）
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'data', 'raw');

const CATEGORIES = [
  { key: 'batting',  dir: 'PlayerSLBattingJP',  file: 'player_batting_stats_jp'  },
  { key: 'pitching', dir: 'PlayerSLPitchingJP', file: 'player_pitching_stats_jp' },
  { key: 'fielding', dir: 'PlayerSLFieldingJP', file: 'player_fielding_stats_jp' },
];

const BASE = 'https://proeyekyuu.com/wp-content/CsvExports';

const years = process.argv[2] && process.argv[3]
  ? Array.from({ length: Number(process.argv[3]) - Number(process.argv[2]) + 1 }, (_, i) => Number(process.argv[2]) + i)
  : Array.from({ length: 10 }, (_, i) => 2016 + i);

// 文字コード判定: UTF-8 BOM / 妥当なUTF-8バイト列か / それ以外はShift_JIS扱い
function decode(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(buf.subarray(3)), encoding: 'utf-8-bom' };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return { text, encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('shift_jis').decode(buf), encoding: 'shift_jis' };
  }
}

async function fetchOne(cat, year) {
  const url = `${BASE}/${cat.dir}/${cat.file}_${year}.csv`;
  const dest = path.join(RAW, `${cat.key}_${year}.csv`);
  if (existsSync(dest)) {
    const buf = await readFile(dest);
    return { cat: cat.key, year, status: 'cached', bytes: buf.length };
  }
  const res = await fetch(url);
  if (!res.ok) return { cat: cat.key, year, status: `HTTP ${res.status}`, bytes: 0 };
  const buf = Buffer.from(await res.arrayBuffer());
  const { text, encoding } = decode(buf);
  await writeFile(dest, text, 'utf8'); // 保存は常にUTF-8へ正規化
  const lines = text.trim().split(/\r?\n/).length;
  return { cat: cat.key, year, status: 'ok', bytes: buf.length, encoding, lines, url };
}

await mkdir(RAW, { recursive: true });

const jobs = [];
for (const cat of CATEGORIES) for (const y of years) jobs.push(fetchOne(cat, y));

const results = [];
// 同時4本まで（相手サイトへの負荷を抑える）
for (let i = 0; i < jobs.length; i += 4) {
  results.push(...await Promise.all(jobs.slice(i, i + 4)));
}

const failed = results.filter(r => r.status !== 'ok' && r.status !== 'cached');
const encodings = [...new Set(results.filter(r => r.encoding).map(r => r.encoding))];
console.log(JSON.stringify({
  requested: jobs.length,
  ok: results.filter(r => r.status === 'ok').length,
  cached: results.filter(r => r.status === 'cached').length,
  failed: failed.length,
  encodings,
  totalLines: results.reduce((a, r) => a + (r.lines || 0), 0),
  failures: failed,
}, null, 2));
