// NPB Basement の最新バンドルの列名だけを確認する（取得はしない・保存もしない）。
// 2026-08-05: 1.02本家が2026-07-27にTE(送球失策)・スクープ送球・DPS/DPTを追加したという情報を受け、
// Basement側（1.02由来のデータを配信）にその列が来ているかを確かめるために作った。
const home = await fetch('https://npbbasement.com/').then(r => r.text());
const idxName = [...new Set([...home.matchAll(/assets\/(index-[A-Za-z0-9_-]+\.js)/g)].map(m => m[1]))][0];
console.log('index:', idxName);

const idx = await fetch('https://npbbasement.com/assets/' + idxName).then(r => r.text());
const names = [...new Set([...idx.matchAll(/[\w./-]*?((?:20\d\d)_\dg-[A-Za-z0-9_-]{6,})\.js/g)].map(m => m[1]))].sort();
const target = names.filter(n => n.startsWith(process.argv[2] ?? '2026_1g'));
console.log('対象バンドル:', target.join(', '));
if (!target.length) process.exit(1);

const text = await fetch('https://npbbasement.com/assets/' + target[0] + '.js').then(r => r.text());
const m = text.match(/JSON\.parse\(`([\s\S]*?)`\)/);
if (!m) { console.error('JSONの取り出しに失敗'); process.exit(1); }
const json = m[1].replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
const data = JSON.parse(json);
console.log('選手数:', data.length);

const first = (key) => {
  const p = data.find(x => {
    const v = x.Stats?.[key];
    return v && (Array.isArray(v) ? v.length : Object.keys(v).length);
  });
  const v = p?.Stats?.[key];
  return Array.isArray(v) ? v[0] : v;
};
for (const key of ['bat', 'fld', 'pit', 'war']) {
  const row = first(key);
  console.log(`  ${key}:`, row ? Object.keys(row).join(', ') : '（なし）');
}

// 探している列が来ているか名指しで確認する
const fld = first('fld') ?? {};
const want = ['TE', 'FE', 'Scp', 'ScpPct', 'DPS', 'DPT', 'DPF', 'rSB', 'A', 'PO', 'E'];
const found = want.filter(w => Object.keys(fld).some(k => k.toLowerCase() === w.toLowerCase()));
console.log('\n探している送球系の列:', found.length ? found.join(', ') : 'ひとつも無し');
