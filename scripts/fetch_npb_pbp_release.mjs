// Nippon Baseball Data Repository の GitHub Release `pbp` から
// 指定年の月別 *_pbp.csv を作業ディレクトリへ取得する。
// rawデータ自体はrepositoryへcommitしない。
//
// Usage:
//   node scripts/fetch_npb_pbp_release.mjs 2024 /tmp/npb_pbp
//
// GitHub Release assetは大きいため、UND_ERR_SOCKET / 429 / 5xx の一時障害で
// 数年分の監査全体が落ちないよう指数バックオフで再試行する。
// 部分ダウンロードを完成ファイル扱いしないよう .part へ書いてからrenameする。

import { mkdir, writeFile, rm, rename } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createWriteStream } from 'node:fs';

const year = Number(process.argv[2]);
const outDir = path.resolve(process.argv[3] ?? './data/raw/npb_pbp');
if (!Number.isInteger(year) || year < 2000 || year > 2100) {
  throw new Error(`invalid year: ${process.argv[2]}`);
}

const RELEASE_API = 'https://api.github.com/repos/armstjc/Nippon-Baseball-Data-Repository/releases/tags/pbp';
const headers = {
  'user-agent': 'pawapuro-pennant-gpt-handoff research audit',
  'accept': 'application/vnd.github+json',
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const retryableStatus = status => status === 408 || status === 429 || status >= 500;

async function fetchWithRetry(url, { label, attempts = 5 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res;
      const err = new Error(`${label ?? url}: HTTP ${res.status}`);
      if (!retryableStatus(res.status) || attempt === attempts) throw err;
      lastError = err;
      // consume/cancel response before retry when possible
      try { await res.body?.cancel(); } catch {}
    } catch (e) {
      lastError = e;
      if (attempt === attempts) break;
    }
    const delay = 500 * 2 ** (attempt - 1);
    console.error(`retry ${label ?? url}: attempt ${attempt + 1}/${attempts} after ${delay}ms (${lastError?.message ?? lastError})`);
    await sleep(delay);
  }
  throw lastError ?? new Error(`${label ?? url}: fetch failed`);
}

const metaRes = await fetchWithRetry(RELEASE_API, { label: 'PBP release API' });
const release = await metaRes.json();
const re = new RegExp(`^${year}-(\\d{2})_pbp\\.csv$`);
const assets = (release.assets ?? [])
  .filter(a => re.test(a.name))
  .sort((a, b) => a.name.localeCompare(b.name));
if (!assets.length) throw new Error(`no PBP release assets found for ${year}`);

await mkdir(outDir, { recursive: true });
let total = 0;
for (const a of assets) {
  const dst = path.join(outDir, a.name);
  const tmp = `${dst}.part`;
  let completed = false;
  let lastError = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    await rm(tmp, { force: true });
    try {
      const res = await fetchWithRetry(a.browser_download_url, { label: a.name, attempts: 1 });
      if (!res.body) throw new Error(`${a.name}: response body missing`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
      await rename(tmp, dst);
      completed = true;
      break;
    } catch (e) {
      lastError = e;
      await rm(tmp, { force: true });
      if (attempt === 5) break;
      const delay = 500 * 2 ** (attempt - 1);
      console.error(`retry asset ${a.name}: attempt ${attempt + 1}/5 after ${delay}ms (${e?.message ?? e})`);
      await sleep(delay);
    }
  }
  if (!completed) throw lastError ?? new Error(`${a.name}: download failed`);
  total += Number(a.size) || 0;
  console.log(`downloaded ${a.name} (${(a.size / 1024 / 1024).toFixed(1)} MiB)`);
}

const provenance = {
  source: 'Nippon Baseball Data Repository',
  repository: 'armstjc/Nippon-Baseball-Data-Repository',
  release_tag: 'pbp',
  release_id: release.id,
  release_updated_at: release.updated_at,
  year,
  assets: assets.map(a => ({ name: a.name, size: a.size, digest: a.digest ?? null })),
  attribution: 'This uses data sourced from the Nippon Baseball Data Repository.',
};
await writeFile(path.join(outDir, `_provenance_${year}.json`), JSON.stringify(provenance, null, 2) + '\n');
console.log(`assets=${assets.length} total≈${(total / 1024 / 1024).toFixed(1)} MiB out=${outDir}`);
