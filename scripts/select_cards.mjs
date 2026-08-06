// 選手群のカード年度選定を一覧する（Sol仕様 06 §1 カープ13人 / 07 §3 WBC15野手の年度候補）
// 使い方: node scripts/select_cards.mjs carp | wbc
import { DatabaseSync } from 'node:sqlite';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leagueRates } from '../src/cards/season_score.mjs';
import { rankSeasons, buildPeakYearCard, selectionRobustness } from '../src/cards/peak_year.mjs';
import { selectPrimeWindow, buildPrimeCompositeCard } from '../src/cards/prime_composite.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUP = process.argv[2] ?? 'carp';

// Sol仕様 06 §1 のカープ黄金期13人（仕様の候補年は「確定値ではない」と明記されている）
const CARP = ['田中　広輔', '菊池　涼介', '丸　佳浩', '鈴木　誠也', '新井　貴浩', '松山　竜平',
  'エルドレッド', '安部　友裕', '會澤　翼', '石原　慶幸', '西川　龍馬', '野間　峻祥', 'バティスタ'];
const CARP_SPEC = { "田中　広輔": 2017, "菊池　涼介": 2016, "丸　佳浩": 2018, "鈴木　誠也": 2018, "新井　貴浩": 2016,
  "松山　竜平": 2017, エルドレッド: 2017, "安部　友裕": 2017, "會澤　翼": 2018, "石原　慶幸": 2016,
  "西川　龍馬": 2018, "野間　峻祥": 2018, バティスタ: 2018 };

// Sol仕様 07 §3 のWBC2017野手（捕手3・内野6・外野6）。過去候補年は「確定ではない」
const WBC = ['小林　誠司', '大野　奨太', '炭谷　銀仁朗', '松田　宣浩', '菊池　涼介', '坂本　勇人',
  '中田　翔', '山田　哲人', '田中　広輔', '内川　聖一', '青木　宣親', '平田　良介',
  '筒香　嘉智', '秋山　翔吾', '鈴木　誠也'];
const WBC_SPEC = { "青木　宣親": 2010, "内川　聖一": 2008, "平田　良介": 2015, "秋山　翔吾": 2015, "筒香　嘉智": 2016,
  "鈴木　誠也": 2021, "田中　広輔": 2017, "松田　宣浩": 2015, "菊池　涼介": 2016, "坂本　勇人": 2016,
  "中田　翔": 2013, "山田　哲人": 2015, "炭谷　銀仁朗": null, "小林　誠司": 2017, "大野　奨太": 2016 };

const NAMES = GROUP === 'wbc' ? WBC : CARP;
const SPEC = GROUP === 'wbc' ? WBC_SPEC : CARP_SPEC;
const RANGE = GROUP === 'wbc' ? null : [2014, 2020]; // カープは黄金期周辺に限定

