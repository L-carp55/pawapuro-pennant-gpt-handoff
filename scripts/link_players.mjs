// プロEYE球（基礎成績・1936-2025）と NPB Basement（高度指標・2020-2026）の選手を突合する。
// 両者は選手IDの体系が違うため、正規化した氏名＋年度＋球団で対応表を作る。
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'));

// 球団: Basement の1文字略称 → プロEYE球の正式名
const TEAM = {
  '神': '阪神タイガース', '巨': '読売ジャイアンツ', '中': '中日ドラゴンズ',
  'ヤ': '東京ヤクルトスワローズ', '広': '広島東洋カープ', 'デ': '横浜DeNAベイスターズ',
  '西': '埼玉西武ライオンズ', '楽': '東北楽天ゴールデンイーグルス', '日': '北海道日本ハムファイターズ',
  'ロ': '千葉ロッテマリーンズ', 'ソ': '福岡ソフトバンクホークス', 'オ': 'オリックス・バファローズ',
};

// 氏名の正規化: HTMLタグ・スペース・中黒・ドットを除去し、長音とハイフン類を統一
function normName(x) {
  if (!x) return '';
  return String(x)
    .replace(/<[^>]*>/g, '')
    .normalize('NFKC')
    .replace(/[\s　]/g, '')
    .replace(/[.．・]/g, '')
    .replace(/[ー―‐\-−]/g, 'ー')
    .toUpperCase();
}

// 外国人選手の登録名は「Ｒ．マルティネス」のようにイニシャルが付くことがあり、
// Basement 側は「マルティネス」と姓のみのため、イニシャルを落としたキーでも突合する
function stripInitial(normalized) {
  return normalized.replace(/^[A-Z]{1,2}(?=[ァ-ヶー])/, '');
}

db.exec(`
DROP TABLE IF EXISTS player_link;
CREATE TABLE player_link (
  season INTEGER, team TEXT,
  proeye_id TEXT, bm_id TEXT,
  name_proeye TEXT, name_bm TEXT,
  method TEXT
);
CREATE INDEX idx_link_pe ON player_link(proeye_id);
CREATE INDEX idx_link_bm ON player_link(bm_id);
`);

const ins = db.prepare(`INSERT INTO player_link VALUES (?,?,?,?,?,?,?)`);

const seasons = db.prepare(`SELECT DISTINCT season FROM v_bm_player WHERE farm=0 ORDER BY season`).all().map(r => r.season);
const report = [];

db.exec('BEGIN');
for (const season of seasons) {
  // プロEYE球側: その年の公式戦に出た選手（打者・投手の和集合）
  const peRows = db.prepare(`
    SELECT DISTINCT player_id, name, team FROM v_batting WHERE season=?
    UNION
    SELECT DISTINCT player_id, name, team FROM v_pitching WHERE season=?`).all(season, season);
  const bmRows = db.prepare(`SELECT player_id, name_ja, team FROM v_bm_player WHERE season=? AND farm=0`).all(season);

  if (!peRows.length || !bmRows.length) {
    report.push({ season, pe: peRows.length, bm: bmRows.length, matched: 0, note: 'どちらかにデータなし' });
    continue;
  }

  // 索引を3種類作る: 名前+球団 / イニシャル除去名+球団 / 名前のみ
  const idx = { nameTeam: new Map(), baseTeam: new Map(), name: new Map() };
  const push = (map, key, val) => { if (!map.has(key)) map.set(key, []); map.get(key).push(val); };
  for (const r of peRows) {
    const nm = normName(r.name);
    const base = stripInitial(nm);
    push(idx.nameTeam, nm + '|' + r.team, r);
    push(idx.baseTeam, base + '|' + r.team, r);
    push(idx.name, nm, r);
  }

  const stats = { nameTeam: 0, baseTeam: 0, name: 0 };
  let matched = 0;
  const unmatched = [];
  for (const b of bmRows) {
    const nm = normName(b.name_ja);
    const peTeam = TEAM[b.team];
    let hit = null, method = null;

    // 一意に決まる候補だけを採用する（複数候補は誤結合を避けて未一致に落とす）
    const tries = [
      ['nameTeam', idx.nameTeam.get(nm + '|' + peTeam)],
      ['baseTeam', idx.baseTeam.get(nm + '|' + peTeam)],
      ['name', idx.name.get(nm)],
    ];
    for (const [m, cand] of tries) {
      if (cand && cand.length === 1) { hit = cand[0]; method = m; stats[m]++; break; }
    }

    if (hit) {
      ins.run(season, peTeam ?? b.team, hit.player_id, b.player_id, hit.name, b.name_ja, method);
      matched++;
    } else {
      unmatched.push(b.name_ja);
    }
  }
  report.push({
    season, pe: peRows.length, bm: bmRows.length, matched,
    rate: (matched / bmRows.length * 100).toFixed(1) + '%',
    stats,
    unmatchedSample: unmatched.slice(0, 8),
    unmatchedCount: unmatched.length,
  });
}
db.exec('COMMIT');

for (const r of report) {
  if (r.note) { console.log(`${r.season}: ${r.note}`); continue; }
  console.log(`${r.season}: Basement ${String(r.bm).padStart(4)}人中 ${String(r.matched).padStart(4)}人一致 (${r.rate})  [名前+球団 ${r.stats.nameTeam} / 略名+球団 ${r.stats.baseTeam} / 名前のみ ${r.stats.name}]  未一致 ${r.unmatchedCount}`);
  if (r.unmatchedCount) console.log(`     未一致例: ${r.unmatchedSample.join(', ')}`);
}
const total = db.prepare('SELECT COUNT(*) n FROM player_link').get();
console.log(`\n対応表: ${total.n} 行`);

// Basementは同一選手に球団ごとの別IDを振ることがある
// （例: 2020年 Ｄ．Ｊ．ジョンソンは広島→楽天の移籍で 20200037 / 20200113 の2ID）。
// 対応表を通じて proeye_id 単位へ統合したビューを作る。これを査定の正とする。
db.exec(`
DROP VIEW IF EXISTS v_bm_by_player;
CREATE VIEW v_bm_by_player AS
SELECT l.proeye_id, p.season, p.farm,
  MAX(p.name_ja) name_ja,
  SUM(p.war) war, SUM(p.bat_war) bat_war, SUM(p.run_war) run_war, SUM(p.fld_war) fld_war, SUM(p.pit_war) pit_war,
  SUM(p.ubr) ubr, SUM(p.wsb) wsb, SUM(p.dpar) dpar,
  SUM(p.def_inn) def_inn, SUM(p.tzr) tzr, SUM(p.rngr) rngr, SUM(p.dpr) dpr, SUM(p.arm) arm, SUM(p.errr) errr,
  COUNT(DISTINCT p.player_id) src_ids
FROM v_bm_player p
JOIN player_link l ON l.bm_id = p.player_id AND l.season = p.season
GROUP BY l.proeye_id, p.season, p.farm;
`);

const splitIds = db.prepare(`SELECT COUNT(*) n FROM v_bm_by_player WHERE src_ids > 1`).get();
const dupCheck = db.prepare(`
  SELECT COUNT(*) n FROM (SELECT season, proeye_id FROM player_link GROUP BY season, proeye_id HAVING COUNT(*) > 1)`).get();
console.log(`Basement側でIDが分裂していた選手: ${splitIds.n}件（v_bm_by_player で統合）`);
console.log(`対応表の重複（proeye_id基準）: ${dupCheck.n}件 → 統合ビュー経由で解消`);
db.close();
