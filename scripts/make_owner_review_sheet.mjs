// オーナー査定シートの生成（検査用の物差し）。
//
// 位置づけ（2026-08-04 オーナー確定）: オーナーの修正値は**正解ラベルではなく検査用の物差し**。
// これに合わせに行くのではなく「どこがどれだけずれているか」を見つけ、原因を探るために使う。
// 照準は現行のまま＝自作エンジン整合（成績再現型）。
//
// 設計（同日オーナー指摘2件で修正）:
//  (1) 当初「自作値を見せるとアンカリングする」として伏せる設計にしたが、オーナーの査定は
//      「何かの値を基準にして、それがどうかを判断する」形なので、基準が無いと judgement が成立しない
//      → 自作値とパワプロ値の両方を載せる。
//  (2) 「なんでその査定になったのかの詳しい求め方や、どうしてパワプロと差が生まれているのかの考察も
//      書いてくれないと査定できません」→ **各能力に「求め方」と「差の考察」を併記する**。
//      材料はすべて card.calc_log から取る（新たな推測はしない）。
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEASON = Number(process.argv[2] ?? 2024);
const MIN_PA = Number(process.argv[3] ?? 150);
const LIMIT = Number(process.argv[4] ?? 0);

const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const runNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'running_norms.json'), 'utf8'));
const fldNorm = JSON.parse(await readFile(path.join(ROOT, 'configs', 'fielding_norms.json'), 'utf8'));
const scoutingLedger = loadLedger(JSON.parse(await readFile(path.join(ROOT, 'configs', 'scouting.json'), 'utf8')));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);

const rows = db.prepare(`
  SELECT p.name pawa_name, p.trajectory p_traj, p.meet p_meet, p.power p_power,
         p.speed p_speed, p.arm p_arm, p.fielding p_fld, p.catching p_catch,
         b.player_id, b.name, b.team, b.position, b.pa, b.ab, b.h, b.hr, b.b2, b.b3, b.sb, b.cs, b.so, b.bb, b.gdp
  FROM pawapuro_rating p
  JOIN pawapuro_link pl ON pl.name_norm = p.name_norm
  JOIN v_batting b ON b.player_id = pl.proeye_id AND b.season = ? AND b.pa >= ?
  WHERE b.position <> '投'
  ORDER BY b.pa DESC`).all(SEASON, MIN_PA);

const use = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
const r0 = v => (v == null || !Number.isFinite(v)) ? null : Math.round(v);
const r2 = v => (v == null || !Number.isFinite(v)) ? null : Math.round(v * 100) / 100;
const r3 = v => (v == null || !Number.isFinite(v)) ? null : Math.round(v * 1000) / 1000;

/**
 * 差の考察を、実際の計算過程から組み立てる（推測を足さない）。
 *
 * ★守備位置に合わない弱点を書かない（2026-08-04 オーナー指摘）。
 * 捕逸は捕手にしか起きないので外野手に「捕逸を使っていない」と書くのは無意味だった。
 * 内野手の肩は実測が存在しない（NPB Basementのarm列は外野・捕手のみ100%、内野は0%と実地確認）
 * ため、位置推定に頼っている事実をその選手に対してだけ書く。
 */
function explainGap(ab, mine, pawa, ctxInfo, pos) {
  if (mine == null || pawa == null) return '—';
  const d = mine - pawa;
  const dir = d > 0 ? '自作が高い' : '自作が低い';
  const isCatcher = pos === '捕';
  const isInfield = ['一', '二', '三', '遊'].includes(pos);
  let known = ctxInfo.knownLimits[ab];
  if (ab === '捕球') known = isCatcher ? ctxInfo.knownLimits.捕球_捕手 : ctxInfo.knownLimits.捕球;
  if (ab === '肩力' && isInfield) known = ctxInfo.knownLimits.肩力_内野;
  if (Math.abs(d) < 3) return `ほぼ一致（差${d > 0 ? '+' : ''}${Math.round(d)}）`;
  return `**${dir}（差${d > 0 ? '+' : ''}${Math.round(d)}）**${known ? '。' + known : ''}`;
}

