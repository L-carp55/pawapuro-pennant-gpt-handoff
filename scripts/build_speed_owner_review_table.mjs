// 走力オーナーレビュー表を作る。
//
// 何のためか（2026-08-12 オーナー指摘）:
//   「貴方の査定した走力とその根拠、パワプロの査定した能力と過去の査定の推移、
//     差が大きいものはどうしてそのような差が生まれたかの根拠も考えたうえでテーブルに
//     まとめてから、差が大きいものとあなたの査定信頼度が低いものについて私がレビューする」
//
// つまりオーナーが見るのは全100人ではなく、
//   (a) パワプロとの差が大きい選手  (b) こちらの査定信頼度が低い選手
//   の和集合だけ。それ以外は説明責任だけ果たして通す。
//
// 入力:
//   - GPT/Codex側の成果物（差分handoff経由。branch: agent/claude-speed-redteam-20260812）
//       speed_2026_powerpro_discrepancy_register.json  … 100人・パワプロ2026値・残差
//       speed_2026_100_master_evidence.csv             … NPB+速度・出場・物理証拠の有無
//       pawapuro_speed_history_player_summary_2015_2026.csv … パワプロ査定の推移（stale検出用）
//   - 自作の査定パイプライン（src/cards/pipeline.mjs、2021-2025を5年プール）
//
// 出力:
//   outputs/speed_owner_review_table_2026.md   … オーナーが読む表
//   outputs/derived/speed_owner_review_table_2026.csv … 全100人・機械可読
//
// 使い方: node scripts/build_speed_owner_review_table.mjs <GPT成果物のディレクトリ>

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
// ★relative model候補（正本22 §5-C）。--stat-primary を渡すと
//   走力のNPB+自動blendを行わず、較正済み統計モデルをprimaryにする。既定=production同等。
const STAT_PRIMARY = process.argv.includes('--stat-primary');
if (!SRC || !existsSync(SRC)) { console.error('GPT成果物のディレクトリを渡す'); process.exit(1); }

const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

function parseCSV(t) {
  const rows = []; let f = [], c = '', q = false;
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
    else { if (ch === '"') q = true; else if (ch === ',') { f.push(c); c = ''; }
      else if (ch === '\n') { f.push(c); rows.push(f); f = []; c = ''; } else if (ch !== '\r') c += ch; } }
  if (c || f.length) { f.push(c); rows.push(f); }
  return rows;
}
const toObjs = (txt) => { const r = parseCSV(txt); const H = r[0];
  return r.slice(1).filter(x => x.length > 3).map(x => Object.fromEntries(H.map((h, i) => [h, x[i]]))); };

// ── 入力 ───────────────────────────────────────────────────────────
const reg = JSON.parse(readFileSync(path.join(SRC, 'speed_2026_powerpro_discrepancy_register.json'), 'utf8'));
const master = toObjs(readFileSync(path.join(SRC, 'speed_2026_100_master_evidence.csv'), 'utf8'));
const ppHist = toObjs(readFileSync(path.join(SRC, 'pawapuro_speed_history_player_summary_2015_2026.csv'), 'utf8'));

const masterBy = new Map(master.map(r => [norm(r.player), r]));
const histBy = new Map();
for (const h of ppHist) {
  for (const k of [norm(h.player), norm(h.player_name)]) if (k && !histBy.has(k)) histBy.set(k, h);
}

// ── 自作DBの名寄せ（外国人は「Ｏ．カリステ」形式） ────────────────────
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const dbNames = db.prepare(
  'SELECT DISTINCT name FROM v_batting WHERE season BETWEEN 2021 AND 2025').all().map(r => r.name);
const dbByNorm = new Map(dbNames.map(n => [norm(n), n]));
function resolveDbName(p) {
  const k = norm(p);
  if (dbByNorm.has(k)) return dbByNorm.get(k);
  // 「Ｏ．カリステ」のように姓の前に頭文字が付く形
  const hit = dbNames.filter(n => norm(n).endsWith(k) || norm(n).includes(k));
  return hit.length === 1 ? hit[0] : null;
}

const ctx = makeContext(db, cfg);
const num = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };

