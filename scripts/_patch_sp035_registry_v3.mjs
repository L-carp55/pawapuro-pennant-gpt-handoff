import { readFileSync, writeFileSync } from 'node:fs';
const p = 'docs/state/speed_task_registry.tsv';
const raw = readFileSync(p, 'utf8');
const lines = raw.replace(/\r\n/g, '\n').split('\n');
const head = lines[0].split('\t');
const i = lines.findIndex(l => l.startsWith('SP-035\t'));
if (i < 0) throw new Error('SP-035 missing');
const cells = lines[i].split('\t');
if (cells.length !== head.length) throw new Error('width');
const col = n => head.indexOf(n);
cells[col('next_action_or_blocker')] = '2026-08-15 X v3再収集済み。current-100は実リスト100人を検索（hard-code nullではない）。公式=@pawapuro_pro / @prospiA_PR。raw 483 / rating方向188 / 選手hit 79。返信全件ページングはNOT_COLLECTED。提案status=PARTIAL。YouTubeレーンは別担当。';
const extra = [
  'outputs/derived/speed_community_v3_x_official_post_inventory_20260815.jsonl',
  'outputs/derived/speed_community_v3_x_raw_20260815.jsonl',
  'outputs/derived/speed_community_v3_x_classified_20260815.jsonl',
  'outputs/derived/speed_community_v3_x_player_summary_20260815.csv',
  'outputs/derived/speed_community_v3_x_query_coverage_20260815.csv',
  'outputs/derived/speed_community_v3_x_qa_20260815.json',
  'docs/audits/speed_community_v3_x_recollection_20260815.md',
].join(';');
const arts = col('artifacts');
if (!cells[arts].includes('speed_community_v3_x_raw_20260815')) cells[arts] = cells[arts] + ';' + extra;
lines[i] = cells.join('\t');
writeFileSync(p, lines.join('\n'));
console.log('SP-035 patched');