const out = [];
let err = 0;
for (const r of use) {
  const res = appraiseCard(ctx, { name: r.name, mode: String(SEASON), cfg, rv, runNorm, fldNorm, scoutingLedger });
  if (res.error) { err++; continue; }
  const card = res.card;
  const A = card.abilities, B = A.基礎能力, L = card.calc_log;
  const g = v => v == null ? null : r0(v.value);
  const rf = L.run_field_log ?? {};
  const run = rf.running ?? {};
  const primaryFld = (rf.fielding ?? []).find(f => f.position) ?? {};

  out.push({
    name: r.name.replace(/　/g, ' '), team: r.team, pos: r.position,
    pa: r.pa, ab: r.ab, avg: (r.h / r.ab).toFixed(3).replace(/^0/, ''), hr: r.hr,
    b2: r.b2, b3: r.b3, sb: r.sb, cs: r.cs, so: r.so, bb: r.bb, gdp: r.gdp,
    tier: L.context_tier,
    mine: {
      弾道: B.弾道?.value ?? null, ミート: g(B.ミート), パワー: g(B.パワー), 走力: g(B.走力),
      肩力: g(B.肩力), 守備力: g(B.守備力), 捕球: g(B.捕球),
    },
    pawa: {
      弾道: r.p_traj, ミート: r.p_meet, パワー: r.p_power, 走力: r.p_speed,
      肩力: r.p_arm, 守備力: r.p_fld, 捕球: r.p_catch,
    },
    // 求め方の材料（すべてcalc_logから）
    how: {
      // 弾道は他の6能力と違い1〜4の段階。打球の構成比（ゴロ/ライナー/外野フライ/内野フライ）から
      // 逆算する（2026-08-04 オーナー指摘「弾道の求め方がないので追加してほしい」で追加）
      弾道: {
        材料: L.trajectory?.source ?? '打球タイプの構成比',
        打球構成: L.trajectory?.shares
          ? Object.entries(L.trajectory.shares).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(' / ')
          : '—',
        フライ引くゴロ: L.trajectory?.fly_minus_gb != null ? r2(L.trajectory.fly_minus_gb) : '—',
        最終: B.弾道?.value ?? '—',
        注記: L.trajectory?.note
          ?? (B.弾道?.value == null ? '打球タイプのデータが無い年のため未査定' : ''),
      },
      ミート: {
        入力: `打率 ${L.meat?.context_avg != null ? L.meat.context_avg.toFixed(3).replace(/^0/, '') : '—'}（実測）`,
        環境補正後: L.meat?.env_avg != null ? L.meat.env_avg.toFixed(3).replace(/^0/, '') : '—',
        縮小後: L.meat?.post_avg != null ? L.meat.post_avg.toFixed(3).replace(/^0/, '') : '—',
        基準値: r2(L.meat?.mean_ability),
        台帳調整: (L.meat?.adjustments ?? []).filter(a => a.delta !== 0)
          .map(a => `${a.component} ${a.delta > 0 ? '+' : ''}${a.delta.toFixed(1)}`).join(' / ') || 'なし',
        最終: r2(L.meat?.final),
      },
      パワー: {
        入力: `本塁打 ${r.hr}本 / ${r.ab}打数`,
        基準打数換算: r2(L.power?.hr_500paeq_raw),
        環境補正後: r2(L.power?.env),
        縮小後: r2(L.power?.post),
        最終: r2(L.power?.final),
        使用gamma: L.environment?.gamma_hr_used != null ? r3(L.environment.gamma_hr_used) : '—',
      },
      走力: {
        主材料: run.primary_speed_metric ?? '—',
        補助: (run.secondary_metrics ?? []).join('・') || '—',
        実測値: `UBR ${run._raw?.ubr ?? '—'} / 三塁打${r.b3} / 併殺${r.gdp}`,
        z値: run._speed_z ?? '—',
        最終: r2(run.speed_rating),
        注記: run._note ?? '',
      },
      肩力: {
        材料: primaryFld.arm_metric ?? '—',
        推定か: primaryFld.arm_is_estimated ? '守備位置からの推定' : '実測ベース',
        最終: r2(primaryFld.arm_rating),
      },
      守備力: {
        材料: primaryFld.range_metric ?? '—',
        範囲成分: r2(primaryFld.range_component_only),
        守備イニング: r2(primaryFld.innings),
        信頼度: r2(primaryFld.confidence),
        最終: r2(primaryFld.inferred_fielding_rating),
      },
      捕球: {
        材料: '失策率（ErrR由来）',
        失策率: r3(primaryFld.error_rate),
        最終: r2(primaryFld.catching_rating),
      },
    },
  });
}