// ── 1人分を組み立てる ──────────────────────────────────────────────
const rows = [];
for (const r of reg.rows) {
  const m = masterBy.get(norm(r.player)) ?? {};
  const h = histBy.get(norm(r.player)) ?? null;
  const dbName = resolveDbName(r.player);

  // 自作査定（2021-2025を5年プール）
  let mine = null, mineStat = null, npbUsed = null, years = null, seasons = null, err = null;
  if (dbName) {
    try {
      const card = appraiseCard(ctx, { name: dbName, mode: '2025', cfg, rv, runNorm, fldNorm, statPrimarySpeed: STAT_PRIMARY }).card;
      const B = card?.abilities?.基礎能力?.走力, R = card?.calc_log?.running;
      mine = B?.value ?? null;
      mineStat = B?.statistical_value ?? B?.value ?? null;   // 実測を混ぜる前の統計値
      npbUsed = B?.measured ?? null;
      years = R?.speed_years ?? null;
      seasons = R?.speed_seasons ?? null;
    } catch (e) { err = e.message; }
  } else err = 'DB名寄せ不可';

  const pp = num(r.powerpro_2026_speed);
  const diff = (mine != null && pp != null) ? mine - pp : null;

  // パワプロ側の実測値から換算した走力（統計値と比べて材料の食い違いを見る）
  const npbDerived = (npbUsed != null && cfg.npb_plus_direct?.models?.top_speed_kmh)
    ? cfg.npb_plus_direct.models.top_speed_kmh.intercept
      + cfg.npb_plus_direct.models.top_speed_kmh.slope * npbUsed : null;
  const materialGap = (mineStat != null && npbDerived != null) ? Math.abs(mineStat - npbDerived) : null;

  const games = num(m.games), pa = num(m.PA);
  const ppUnchanged = h ? num(h.longest_unchanged_days) : null;
  const ppChanges = h ? num(h.num_changes) : null;
  const ppFirst = h ? num(h.first_speed) : null;
  const ppLast = h ? num(h.last_speed) : null;
  const ppTotal = h ? num(h.total_change) : null;
  const ppObs = h ? num(h.num_observations) : null;

  // ── 信頼度（自作査定側）──────────────────────────────────────
  // 低くなる条件を数え上げる。閾値は恣意的に置かず、根拠を各項目に書く。
  const lowFlags = [];
  if (years != null && years <= 1) lowFlags.push('プール1年のみ');
  if (games != null && games < 40) lowFlags.push(`出場${games}試合と少ない`);
  if (materialGap != null && materialGap >= 20) lowFlags.push(`統計値とNPB+実測が${materialGap.toFixed(0)}点食い違う`);
  if (mine == null) lowFlags.push('査定不能');
  const midFlags = [];
  if (years != null && years >= 2 && years <= 2) midFlags.push('プール2年');
  if (games != null && games >= 40 && games < 80) midFlags.push(`出場${games}試合`);
  if (materialGap != null && materialGap >= 10 && materialGap < 20) midFlags.push(`統計値とNPB+が${materialGap.toFixed(0)}点差`);
  const confidence = lowFlags.length ? '低' : (midFlags.length ? '中' : '高');

  // ── パワプロ側の据え置き疑い ─────────────────────────────────
  const staleFlags = [];
  if (ppUnchanged != null && ppUnchanged >= 1095) staleFlags.push(`${Math.round(ppUnchanged / 365)}年以上据え置き`);
  if (ppChanges != null && ppChanges === 0 && ppObs != null && ppObs >= 5) staleFlags.push('一度も変更なし');

  rows.push({
    player: r.player, team: r.team,
    mine, mineStat, npbUsed, npbDerived, materialGap,
    pp, diff, years, seasons, games, pa,
    ppFirst, ppLast, ppTotal, ppChanges, ppUnchanged, ppObs,
    confidence, lowFlags, midFlags, staleFlags,
    directT90: num(m.direct_t90_current_count) ?? 0,
    shortDist: num(m.standardized_short_distance_count) ?? 0,
    err,
  });
}
db.close();

// ── AI側の診断結果を取り込む（scripts/diagnose_speed_conflicts.mjs の出力）──
// 2026-08-13 GPT指示: オーナーへ渡す前にAI側で原因を4種へ分離し、材料衝突を調査する。
const diagPath = path.join(ROOT, 'outputs', 'derived', 'speed_conflict_diagnosis_2026.csv');
const diagBy = new Map();
if (existsSync(diagPath)) {
  for (const d of toObjs(readFileSync(diagPath, 'utf8'))) diagBy.set(norm(d.player), d);
} else {
  console.warn('★診断CSVが無い。先に node scripts/diagnose_speed_conflicts.mjs を実行すること');
}
for (const r of rows) {
  const d = diagBy.get(norm(r.player));
  r.causes = d?.causes ? d.causes.split('|').filter(Boolean) : [];
  r.stale = d?.stale ?? '';
  r.conflictVerdict = d?.conflictVerdict ?? '';
  r.conflictResid = d ? num(d.conflictResid) : null;
  r.scalePart = d ? num(d.scalePart) : null;
}

