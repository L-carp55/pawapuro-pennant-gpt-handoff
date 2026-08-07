// Nippon Baseball Data Repository の GitHub Release `pbp` から
// 指定年の月別 *_pbp.csv を作業ディレクトリへ取得する。
// rawデータ自体はrepositoryへcommitしない。
//
// Usage:
//   node scripts/fetch_npb_pbp_release.mjs 2024 /tmp/npb_pbp

import { mkdir, writeFile } from 'node:fs/promises';
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
const metaRes = await fetch(RELEASE_API, { headers });
if (!metaRes.ok) throw new Error(`PBP release API HTTP ${metaRes.status}`);
const release = await metaRes.json();
const re = new RegExp(`^${year}-(\\d{2})_pbp\\.csv$`);
const assets = (release.assets ?? [])
  .filter(a => re.test(a.name))
  .sort((a, b) => a.name.localeCompare(b.name));
if (!assets.length) throw new Error(`no PBP release assets found for ${year}`);

await mkdir(outDir, { recursive: true });
let total = 0;
for (const a of assets) {
  const res = await fetch(a.browser_download_url, { headers });
  if (!res.ok || !res.body) throw new Error(`${a.name}: HTTP ${res.status}`);
  const dst = path.join(outDir, a.name);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dst));
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