// 既知の限界（能力ごと・全選手共通）。今日の棚卸しで確定した事実だけを書く
const KNOWN = {
  走力: '走力は「走塁の成果」（UBR・三塁打・併殺回避）から推定しており、仕様が第1階層に置く直接計測（Sprint Speed・50m走）を使っていない。**MLB実測が59人分DBにあるが査定に未接続**（T-0089）',
  肩力: '肩力はARM（送球による得点貢献）由来。**強肩ほど走者が走らないので機会が減り、低く出やすい**。仕様が第1階層に置く送球速度・遠投は未使用。捕手のPop Time・送球速度は11年分取得済みだが未パース（T-0089）',
  守備力: '守備範囲（RngR）由来。仕様が第1階層に置くOAA・反応時間は未使用',
  // ★捕逸は捕手にしか起きないので、捕手以外に書いてはいけない
  //   （2026-08-04 オーナー指摘「キャッチャーではない選手の守備系の能力に捕手の指標を使っていないと
  //    書いているのはどうしてですか？」。全選手に同じ文を出す作りだったのが原因）
  // 捕手以外には捕逸の話を出さない（そもそも発生しない）。使える材料の不足だけを書く
  捕球: '失策率（機会の質で調整済み）のみ。打球の難度そのものは見ていない',
  捕球_捕手: '失策率のみ。**捕手は捕逸（DBに1,156行ある）が使えるのに未使用**（T-0089）',
  // 内野手には送球の実測が存在しない（NPB Basementのarm列は外野・捕手100%／内野0%を実地確認）
  肩力_内野: '**内野手は肩の実測が存在しない**（送球による得点貢献は外野手と捕手にしか公開されていない）。'
    + '現行は「守れる位置から推定＋下限保証」で、**個人については測れていない**（2026-08-04 オーナー指摘）。'
    + '実データ経路は送球速度（NPB+、手作業）のみ＝T-0089',
  ミート: '',
  パワー: '打球計測（打球速度・角度・バレル率）は未使用。球場係数は実測済みだが未適用',
  弾道: '打球の構成比から逆算。仕様が第1階層に置く打球角度・バレル率は未使用',
};

const ABILS = ['弾道', 'ミート', 'パワー', '走力', '肩力', '守備力', '捕球'];
const cell = v => v == null ? '—' : String(v);
const kv = o => Object.entries(o).filter(([k]) => k !== '注記').map(([k, v]) => `${k}=${v}`).join(' → ');

const md = [
  '---', 'status: draft', 'created: 2026-08-04', 'kind: owner_review_sheet', '---', '',
  `# オーナー査定シート（${SEASON}年・${MIN_PA}打席以上／${use.length - err}人）`, '',
  '> **これは「検査用の物差し」です**（2026-08-04 オーナー確定）。あなたの値に**合わせに行くためのものではありません**。',
  '> 「どこがどれだけずれているか」を見つけ、ずれの大きい選手から原因を探るために使います。', '',
  '## 記入のしかた', '',
  '- **「あなた」列に、あなたの査定値を入れてください**。1〜100の数値でも、ランク（S/A/B/C/D/E/F/G）でも可。弾道だけ1〜4',
  '- **分かるもの・気になるものだけで結構です**。空欄は飛ばします',
  '- 各能力に「**求め方**」（実際の計算過程）と「**差の考察**」を付けました。判断の材料にしてください',
  '- 記入後 `node scripts/diff_owner_review.mjs` でずれの大きい順に並びます', '',
  '## 全能力に共通する既知の弱点（2026-08-04の棚卸しで確定）', '',
  '査定は仕様が定める**3階層**のデータのうち、多くの能力で**第3階層（成果指標）しか使っていません**。',
  '第1階層＝直接計測（Sprint Speed・送球速度・打球速度など）を使えば精度が上がる余地があり、',
  '**一部は既にディスクに取得済みなのに未接続**であることが判明しています（T-0089）。', '',
  '| 能力 | 既知の弱点 |', '|---|---|',
  ...ABILS.filter(a => KNOWN[a]).map(a => `| ${a} | ${KNOWN[a]} |`),
  '',
];