// ── 目盛りのずれと、選手個別の差を分ける（診断専用）────────────────
//
// ★名称について（2026-08-13 GPT指示）:
//   この値は「本当の食い違い」ではない。PowerProの標準偏差へ合わせて計算した
//   **診断専用値** であり、PowerProの幅を正解として採用したことにはしない。
//   raw_diff（自作査定 − PowerPro）は必ず併記する。
//
//   実測: 順序の一致は相関0.83と良いのに、こちらの幅がPowerProの1/1.67しかない。
//   幅が違うだけで、上位の選手は低く・下位の選手は高く出て「差」になる。
//   raw |diff|>=5 が82人なのは「レビュー対象が82人」という意味ではなく、
//   **まず自作査定の全体スケール問題をAI側で解決する必要がある**という診断。
//   原因の詳細は outputs/speed_scale_diagnosis_2026.md。
const paired = rows.filter(r => r.mine != null && r.pp != null);
const stat = a => { const N = a.length, mu = a.reduce((x, y) => x + y, 0) / N;
  return { N, mu, sd: Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / N) }; };
const SM = stat(paired.map(r => r.mine)), SP = stat(paired.map(r => r.pp));
const corr = (() => { const x = paired.map(r => r.mine), y = paired.map(r => r.pp);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - SM.mu) * (y[i] - SP.mu); sxx += (x[i] - SM.mu) ** 2; syy += (y[i] - SP.mu) ** 2; }
  return sxy / Math.sqrt(sxx * syy); })();

for (const r of rows) {
  r.adj = (r.mine != null && r.pp != null)
    ? ((r.mine - SM.mu) / SM.sd) * SP.sd + SP.mu - r.pp : null;
  const A = r.adj == null ? null : Math.abs(r.adj);

  // ── 差の理由（データから決まるものだけ。憶測は書かない）──
  const reasons = [];
  if (A != null && A >= 8) {
    if (r.materialGap != null && r.materialGap >= 15)
      reasons.push(`こちらの材料が割れている（プレー結果由来${r.mineStat.toFixed(1)} vs NPB+実測由来${r.npbDerived.toFixed(1)}）`);
    if (r.staleFlags.length) reasons.push(`パワプロ側が${r.staleFlags.join('・')}`);
    if (r.years != null && r.years <= 1) reasons.push('こちらは1年分しか材料が無い');
    if (r.games != null && r.games < 40)
      reasons.push(`2026年の出場が${r.games}試合と少なく最高速度を観測しきれていない可能性`);
    if (r.directT90 > 0) reasons.push('直接計測(T90)あり＝物理的な裏付けはこちらにある');
    if (!reasons.length) reasons.push('原因未特定（材料・出場・パワプロ推移のいずれにも異常が見当たらない）');
  }
  r.reasons = reasons;

  // ── レビューの段 ──────────────────────────────────────────
  //   1段目: 本当に食い違いが大きい / 食い違い中程度かつこちらの信頼度が低い
  //   2段目: それ以外で食い違いか信頼度に引っかかるもの
  if (r.mine == null) r.tier = 1;
  else if (A >= 12 || (A >= 8 && r.confidence === '低')) r.tier = 1;
  else if (A >= 8 || r.confidence === '低') r.tier = 2;
  else r.tier = 3;
  r.needReview = r.tier <= 2;
}

// ── 出力 ───────────────────────────────────────────────────────────
const f1 = v => v == null ? '-' : (typeof v === 'number' ? v.toFixed(1) : v);
const sg = v => v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(1);
rows.sort((a, b) => (a.tier - b.tier) || (Math.abs(b.adj ?? 0) - Math.abs(a.adj ?? 0)));

const t1 = rows.filter(r => r.tier === 1);
const t2 = rows.filter(r => r.tier === 2);
const t3 = rows.filter(r => r.tier === 3);