const rv = JSON.parse(await readFile(path.join(ROOT, 'configs', 'run_values.json'), 'utf8')).values;
const cfg = JSON.parse(await readFile(path.join(ROOT, 'configs', 'ratings.json'), 'utf8'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

const lgOf = s => db.prepare(`
  SELECT SUM(pa) pa,SUM(ab) ab,SUM(h) h,SUM(b2) b2,SUM(b3) b3,SUM(hr) hr,
         SUM(bb) bb,SUM(hbp) hbp,SUM(sb) sb,SUM(cs) cs,SUM(sh) sh,SUM(sf) sf
  FROM v_batting WHERE season=?`).get(s);
const LG = {}, ENV = {};
const REF = lgOf(cfg.environment.reference_season);
const refAvg = REF.h / REF.ab, refHr = REF.hr / REF.ab;
for (const r of db.prepare('SELECT DISTINCT season FROM v_batting').all()) {
  const a = lgOf(r.season);
  LG[r.season] = leagueRates(a);
  ENV[r.season] = {
    avg: Math.pow(refAvg / (a.h / a.ab), cfg.environment.gamma_avg),
    hr: Math.pow(refHr / (a.hr / a.ab), cfg.environment.gamma_hr),
  };
}

function seasonsOf(name) {
  let sql = `SELECT * FROM v_batting WHERE name LIKE ? AND position <> '投'`;
  const args = [`%${name}%`];
  if (RANGE) { sql += ` AND season BETWEEN ? AND ?`; args.push(RANGE[0], RANGE[1]); }
  return db.prepare(sql + ' ORDER BY season').all(...args).map(p => ({
    season: p.season, position: p.position,
    line: { PA: p.pa, AB: p.ab, H: p.h, B2: p.b2, B3: p.b3, HR: p.hr, BB: p.bb, HBP: p.hbp,
      SO: p.so, SH: p.sh, SF: p.sf, GDP: p.gdp, SB: p.sb, CS: p.cs },
    lgRate: LG[p.season], envFactors: ENV[p.season],
  }));
}

const rows = [];
for (const name of NAMES) {
  const ss = seasonsOf(name);
  if (!ss.length) { rows.push({ name, note: '該当データなし' }); continue; }
  const ranked = rankSeasons(ss, rv, { mode: 'total' });
  if (!ranked.length) { rows.push({ name, note: '規定打席未満（200PA未満のみ）' }); continue; }
  const card = buildPeakYearCard(ranked, { mode: 'total' });
  const rob = selectionRobustness(ranked);
  const byBat = rankSeasons(ss, rv, { mode: 'batting' })[0];
  const win = selectPrimeWindow(ss, rv, { windowYears: 3, minPaPerYear: 200 });
  const comp = win ? buildPrimeCompositeCard(win) : null;
  rows.push({
    name, card, rob, batPeak: byBat?.season, comp,
    spec: SPEC[name.replace(/\s/g, '')] ?? SPEC[name] ?? null,
    line: card ? ranked[0].line : null,
  });
}

const title = GROUP === 'wbc' ? '2017 WBC日本代表 野手15人' : 'カープ黄金期13人';
let md = `---
status: draft
created: 2026-08-01
---

# カード年度選定 — ${title}

> Sol仕様 02 §3.1（ピーク単年）／§3.2（全盛期合成）／07 §8（年度選定の評価軸）の実装結果。
> **仕様が挙げていた候補年は「確定値ではない」と明記されている**ため、ここでは実データの得点貢献から独立に選び直し、仕様の候補と突き合わせる。

## 選定方法

年度の価値は**得点貢献**で測る（\`configs/run_values.json\`）。各イベントの得点価値はチーム実得点からの回帰で求めたもので、恣意的な重みは使っていない。

- **総合ピーク**（既定）= 打撃の得点貢献 ＋ 走塁 ＋ 守備 ＋ 守備位置調整
- **打撃ピーク** = 打撃の得点貢献のみ
- 全盛期合成 = 連続3年の窓のうち得点貢献の合計が最大のもの。合算の重みは打数のみ

## 結果

| 選手 | 総合ピーク | 打撃ピーク | 仕様の候補 | 一致 | 全盛期(連続3年) | 次点との差 |
|---|---:|---:|---:|:---:|---|---|
`;
for (const r of rows) {
  if (r.note) { md += `| ${r.name.replace(/　/g, ' ')} | — | — | ${r.spec ?? '—'} | — | — | ${r.note} |\n`; continue; }
  const y = r.card.seasonLabel;
  const match = r.spec == null ? '—' : (y === r.spec ? '○' : '×');
  md += `| ${r.name.replace(/　/g, ' ')} | **${y}** | ${r.batPeak} | ${r.spec ?? '—'} | ${match} | ${r.comp ? r.comp.period : '—'} | ${r.rob.gap === Infinity ? '—' : r.rob.gap + '点'}${r.rob.robust ? '' : ' ⚠僅差'} |\n`;
}

const withSpec = rows.filter(r => !r.note && r.spec != null);
const agree = withSpec.filter(r => r.card.seasonLabel === r.spec).length;
md += `
## 仕様の候補年との一致

${agree}/${withSpec.length}件で一致。

不一致は「仕様が誤っている」ことを意味しない——仕様の候補は印象や部分的な指標で挙げられた**確定前の候補**であり、こちらは得点貢献で機械的に選んでいる。差が出た選手は、どちらを採るかオーナー判断が要る。

### 不一致の内訳

| 選手 | 機械選定 | 仕様候補 | 差の理由（得点貢献） |
|---|---:|---:|---|
`;
for (const r of withSpec.filter(r => r.card.seasonLabel !== r.spec)) {
  const specRank = rankSeasons(seasonsOf(r.name), rv, { mode: 'total' }).find(x => x.season === r.spec);
  md += `| ${r.name.replace(/　/g, ' ')} | ${r.card.seasonLabel}（${r.card.selection.score}点） | ${r.spec}（${specRank ? specRank.score.toFixed(1) + '点' : '規定未満'}） | ${specRank ? (r.card.selection.score - specRank.score).toFixed(1) + '点差' : '候補年が最低打席に満たない'} |\n`;
}

md += `
## 注意

- 走塁・守備の得点貢献はNPB Basementのデータがある2020年以降のみ加算される。それ以前は**打撃と守備位置調整のみ**で評価しているため、守備の名手が過小評価される可能性がある（例: 菊池涼介の二塁守備）
- 守備位置調整の値はPROVISIONAL（一般的な序列を採用。NPB実データからの導出は未実施）
`;

const out = path.join(ROOT, 'outputs', `card_selection_${GROUP}.md`);
await writeFile(out, md, 'utf8');
console.log(md);
console.log(`→ ${path.relative(ROOT, out)}`);
db.close();