for (const p of out) {
  const ctxInfo = { knownLimits: KNOWN };
  md.push(`---`, '', `## ${p.name}（${p.team} ${p.pos}）`, '',
    `**${SEASON}年成績**: ${p.pa}打席 ${p.ab}打数 打率${p.avg} ${p.hr}本 二塁打${p.b2} 三塁打${p.b3} 盗塁${p.sb}${p.cs > 0 ? `(失敗${p.cs})` : ''} 三振${p.so} 四球${p.bb} 併殺${p.gdp}`,
    `**文脈Tier**: ${p.tier}（A=対右×非得点圏の実測／B=対右のみ／C=総合のみ）`, '');

  md.push('| 能力 | 自作 | パワプロ | あなた | 差の考察 |', '|---|---:|---:|---|---|');
  for (const a of ABILS) {
    md.push(`| **${a}** | ${cell(p.mine[a])} | ${cell(p.pawa[a])} | | ${explainGap(a, p.mine[a], p.pawa[a], ctxInfo, p.pos)} |`);
  }
  md.push('');
  md.push('<details><summary>求め方の詳細（クリックで開く）</summary>', '');
  md.push(`- **弾道**: 材料=${p.how.弾道.材料}／打球構成=${p.how.弾道.打球構成}`
    + `／フライ−ゴロ=${p.how.弾道.フライ引くゴロ} → **${p.how.弾道.最終}**`);
  if (p.how.弾道.注記) md.push(`  - ※${p.how.弾道.注記}`);
  md.push(`- **ミート**: ${kv(p.how.ミート)}`);
  md.push(`- **パワー**: ${kv(p.how.パワー)}`);
  md.push(`- **走力**: 主材料=${p.how.走力.主材料}／補助=${p.how.走力.補助}／${p.how.走力.実測値}／z=${p.how.走力.z値} → **${p.how.走力.最終}**`);
  if (p.how.走力.注記) md.push(`  - ※${p.how.走力.注記}`);
  md.push(`- **肩力**: 材料=${p.how.肩力.材料}（${p.how.肩力.推定か}） → **${p.how.肩力.最終}**`);
  md.push(`- **守備力**: 材料=${p.how.守備力.材料}／範囲成分=${p.how.守備力.範囲成分}／守備イニング=${p.how.守備力.守備イニング}／信頼度=${p.how.守備力.信頼度} → **${p.how.守備力.最終}**`);
  md.push(`- **捕球**: 材料=${p.how.捕球.材料}／失策率=${p.how.捕球.失策率} → **${p.how.捕球.最終}**`);
  md.push('', '</details>', '');
}

md.push('---', '', `生成: scripts/make_owner_review_sheet.mjs ${SEASON} ${MIN_PA}${LIMIT ? ' ' + LIMIT : ''}`,
  `対象${out.length}人（査定エラー${err}件）`);

await mkdir(path.join(ROOT, 'outputs'), { recursive: true });
const outPath = path.join(ROOT, 'outputs', `owner_review_sheet_${SEASON}.md`);
await writeFile(outPath, md.join('\n'), 'utf8');
console.log(`${out.length}人分を生成（エラー${err}件） → ${path.relative(ROOT, outPath)}`);
db.close();