const L = [];
const push = s => L.push(s);
push('# 走力 100人マスター表 — 2026年\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('状態: **AI側の診断中。オーナーレビューはまだ開始しない**（2026-08-13 GPT指示）\n');

push('## 全体診断\n');
push('```text');
push(`順序の一致（相関）  : ${corr.toFixed(3)}   ← 良い。誰が速いかの並びはほぼ合っている`);
push(`中心のずれ          : ${(SM.mu - SP.mu).toFixed(1)}点`);
push(`幅（ばらつき）の比  : ${(SP.sd / SM.sd).toFixed(2)}倍   ← ★自作査定の幅が狭い`);
push(`  自作 ${SM.sd.toFixed(1)} / PowerPro ${SP.sd.toFixed(1)}`);
push('```\n');
push('**raw |diff| >= 5 が82人なのは、レビュー対象が82人という意味ではない。**');
push('まず自作査定の全体スケール問題をAI側で解決する必要があるという診断である。');
push('原因は `outputs/speed_scale_diagnosis_2026.md` に分解した（要点: 合成zは必ず縮み、');
push('その縮みを戻す較正が98人中1人にしか掛かっていない）。\n');

push('## 列の意味\n');
push('| 列 | 意味 |');
push('|---|---|');
push('| `raw_diff` | 自作査定 − PowerPro。**これが実際の差** |');
push('| `scale_adj_diagnostic` | `scale_adjusted_powerpro_residual_diagnostic`。PowerProの標準偏差へ合わせて計算した**診断専用値**。**PowerProの幅を正解として採用したものではない** |');
push('| 内訳 | プレー結果由来 / NPB+実測由来。系統的に後者が+14.4点高い |');
push('| 原因 | MODEL_SCALE / PROJECT_EVIDENCE_CONFLICT / POWERPRO_STALE_OR_ODD / CURRENT_EVIDENCE_WEAK（複数可） |');
push('| stale | POWERPRO_STALE_SUPPORTED / POSSIBLE / NO_STALE_EVIDENCE。据え置き年数だけで断定せず、各作品で観測が続いているかを見て判定 |\n');
push(`**1段目: ${t1.length}人** / 2段目: ${t2.length}人 / それ以外: ${t3.length}人\n`);
push('---\n');

const table = (list) => {
  push('| 選手 | 自作 | 内訳(プレー結果/NPB+) | PowerPro | raw_diff | scale_adj_diagnostic | 信頼度 | 原因 | stale | PowerProの推移 |');
  push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of list) {
    const trend = r.ppFirst != null
      ? `${f1(r.ppFirst)}→${f1(r.ppLast)}（${r.ppChanges ?? '-'}回変更${r.ppUnchanged != null ? `・最長${(r.ppUnchanged / 365).toFixed(1)}年据置` : ''}）`
      : '履歴なし';
    const conf = r.confidence + (r.lowFlags.length ? `（${r.lowFlags.join('・')}）`
      : r.midFlags.length ? `（${r.midFlags.join('・')}）` : '');
    push(`| ${r.player} | ${f1(r.mine)} | ${f1(r.mineStat)} / ${f1(r.npbDerived)} | ${f1(r.pp)} | ${sg(r.diff)} | ${sg(r.adj)} | ${conf} | ${r.causes.join('+') || '-'} | ${r.stale || '-'} | ${trend} |`);
  }
  push('');
};

push('## 1段目\n');
table(t1);
push('## 2段目\n');
table(t2);
push('## それ以外\n');
push('| 選手 | 自作 | PowerPro | raw_diff | scale_adj_diagnostic | 信頼度 | 原因 |');
push('|---|---|---|---|---|---|---|');
for (const r of t3) push(`| ${r.player} | ${f1(r.mine)} | ${f1(r.pp)} | ${sg(r.diff)} | ${sg(r.adj)} | ${r.confidence} | ${r.causes.join('+') || '-'} |`);
push('');

// ── オーナーレビュー待ち行列（まだ送らない）──────────────────────
// 条件（GPT指示）: 修正後もPowerProとの差が5以上 / confidence LOW /
//   強いphysical evidence conflict / PowerPro stale・odd疑い / AI側で解決できなかった
const queue = rows.filter(r =>
  (Math.abs(r.diff ?? 0) >= 5)
  || r.confidence === '低'
  || (r.conflictResid != null && Math.abs(r.conflictResid) >= 15)
  || r.stale === 'POWERPRO_STALE_SUPPORTED'
  || r.conflictVerdict === 'UNRESOLVED_PROJECT_CONFLICT');

