// NF3から取り込んだ分割成績を、査定が使える形で取り出す（Sol仕様 03 §3 splits）。
//
// 使い道:
//   02 §5.1 / 03 §4.1  ミートの基準統計を「対右」へ（文脈 Tier C → B）
//   02 §8.3            限定起用・左右併用の対戦相手バイアス
//   05 §3              チャンス（得点圏 − 非得点圏）
//   05 §4              対左（対左 − 対右。ミート差と長打差を分ける）
//
// 交差セル（対右×非得点圏）はNF3にも無い。周辺値から作らない（仕様§5.1 REJECTED）。

/** ランナー別の表から「非得点圏」を作る。得点圏＝2塁以上に走者がいる場面 */
const NON_RISP_LABELS = ['無し', '1塁'];

const asLine = r => r == null ? null : {
  PA: r.pa, AB: r.ab, H: r.h, B2: r.b2, B3: r.b3, HR: r.hr,
  BB: r.bb, HBP: r.hbp, SO: r.so, SH: r.sh, SF: r.sf, RBI: r.rbi,
};

const sumLines = rows => {
  if (!rows.length) return null;
  const keys = ['pa', 'ab', 'h', 'b2', 'b3', 'hr', 'bb', 'hbp', 'so', 'sh', 'sf', 'rbi'];
  const o = {};
  for (const k of keys) o[k] = rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  return asLine(o);
};

/**
 * 選手×シーズンの分割成績を引く。
 * @param {object} db
 * @param {string} proeyeId プロEYE球の選手ID
 * @param {number} season
 * @returns {null|{vsR, vsL, risp, nonRisp, park, month, source}}
 */
export function loadSplits(db, proeyeId, season) {
  let rows;
  try {
    rows = db.prepare(`
      SELECT s.section, s.label, s.pa, s.ab, s.h, s.b2, s.b3, s.hr, s.bb, s.hbp, s.so, s.sh, s.sf, s.rbi
      FROM nf3_split s
      JOIN nf3_link l ON l.season=s.season AND l.name_norm=s.name_norm
      WHERE l.proeye_id=? AND s.season=?`).all(proeyeId, season);
  } catch {
    return null; // NF3をまだ取り込んでいない環境でも査定は動く
  }
  if (!rows.length) return null;

  const of_ = (section, label) => rows.find(r => r.section === section && r.label === label);
  const hand = l => asLine(of_('hand', l));
  const runner = l => asLine(of_('runner', l));

  return {
    vsR: hand('対右投手'),
    vsL: hand('対左投手'),
    risp: runner('得点圏'),
    // NF3に「非得点圏」の行は無いので、走者なし＋一塁のみを足して作る。
    // これは**同じ表の中の足し算**であって、別々の周辺値から交差を作る捏造とは別物
    nonRisp: sumLines(rows.filter(r => r.section === 'runner' && NON_RISP_LABELS.includes(r.label))),
    park: rows.filter(r => r.section === 'park').map(r => ({ park: r.label, ...asLine(r) })),
    month: rows.filter(r => r.section === 'month').map(r => ({ month: r.label, ...asLine(r) })),
    source: {
      source_name: 'NF3（プロ野球 ヌルデータ置き場f3）',
      source_url: 'https://nf3.sakura.ne.jp/',
      retrieved_at: '2026-08-01',
      notes: 'えるてん(@nf3_Info) 個人運営。オーナー承認のうえ1秒1ページ以下で取得',
    },
    _no_cross_cell: '対右×非得点圏の交差セルはNF3にも無い。周辺値から作らない（仕様02 §5.1 REJECTED）',
  };
}

/**
 * リーグ全体の分割成績（環境補正の分母に使う）。
 *
 * なぜ要るか（2026-08-05、T-0102の修理）:
 *   ミートの基準を「対右投手」へ切り替える時、**リーグ平均も対右へ揃えないと環境補正が壊れる**。
 *   選手だけ対右にしてリーグを総合のままにすると「対右の打率 ÷ 総合のリーグ平均」を計算することになり、
 *   仕様02 §92「環境補正では選手統計とリーグ平均の文脈を一致させる」を破る。
 *   対右は投手有利なので、揃えないと右打者のミートが構造的に低く出る。
 *
 * 作り方: NF3の分割をその年の全選手ぶん足し合わせる。**同じ表の中の足し算**なので、
 *   別々の周辺値から交差セルを作る捏造（仕様02 §5.1 REJECTED）とは別物。
 *
 * @returns {null|{AB, H, avg, players}} 引けない年（NF3が2023-2025のみ）は null
 */
export function loadLeagueSplitAverage(db, season, label = '対右投手') {
  let row;
  try {
    row = db.prepare(`
      SELECT SUM(s.ab) ab, SUM(s.h) h, COUNT(*) n
      FROM nf3_split s
      WHERE s.season = ? AND s.section = 'hand' AND s.label = ? AND s.ab > 0`).get(season, label);
  } catch {
    return null;
  }
  if (!row || !(row.ab > 0)) return null;
  return { AB: row.ab, H: row.h, avg: row.h / row.ab, players: row.n, label };
}