const Q = [];
Q.push('# 走力 オーナーレビュー待ち行列（案）\n');
Q.push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
Q.push('状態: **AI側の工程は完了。スケール問題は主因でないことを実測で確認済み**\n');
Q.push('（目盛りをPowerProへ完全に揃えても |差|>=5 は 51人→56人 と減らない。');
Q.push('　つまり残りは選手個別の食い違い。詳細=outputs/speed_absolute_scale_investigation.md）\n');
Q.push('★走力の絶対目盛り（0〜100）は**まだ正本化されていない**（PowerPro由来の暫定）。');
Q.push('そのため「何点が正しいか」ではなく**「どちらが自然か」**でお答えください。\n');
Q.push('抽出条件（いずれか該当）:\n');
Q.push('- 修正後もPowerProとの差が5以上');
Q.push('- confidence LOW');
Q.push('- 強い材料衝突（系統ずれを除いて15点以上）');
Q.push('- PowerPro据え置きの疑いが裏付けられた（POWERPRO_STALE_SUPPORTED）');
Q.push('- AI側で原因を解決できなかった（UNRESOLVED_PROJECT_CONFLICT）\n');
Q.push(`**現時点の該当: ${queue.length}人**（スケール修正後に再抽出する）\n`);
Q.push('## 回答のしかた\n');
Q.push('点数を決めていただく必要はありません。次から選ぶだけで構いません。\n');
Q.push('- `PowerProの方が自然`');
Q.push('- `自作査定の方が自然`');
Q.push('- `その中間`');
Q.push('- `どちらも違和感`');
Q.push('- `判断できない`\n');
Q.push('必要に応じて任意の点数・コメントを添えていただけると助かります。\n');
Q.push('### 優先順位（上から見ていただければ十分です）\n');
Q.push('- **A群**: 差が大きい かつ こちらの信頼度も低い（最も情報が足りない）');
Q.push('- **B群**: 差が大きい（信頼度は中〜高）');
Q.push('- **C群**: 差は小さいが、信頼度が低い／PowerPro据え置きの裏付けあり\n');
{
  const grp = (r) => {
    const big = Math.abs(r.diff ?? 0) >= 5;
    if (big && r.confidence === '低') return 'A';
    if (big) return 'B';
    return 'C';
  };
  for (const g of ['A', 'B', 'C']) {
    const list = queue.filter(r => grp(r) === g)
      .sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0));
    Q.push(`#### ${g}群（${list.length}人）\n`);
    Q.push('| 選手 | 自作 | PowerPro | raw_diff | 信頼度 | 原因 | stale | あなたの判断 | 任意の点数・コメント |');
    Q.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of list)
      Q.push(`| ${r.player} | ${f1(r.mine)} | ${f1(r.pp)} | ${sg(r.diff)} | ${r.confidence} | ${r.causes.join('+') || '-'} | ${r.stale || '-'} | | |`);
    Q.push('');
  }
}
Q.push('');
writeFileSync(path.join(ROOT, 'outputs', 'speed_owner_review_queue_2026.md'), Q.join('\n'), 'utf8');

// CSV（全100人・機械可読）
const cols = ['player', 'team', 'mine', 'mineStat', 'npbUsed', 'npbDerived', 'materialGap', 'pp',
  'raw_diff', 'scale_adjusted_powerpro_residual_diagnostic', 'causes', 'stale', 'conflictVerdict', 'tier',
  'years', 'games', 'pa', 'ppFirst', 'ppLast', 'ppTotal', 'ppChanges', 'ppUnchanged', 'ppObs',
  'confidence', 'directT90', 'shortDist', 'bigDiff', 'needReview'];
const csv = [cols.join(',')];
for (const r of rows) csv.push(cols.map(c => {
  let v = r[c];
  if (c === 'raw_diff') v = r.diff;
  if (c === 'scale_adjusted_powerpro_residual_diagnostic') v = r.adj;
  if (Array.isArray(v)) v = v.join('|');
  if (v == null) return '';
  return typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}).join(','));
csv.push('');
writeFileSync(path.join(ROOT, 'outputs', 'derived', 'speed_owner_review_table_2026.csv'), csv.join('\n'), 'utf8');

console.log(`1段目 ${t1.length}人 / 2段目 ${t2.length}人 / それ以外 ${t3.length}人 / 合計 ${rows.length}人`);
console.log(`レビュー待ち行列(案) ${queue.length}人 → outputs/speed_owner_review_queue_2026.md`);
console.log(`相関 ${corr.toFixed(3)} 中心差 ${(SM.mu-SP.mu).toFixed(1)} 幅比 ${(SP.sd/SM.sd).toFixed(2)}`);
console.log('査定できなかった:', rows.filter(r => r.mine == null).map(r => `${r.player}(${r.err})`).join(', ') || 'なし');
