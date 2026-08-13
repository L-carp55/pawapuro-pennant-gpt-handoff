// カード査定の中核パイプライン。CLI（build_card.mjs）と一括生成（build_cards_batch.mjs）で共有する。
//
// 仕様の対応:
//   02 §3.1/§3.2  ピーク単年／全盛期合成
//   03 §1.1       Provenance（全入力値に出典・取得日・推定フラグ）
//   03 §1.2       raw / normalized / derived / ratings の分離
//   03 §2/§7/§8   カードスキーマ・信頼度・計算ログ
//   04 §4.3/§12   肩力（内野は推定）・サブポジ適性

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitLogDist } from '../ratings/scale.mjs';
import { appraiseBatting, playerParkFactor, applyEnvironment, gammaForLevel } from '../ratings/from_rates.mjs';
import { selectPrior } from '../ratings/shrinkage.mjs';
import { speedComponents, speedRating, stealingAbility, baserunningAbility } from '../ratings/running.mjs';
import { appraiseAllPositions } from '../ratings/fielding.mjs';
import {
  buildMeetLedger, buildPowerLedger,
  strikeoutAbility, infieldHitAbility, goldSpecialAbilities,
} from '../ratings/special_abilities.mjs';
import { buildCard, assessConfidence, buildCalcLog } from './card_schema.mjs';
import { leagueRates } from './season_score.mjs';
import { rankSeasons, buildPeakYearCard } from './peak_year.mjs';
import { leagueOf } from './teams.mjs';
import { selectPrimeWindow, buildPrimeCompositeCard } from './prime_composite.mjs';
import { buildRunFieldLog } from '../ratings/runfield_log.mjs';
import { applyGameConventions } from '../ratings/game_conventions.mjs';
import { trajectoryFromShares } from '../engine/batted_ball.mjs';
import { durabilityRate } from '../ratings/shrinkage.mjs';
import { buildAbilitySheet } from './ability_sheet.mjs';
import { estimateDurableTraits } from './durable_estimate.mjs';
import { traitRating } from '../ratings/durable_traits.mjs';
import { clamp } from '../ratings/scale.mjs';
import { loadSplits, loadLeagueSplitAverage } from '../ratings/nf3_splits.mjs';
import { selectContext, clutchDifferential, plattonDifferential } from '../ratings/context_tier.mjs';
import { lookup as scoutLookup, reconcile as scoutReconcile } from '../ratings/scouting_input.mjs';
import { buildAbilityEvidence, DIRECT_MEASUREMENT_STATUS } from '../ratings/ability_evidence.mjs';
import { buildDirectMeasurements } from '../ratings/direct_measurement.mjs';
import { advanceOf } from '../ratings/baserunning_advance.mjs';

/** 出典の定義（仕様03 §1.1）。値ごとの provenance はここを参照する */
export const SOURCES = {
  proeye: {
    source_name: 'プロEYE球',
    source_url: 'https://proeyekyuu.com/ja/csvs-jp/',
    retrieved_at: '2026-07-31',
    notes: '基礎成績（打撃・投手・守備）。公式集計の再計算',
  },
  basement: {
    source_name: 'NPB Basement',
    source_url: 'https://npbbasement.com/',
    retrieved_at: '2026-07-31',
    notes: '高度指標（守備成分・打球性質・走塁・選球眼）。2020年以降のみ',
  },
  derived: {
    source_name: '本プロジェクトの較正',
    source_url: null,
    retrieved_at: '2026-08-01',
    notes: '上記の生データから回帰・分位点推定で導いた値。導出スクリプトを scripts/calibrate_*.mjs に保存',
  },
};

const r1 = v => (v == null || !Number.isFinite(v)) ? null : Math.round(v * 10) / 10;

/**
 * 1つの値に出典を添える（仕様03 §1.1）。
 * 値そのものを裸で返さず、どこから来て・推定かどうかを常に持たせる。
 */
export function withProvenance(value, src, opts = {}) {
  const { season = null, league = null, context = null, isEstimated = false, method = null, confidence = null, notes = null } = opts;
  return {
    value,
    source_name: src.source_name,
    source_url: src.source_url,
    retrieved_at: src.retrieved_at,
    season, league, context,
    is_estimated: isEstimated,
    estimation_method: isEstimated ? method : null,
    confidence,
    notes: notes ?? src.notes,
  };
}

/**
 * 選手名の正規化（互換漢字対策）。
 *
 * プロEYE球の登録名には Unicode の「CJK互換漢字」が混じる。
 * 例: 炭谷銀仁朗の「朗」は U+F929 で、ふつうの「朗」U+6717 とは別の文字。
 * 見た目が同じなので目視では気づけず、LIKE 検索が静かに0件になる（2026-08-01 検出）。
 * NFKC 正規化で互換漢字は通常の字へ畳まれるので、突き合わせは常に正規化後で行う。
 * 全角スペースも半角へ寄せて、表記ゆれで落ちないようにする。
 */
export const normName = s => (s ?? '').normalize('NFKC').replace(/\s+/g, '');

/** 正規化した名前から、DBに入っている綴りの player_id を引く */
export function resolveName(db, name, opts = {}) {
  const key = normName(name);
  if (opts.playerId) {
    const row = db.prepare(
      `SELECT DISTINCT player_id, name FROM v_batting WHERE player_id=? AND position <> '投' LIMIT 1`
    ).get(opts.playerId);
    if (row) return { playerId: row.player_id, dbName: row.name, disambiguation: 'player_id' };
  }
  const rows = db.prepare(
    `SELECT DISTINCT player_id, name, team, season FROM v_batting WHERE position <> '投'`
  ).all();
  const exact = rows.filter(r => normName(r.name) === key);
  const exactIds = [...new Set(exact.map(r => r.player_id))];
  if (exactIds.length === 1) return { playerId: exactIds[0], dbName: exact[0].name, disambiguation: 'exact' };

  const hit = rows.filter(r => normName(r.name).includes(key));
  const ids = [...new Set(hit.map(r => r.player_id))];
  if (ids.length === 1) return { playerId: ids[0], dbName: hit[0].name, disambiguation: 'unique_includes' };

  if (ids.length > 1) {
    const season = opts.season != null ? Number(opts.season) : null;
    if (Number.isFinite(season)) {
      const inSeason = hit.filter(r => Number(r.season) === season);
      const seasonIds = [...new Set(inSeason.map(r => r.player_id))];
      if (seasonIds.length === 1) {
        return { playerId: seasonIds[0], dbName: inSeason[0].name, disambiguation: 'season' };
      }
    }
    const teamKey = opts.team ? normName(opts.team) : '';
    if (teamKey) {
      const inTeam = hit.filter(r => teamKey.includes(normName(r.team)) || normName(r.team).includes(teamKey));
      const teamIds = [...new Set(inTeam.map(r => r.player_id))];
      if (teamIds.length === 1) {
        return { playerId: teamIds[0], dbName: inTeam[0].name, disambiguation: 'team' };
      }
    }
    return { error: `名前が複数人に一致: ${[...new Set(hit.map(r => r.name))].join(' / ')}` };
  }

  const extra = describeUnresolvedIdentity(db, name);
  return { error: extra ? `該当なし: ${name}（${extra}）` : `該当なし: ${name}` };
}

function describeUnresolvedIdentity(db, name) {
  const key = normName(name);
  const notes = [];
  try {
    const usage = db.prepare(`SELECT name, plate_appearances, games FROM npb_usage_2026`).all()
      .filter(r => normName(r.name).includes(key));
    if (usage.length) {
      notes.push(`2026 usageあり PA=${usage[0].plate_appearances} G=${usage[0].games}。一軍打撃台帳(v_batting)には2025年まで無し`);
    }
  } catch { /* table may be absent in some checkouts */ }
  try {
    const farm = db.prepare(
      `SELECT season, farm, player_id, name_ja, team FROM bm_player WHERE name_ja LIKE ? ORDER BY season`
    ).all(`%${name.replace(/\s+/g, '%')}%`);
    if (farm.length) {
      const last = farm[farm.length - 1];
      notes.push(`farm/bm_player id=${last.player_id} seasons=${[...new Set(farm.map(r => r.season))].join(',')} team=${last.team}`);
    }
  } catch { /* optional */ }
  return notes.join(' / ') || null;
}

/**
 * DBから引く小道具をまとめる。
 *
 * リーグ集計は年ごとに1回だけ計算して覚えておく。
 * 1枚のカードを作る間に30〜50回参照され、毎回全打者を集計すると1回117msかかって
 * カード1枚に数秒を要していた（2026-08-01に142人の較正で発覚）。
 * 年は20種類しかないので、覚えるだけで済む。
 */
/**
 * v_batting / v_bm_by_player / v_bm_bat はSQLiteのビュー（内部にROW_NUMBER窓関数とGROUP BYを持つ）。
 * ビューの外側につけたWHERE player_id=?をSQLiteはビューの中へ押し込めないため、
 * 1人分を引くたびに全件（v_battingで13,192行）を毎回作り直していた（T-0080、2026-08-04実測）。
 * 索引はビュー内部の生テーブルにしか効かず、外側の絞り込みには使われない。
 *
 * 対策: 同じ接続内でTEMP TABLEとして同名を作る。SQLiteは無修飾のテーブル名をTEMPスキーマから
 * 先に探すため、以後この接続で v_batting 等を参照するすべてのクエリ（本ファイル・durable_estimate.mjs等、
 * 一切の書き換えなしに）が自動的にこちらへ差し替わる。実測: 1クエリ38.6ms→0.019ms（約2000倍）、
 * 材料化コスト61.6ms/接続（1回だけ）。査定コード・DBファイル本体・スキーマ定義は無変更（元のVIEWも残る）。
 * データが完全一致することも実測で確認済み。
 */
function materializeHotViews(db) {
  // 同じ接続で makeContext を2回呼んでも落ちないようにする（テストが複数の文脈を作る）。
  // TEMP側に既にあるなら作り直さない＝2回目以降は何もしない
  const already = db.prepare(
    `SELECT 1 FROM temp.sqlite_master WHERE type='table' AND name='v_batting'`).get();
  if (already) return;
  db.exec(`CREATE TEMP TABLE v_batting AS SELECT * FROM v_batting`);
  db.exec(`CREATE INDEX temp.idx_vbat_pid ON v_batting(player_id, season)`);
  db.exec(`CREATE INDEX temp.idx_vbat_season ON v_batting(season)`);
  // v_bm_by_player / v_bm_bat はNPB Basement取込済みの環境にのみ存在する（無い環境でも査定は動く仕様）
  const hasBm = db.prepare(`SELECT 1 FROM sqlite_master WHERE type='view' AND name='v_bm_by_player'`).get();
  if (hasBm) {
    db.exec(`CREATE TEMP TABLE v_bm_by_player AS SELECT * FROM v_bm_by_player`);
    db.exec(`CREATE INDEX temp.idx_vbmbp_pid ON v_bm_by_player(proeye_id, season, farm)`);
    db.exec(`CREATE TEMP TABLE v_bm_bat AS SELECT * FROM v_bm_bat`);
    db.exec(`CREATE INDEX temp.idx_vbmbat_pid ON v_bm_bat(player_id, season, farm)`);
  }
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function makeContext(db, cfg) {
  materializeHotViews(db);
  const lgCache = new Map();
  const lgStmt = db.prepare(`SELECT SUM(pa) pa,SUM(ab) ab,SUM(h) h,SUM(b2) b2,SUM(b3) b3,SUM(hr) hr,
      SUM(bb) bb,SUM(hbp) hbp,SUM(sb) sb,SUM(cs) cs,SUM(sh) sh,SUM(sf) sf FROM v_batting WHERE season=?`);
  const lgOf = s => {
    if (lgCache.has(s)) return lgCache.get(s);
    const r = lgStmt.get(s);
    const v = r?.ab ? r : null;
    lgCache.set(s, v);
    return v;
  };

  const REF = lgOf(cfg.environment.reference_season);
  const refAvg = REF.h / REF.ab, refHr = REF.hr / REF.ab;

  const envCache = new Map();
  const envFactorsOf = s => {
    if (envCache.has(s)) return envCache.get(s);
    const a = lgOf(s);
    const v = a ? {
      avg: Math.pow(refAvg / (a.h / a.ab), cfg.environment.gamma_avg),
      hr: Math.pow(refHr / (a.hr / a.ab), cfg.environment.gamma_hr),
    } : null;
    envCache.set(s, v);
    return v;
  };

  // 三振・四球の分布も年ごとに1回で足りる（カードごとに全打者を引き直していた）
  const poolCache = new Map();
  const poolStmt = db.prepare(`SELECT so,bb,pa FROM v_batting WHERE season=? AND pa>=200 AND position<>'投'`);
  const poolOf = s => {
    if (!poolCache.has(s)) poolCache.set(s, poolStmt.all(s));
    return poolCache.get(s);
  };

  // SQL文は同じ文字列なら1回だけ作って使い回す。
  // node:sqlite で毎回 db.prepare() すると作った文が溜まり、呼ぶほど遅くなる
  // （142人の較正で1人目0.7秒→5人目24秒と悪化して発覚。2026-08-01）
  const stmtCache = new Map();
  const prep = sql => {
    let st = stmtCache.get(sql);
    if (!st) { st = db.prepare(sql); stmtCache.set(sql, st); }
    return st;
  };

  // 球場係数（仕様02 §4、2026-08-05 T-0103で接続）。
  // 実測は2023-2025のみ（NF3の球場別成績）。無い年は null のまま通し、推定で埋めない。
  let parkFactors = null;
  try {
    const p = path.join(ROOT, 'outputs', 'derived', 'park_factors.json');
    if (existsSync(p)) parkFactors = JSON.parse(readFileSync(p, 'utf8'));
  } catch { /* 無くても査定は動く（球場補正だけが効かない） */ }

  // 捕手の守備力と送球精度（2026-08-05）。1球データの盗塁8,867件から作った。
  //   守備力＝盗塁阻止から投手のクイック・走者の足・肩の強さを差し引いた残差
  //           （＝仕様04 §10.2「捕球からリリースまでの速さ、動作」）
  //   送球　＝盗塁を許した後の余分な進塁の少なさ（＝仕様04 §4.3「精度」）。
  //           事象が稀なので得能（有無）。45人中2人しか偶然と区別できない
  // 無くても査定は動く（捕手の守備力が null のまま＝未査定に出る）
  const loadDerived = (file) => {
    try {
      const p = path.join(ROOT, 'outputs', 'derived', file);
      return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
    } catch { return null; }
  };
  const catcherFielding = (() => {
    const j = loadDerived('catcher_fielding_rating.json');
    if (!j?.catchers) return null;
    return new Map(j.catchers.map(c => [normName(c.catcher), c]));
  })();
  // 送球（精度）の本命。DELTAが公開している**送球失策（TE）**から判定（2026-08-05）。
  // 全守備位置・2014-2026年・13,421件。1球データの悪送球（276件）より桁が大きい。
  // 検品: TE+FE と既存の失策数の突合で7,681件中7,665件（99.8%）一致。
  // キーは「名前|守備位置」（同じ選手でも位置ごとに送球の難しさが違うため）
  const throwAccuracyTe = (() => {
    const j = loadDerived('throw_accuracy_from_te.json');
    if (!j?.judged) return null;
    return new Map(j.judged.filter(x => x.ability).map(f => [`${normName(f.name)}|${f.pos}`, f]));
  })();

  // 併殺の各段階（DPS=始める / DPT=中継）と守備機会（2026-08-05 オーナー承認で守備力へ）。
  // DELTAの守備成績（日本語の位置表記）と、プロEYE球の守備機会を組み合わせる
  const doublePlayOf = (() => {
    const j = loadDerived('web_collected_measurements.json');
    const recs = Array.isArray(j) ? j : (j?.records ?? null);
    if (!recs) return null;
    const POS_JA = { '一塁手': '一', '二塁手': '二', '三塁手': '三', '遊撃手': '遊' };
    const m = new Map();
    for (const r of recs) {
      if (r.metric !== 'DPS' && r.metric !== 'DPT') continue;
      const pj = POS_JA[r.position];
      if (!pj) continue;
      const k = `${normName(r.player)}|${r.season}|${pj}`;
      if (!m.has(k)) m.set(k, {});
      m.get(k)[r.metric === 'DPS' ? 'dps' : 'dpt'] = r.value;
    }
    return m;
  })();

  // 捕球以外の失策（FE）。案2（送球得能が確定した選手だけ捕球の材料を差し替える）用（2026-08-05）。
  const feOf = (() => {
    const j = loadDerived('web_collected_measurements.json');
    const recs = Array.isArray(j) ? j : (j?.records ?? null);
    if (!recs) return null;
    const POS_JA = { '投手': '投', '捕手': '捕', '一塁手': '一', '二塁手': '二', '三塁手': '三', '遊撃手': '遊', '左翼手': '左', '中堅手': '中', '右翼手': '右' };
    const m = new Map();
    for (const r of recs) {
      if (r.metric !== 'FE' || !Number.isFinite(r.value)) continue;
      const pj = POS_JA[r.position];
      if (!pj) continue;
      m.set(`${normName(r.player)}|${r.season}|${pj}`, r.value);
    }
    return m;
  })();

  // アウト内容の割合（fly_out_pct/ground_out_pct）。弾道を2019年以前へ広げる材料
  // （2026-08-05 オーナー承認、T-0118）。NPB Basementの打球構成比が無い年の代替。
  const outContentOf = (() => {
    const j = loadDerived('web_collected_measurements.json');
    const recs = Array.isArray(j) ? j : (j?.records ?? null);
    if (!recs) return null;
    const m = new Map();
    for (const r of recs) {
      if (r.metric !== 'fly_out_pct' && r.metric !== 'ground_out_pct') continue;
      const k = `${normName(r.player)}|${r.season}`;
      if (!m.has(k)) m.set(k, {});
      m.get(k)[r.metric === 'fly_out_pct' ? 'flyOut' : 'groundOut'] = r.value;
    }
    return m;
  })();

  // 内野手の送球（精度）。内野ゴロの悪送球から判定（2026-08-05）。得能が付いた人だけを持つ。
  //
  // ★名寄せ: 1球データの野手名は**姓だけ**（「佐藤輝」「小深田」）で、同姓がいる時だけ
  //   名前の一部が足される。査定側はフルネーム（「佐藤　輝明」）なので、そのままでは結べない。
  //   そこで「1球データの名前で始まるフルネーム」を探し、**一意に決まる時だけ**結ぶ。
  //   複数該当（「佐藤」→佐藤輝明／佐藤龍世）は取り違えるので捨てる。
  const infieldThrow = (() => {
    const j = loadDerived('infield_throw_accuracy.json');
    if (!j?.judged) return null;
    const roster = db.prepare(`SELECT DISTINCT name FROM v_batting WHERE pa >= 50`).all()
      .map(r => normName(r.name));
    const out = new Map();
    const dropped = [];
    for (const f of j.judged.filter(x => x.ability)) {
      const key = normName(f.name);
      const hits = roster.filter(n => n.startsWith(key));
      if (hits.length === 1) out.set(hits[0], f);
      else dropped.push(`${f.name}(${hits.length}人に一致)`);
    }
    if (dropped.length) out.set('_dropped', dropped);   // 静かに落ちないよう記録を残す
    return out;
  })();
  const catcherThrow = (() => {
    const j = loadDerived('catcher_throw_accuracy.json');
    if (!j?.judged) return null;
    // 得能が付いた捕手だけを持つ（中間＝得能なしはキー自体を作らない）
    return new Map(j.judged.filter(x => x.ability).map(c => [normName(c.catcher), c]));
  })();

  // 金特の歴代基準（仕様05 §9）。2006-2025の実データから専用スクリプトで再生成する。
  let goldHistorical = null;
  try {
    const p = path.join(ROOT, 'outputs', 'derived', 'gold_historical_distribution.json');
    if (existsSync(p)) goldHistorical = JSON.parse(readFileSync(p, 'utf8'));
  } catch { /* 無ければ金特を未査定としてカードの unresolved に残す */ }

  // 1球データ由来の球場別打席（2020-2026）。無ければ NF3 のある年だけ球場補正が効く
  const hasParkPa = !!db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name='park_plate_appearances'`).get();

  // 二軍成績（NPB Basement）を Prior 候補にするための材料（仕様 §8.4）。
  // bm_bat は率しか持たないので、打率は SLG−ISO で復元し、打数は PA×(1−四球率) で近似する。
  // 本塁打の生数は復元できないため HR/FB% × 外野フライ% × インプレー打数 で推定する
  // （推定であることを estimated で残す）。
  const hasFarm = !!db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type IN ('view','table') AND name='v_bm_bat'`).get();
  let farmHistOf = null;
  if (hasFarm) {
    const farmCache = new Map();
    const stmt = db.prepare(`
      SELECT l.proeye_id, b.season, b.pa, b.slg, b.iso, b.bb_pct, b.k_pct, b.hr_fb_pct, b.offb_pct
      FROM v_bm_bat b JOIN player_link l ON l.bm_id = b.player_id
      WHERE b.farm = 1 AND b.pa >= 50 GROUP BY l.proeye_id, b.season`);
    let all = null;
    farmHistOf = (playerId, season) => {
      if (!all) {
        all = new Map();
        for (const f of stmt.all()) {
          if (!all.has(f.proeye_id)) all.set(f.proeye_id, []);
          all.get(f.proeye_id).push(f);
        }
      }
      const k = `${playerId}|${season}`;
      if (farmCache.has(k)) return farmCache.get(k);
      const out = [];
      for (const f of all.get(playerId) ?? []) {
        if (f.season < season - 3 || f.season > season + 3) continue;
        const L = lgOf(f.season);
        if (!L || f.slg == null || f.iso == null) continue;
        const avg = f.slg - f.iso;
        const ab = Math.round(f.pa * (1 - (f.bb_pct ?? 0) / 100 - 0.01));
        if (!(ab > 0) || !(avg >= 0)) continue;
        const inplay = ab * (1 - (f.k_pct ?? 20) / 100);
        const hrEst = inplay * ((f.offb_pct ?? 0) / 100) * ((f.hr_fb_pct ?? 0) / 100);
        const fac = envFactorsOf(f.season);
        out.push({
          season: f.season, ab, isFarm: true,
          avgEnv: avg * fac.avg, hrEnv: (hrEst / ab) * fac.hr, estimated: true,
        });
      }
      farmCache.set(k, out);
      return out;
    };
  }

  // 球場の改称・表記ゆれの対応表（命名権の変更で同じ建物の呼び方が変わるため）
  let parkAliases = null;
  try {
    const p = path.join(ROOT, 'configs', 'park_aliases.json');
    if (existsSync(p)) parkAliases = JSON.parse(readFileSync(p, 'utf8'));
  } catch { /* 無くても動くが、改称をまたぐ年の補正が効かなくなる */ }

  return { db, prep, lgOf, refAvg, refHr, envFactorsOf, poolOf, parkFactors, goldHistorical,
    catcherFielding, catcherThrow, infieldThrow, throwAccuracyTe, doublePlayOf, outContentOf, feOf, hasParkPa, parkAliases, farmHistOf };
}

/**
 * 球場係数を「その年の平均が1.0」に揃える（2026-08-05）。
 *
 * なぜ要るか: 球場補正は**球場どうしの差**を表すもので、リーグ全体の水準を動かしてはいけない。
 * ところが集めた係数の平均は年によって 0.925〜1.055 とばらついていた。平均が0.925の年は
 * 全選手の本塁打が一律に8%割り増しされ、リーグ全体のパワーが底上げされる。
 * 実際、査定の経路を統一した直後にシミュレーションの本塁打が +3.25% ずれた。
 *
 * 揃え方: その年に実際に何打席がどの球場で行われたかで加重平均を取り、それで全係数を割る。
 * 打席の内訳が無い年（2019年以前）は単純平均で代用し、代用したことを戻り値に残す。
 */
function normalizeParkTable(ctx, table, season) {
  if (!table?.parks) return table;
  const keys = Object.keys(table.parks);
  if (!keys.length) return table;
  const key = s => String(s ?? '').replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[\s　]/g, '');
  const toCanon = new Map();
  for (const a of ctx.parkAliases?.aliases ?? []) {
    for (const n of [a.canonical, ...(a.also ?? [])]) toCanon.set(key(n), key(a.canonical));
  }
  const canon = s => toCanon.get(key(s)) ?? key(s);

  let mean = null, basis = 'simple';
  if (ctx.hasParkPa) {
    const pa = ctx.prep(`SELECT park, SUM(plate_appearances) n FROM park_plate_appearances
      WHERE season = ? GROUP BY park`).all(season);
    const m = new Map(keys.map(k => [canon(k), table.parks[k].factor]));
    let w = 0, n = 0;
    for (const r of pa) { const f = m.get(canon(r.park)); if (f > 0) { w += f * r.n; n += r.n; } }
    if (n > 0) { mean = w / n; basis = 'plate_appearances'; }
  }
  if (mean == null) mean = keys.reduce((s, k) => s + table.parks[k].factor, 0) / keys.length;
  if (!(mean > 0)) return table;

  const parks = {};
  for (const k of keys) parks[k] = { ...table.parks[k], factor: table.parks[k].factor / mean };
  return { parks, _normalized: { mean, basis } };
}

/**
 * 球場ごとの打席の内訳を1球データから引く（2020-2026）。
 * NF3の球場別成績（打数、2023-2025）が無い年の受け皿。
 * 表が無ければ null を返す＝球場補正なしで通る（推定で埋めない）。
 * 出典: Nippon Baseball Data Repository (MIT License)
 */
function parkSplitFromPbp(ctx, name, season) {
  if (!ctx.hasParkPa) return null;
  const rows = ctx.prep(`
    SELECT park, plate_appearances FROM park_plate_appearances
    WHERE name_norm = ? AND season = ?`).all(normName(name), season);
  if (!rows.length) return null;
  // playerParkFactor は重みを AB という名前で受け取る（打席で代用してよいことは実測済み）
  return rows.map(r => ({ park: r.park, AB: r.plate_appearances }));
}

const toLine = p => ({
  PA: p.pa, AB: p.ab, H: p.h, B2: p.b2, B3: p.b3, HR: p.hr, BB: p.bb,
  HBP: p.hbp, SO: p.so, SH: p.sh, SF: p.sf, GDP: p.gdp, SB: p.sb, CS: p.cs,
});

/**
 * 1選手のカードを査定して返す。
 * @param {object} ctx makeContext の戻り
 * @param {object} opts {name|playerId, mode: 'peak'|'prime'|<年>, cfg, rv, runNorm, fldNorm}
 * @returns {{card, meta}} 失敗時は {error}
 */
export function appraiseCard(ctx, opts) {
  const { db, prep: prep_, lgOf, refAvg, refHr, envFactorsOf, poolOf, goldHistorical = null } = ctx;
  const prep = prep_ ?? (sql => prep(sql));
  const { name, playerId, mode, cfg, rv, runNorm, fldNorm, seasonRange = null,
    maxSeason = null,            // 時間ホールドアウト用の上限（既定=制限なし）T-0198
    // ★relative model候補（2026-08-13、正本22 §5-C）。既定=false＝**productionの挙動は変えない**。
    //   true にすると走力のNPB+自動blendを行わず、較正済み統計モデルをprimaryにする。
    //   T-0203が判定C（統計材料が薄い層を推定できず増分を確認できない）だったため、
    //   自動blendは採用しない方針の候補。NPB+のraw値は削除しない（review evidenceとして保持）。
    statPrimarySpeed = false,
    // SP-016是正（2026-08-13）: 年度査定はcurrent-year中心（owner rule）。既定を true へ反転。
    //   sufficientWeight既定=50打席＝同時点信頼性(標本誤差<選手間分散)が最初に0.5を超える点
    //   （docs/audits/sp016_current_year_first_audit.md §2、翌年情報を使わない導出）。
    //   50/150/300/443での感度は同ファイル§3に保存済み（単一値の決め打ちではない）。
    //   故障・明らかな下振れ・temporal bridgingによる例外は、年齢/生年月日/故障データが
    //   現状存在しないため未実装（SP-044/SP-045 BLOCKED_MISSING_DATA）。
    //   legacy再現には currentYearFirst:false を明示的に渡す（比較専用）。
    //
    // ★★ WORKING DEFAULT — 最終設計として凍結していない（2026-08-13 オーナー指摘）
    //   この 50 は hard gate（閾値の上下で挙動が不連続に変わる形）である。実測では
    //   境界帯(25-100打席)の選手が1打席の差で平均9.93点・最大33.6点の落差を受けうる。
    //   連続形（w_cur = PA/(PA+κ) 等）ならこの落差は0になり、同じκ=50較正点を持つ
    //   連続版の方が構造的に良い形であることも確認済み。
    //   最終形（PA一括 or 材料別、κの値）の決定には「多年poolに構造的に有利でない」
    //   判定基準が要り、現時点でそれが無いため hard gate を暫定継続している。
    //   詳細と決着条件 = docs/audits/sp016_hard_gate_vs_continuous_20260813.md
    currentYearFirst = true, sufficientWeight = 50 } = opts;

  let pid = playerId;
  if (!pid) {
    const seasonHint = mode === 'peak' || mode === 'prime' ? null : Number(mode);
    const r = resolveName(db, name, { team: opts.team, season: Number.isFinite(seasonHint) ? seasonHint : null });
    if (r.error) return { error: r.error };
    pid = r.playerId;
  }

  let sql = `SELECT * FROM v_batting WHERE player_id=? AND position <> '投'`;
  const args = [pid];
  if (seasonRange) { sql += ` AND season BETWEEN ? AND ?`; args.push(seasonRange[0], seasonRange[1]); }
  const all = prep(sql + ' ORDER BY season').all(...args);
  if (!all.length) return { error: `該当なし: ${name ?? playerId}${seasonRange ? `（${seasonRange.join('-')}年）` : ''}` };

  const seasons = all.map(p => ({
    season: p.season, position: p.position, line: toLine(p),
    lgRate: leagueRates(lgOf(p.season)), envFactors: envFactorsOf(p.season),
  }));

  let cardType, seasonLabel, seasonsUsed, line, formula = null, targetSeason;
  if (mode === 'prime') {
    const win = selectPrimeWindow(seasons, rv, { windowYears: 3, minPaPerYear: 200 });
    if (!win) return { error: '全盛期の窓が取れない（連続3年で各200打席以上が必要）' };
    const c = buildPrimeCompositeCard(win);
    cardType = 'prime_composite'; seasonLabel = null; seasonsUsed = c.seasonsUsed;
    line = c.line; formula = c.formula; targetSeason = win.end;
  } else {
    const ranked = rankSeasons(seasons, rv, { mode: 'total' });
    const c = buildPeakYearCard(ranked, { mode: 'total' });
    const y = mode === 'peak' ? c.seasonLabel : Number(mode);
    const s = seasons.find(x => x.season === y);
    if (!s) return { error: `${y}年のデータなし（あるのは ${seasons.map(x => x.season).join(', ')}）` };
    cardType = 'peak_single_year'; seasonLabel = y; seasonsUsed = [y]; line = s.line; targetSeason = y;
  }

  const p = all.find(x => x.season === targetSeason) ?? all[all.length - 1];

  // 対象年の打数0は「打撃サンプルが無い」であってパイプライン例外ではない（SP-098 塩見泰隆2025）。
  // ★review修正(2026-08-14): 「打撃データが無い」と「他能力を査定しない」を混同しない。
  //   Grok初版は arm を捨て・fld を [] 固定し・buildCard を迂回していた。実測で
  //   (a)塩見2025は durable.arm z=0.387 が算出可能なのに肩力null (b)AB=0の16選手シーズン中
  //   12件が同年に守備イニングを持つ (c)card schemaが正常系24キー→5キーへ縮退し
  //   player_id が card.player.player_id へ潜る、の3点を確認したため修正する。
  if (!(line.AB > 0)) {
    const durable = estimateDurableTraits(db, p.player_id, targetSeason,
      { cfg, runNorm, fldNorm, lgOf, envFactorsOf, maxSeason, currentYearFirst, sufficientWeight });
    const speedVal = durable.speed?.z == null ? null : speedRating(durable.speed.z, cfg);
    const run0 = speedVal == null ? null : { speed: speedVal, speedDetail: durable.speed };

    // 守備は打撃とは別系統。打数0でも守備イニングがあれば査定する。
    // 注: 併殺内訳・捕逸・捕手フレーミングの加算は正常系のみ（この母集団は最大3イニングで
    //     加算の寄与が無く、78行の重複を避けるため）。適用外であることを unresolved に明示する。
    const fldRows0 = prep(`
      SELECT f.season, f.pos, f.inn, f.rngr, f.errr, f.arm, f.dpr, f.framing, f.blocking
      FROM bm_fld f JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
      WHERE l.proeye_id=? AND f.season=? AND f.farm=0 AND f.inn>0`).all(p.player_id, targetSeason);
    const fld0 = fldRows0.length ? appraiseAllPositions(fldRows0, durable.speed?.z ?? 0, fldNorm, cfg) : [];

    // durable.arm は生のz。正常系と同じ traitRating を通してから渡す（素のzを渡すと肩力nullになる）
    const armTrait0 = durable.arm ? traitRating(
      durable.arm, cfg.fielding.kappa_innings_arm ?? cfg.fielding.kappa_innings_range,
      cfg.zscore_ratings.arm, cfg.clamp, clamp) : null;
    const armForSheet0 = armTrait0 && {
      ...armTrait0, is_estimated: false,
      basis: durable.arm.basis, components: durable.arm.components,
    };
    if (armForSheet0) for (const f of fld0) f.arm = armForSheet0;

    const abilitySheet = buildAbilitySheet(
      { bat: null, run: run0, fld: fld0, splits: null, arm: armForSheet0 }, cfg);

    const card = buildCard({
      player: {
        player_id: p.player_id, name_ja: p.name.replace(/　/g, ' '), team: p.team,
        league: leagueOf(p.team), primary_position: p.position,
        secondary_positions: fld0.filter(f => f.pos !== p.position).map(f => f.pos),
        team_games: 143,
      },
      cardType, seasonLabel, seasonsUsed,
      ratings: null,
      calcLog: null,
      confidence: { batting: 'NO_SAMPLE', speed: durable.speed ? 'POOLED' : 'NONE',
        arm: durable.arm ? 'POOLED' : 'NONE', fielding: fld0.length ? 'LOW_INNINGS' : 'NONE' },
      unresolved: [
        '対象年の打数が0。打撃査定は出さない（走力・肩力・守備は算出する）',
        ...(fldRows0.length ? ['守備の併殺内訳・捕逸・捕手フレーミング加算はこの経路では未適用'] : []),
      ],
    });
    card.abilities = abilitySheet;
    card.speedDetail = durable.speed ?? null;
    card._no_batting_sample = true;
    return { card, batting: null, meta: { targetSeason, noBattingSample: true, hasBasement: false } };
  }

  const L = lgOf(targetSeason);
  const env = { lgAvg: L.h / L.ab, lgHrRate: L.hr / L.ab, refAvg, refHrRate: refHr };

  const pool = poolOf ? poolOf(targetSeason) : prep().all(targetSeason);
  const dists = { contact: fitLogDist(pool.map(r => r.so / r.pa)), eye: fitLogDist(pool.map(r => r.bb / r.pa)) };

  const hist = prep(`SELECT season, ab, h, hr FROM v_batting WHERE player_id=? AND season BETWEEN ? AND ? AND ab>0`)
    .all(p.player_id, targetSeason - 3, targetSeason + 3)
    .filter(h => lgOf(h.season))
    .map(h => {
      const f = envFactorsOf(h.season);
      return { season: h.season, ab: h.ab, isFarm: false, avgEnv: (h.h / h.ab) * f.avg, hrEnv: (h.hr / h.ab) * f.hr };
    });
  // 二軍成績も Prior の候補に加える（仕様 §8.4 新人・ブレイク初年度）。
  // ★2026-08-05に移植: シーズン一括査定にはこの経路があったのに、カード査定には無かった。
  //   一軍の成績が少ない選手ほど、二軍の成績が無いとリーグ平均へ寄ってしまう。
  if (ctx.farmHistOf) hist.push(...ctx.farmHistOf(p.player_id, targetSeason));
  const prior = selectPrior({ season: targetSeason, ab: line.AB }, hist, { avg: refAvg, hr: refHr }, cfg.shrinkage);

  // ---- 分割成績（NF3）と文脈の階層 ----
  // ★査定より前に決める（2026-08-05 T-0102の修理）。
  //   以前はここが appraiseBatting の**後ろ**にあり、階層をTier Bと判定しながら
  //   ミートの計算には総合打率を渡していた（判定は動くが結果に効いていない状態）。
  // 単年カードは対象年の分割だけを使う。合成カードは合成の重みが別なので使わない（混ぜない）
  const splits = cardType === 'peak_single_year' ? loadSplits(db, p.player_id, targetSeason) : null;
  const ctxSel = selectContext({
    total: { AB: line.AB, H: line.H },
    vsR: splits?.vsR, vsL: splits?.vsL, risp: splits?.risp, nonRisp: splits?.nonRisp,
    // 交差セルは公開データに無い。周辺値から作らない（仕様02 §5.1 REJECTED）
    vsR_nonRisp: null,
  });

  // 文脈打率を使うのは、リーグ平均も同じ文脈で作れる時だけ（仕様02 §92「文脈を一致させる」）。
  // 片側だけ切り替えると「対右の打率 ÷ 総合のリーグ平均」になり、右打者が構造的に低く出る。
  const ctxLabel = ctxSel.tier === 'B' ? '対右投手' : null;
  const lgCtx = ctxLabel ? loadLeagueSplitAverage(db, targetSeason, ctxLabel) : null;
  // ★基準年（2019年）のリーグ平均も同じ文脈で取る（2026-08-05 オーナー指摘で修理）。
  //   これが無いと「対象年は対右／基準年は総合」で比べることになり、環境の差が実際より
  //   小さく見積もられていた（2024年で3.79%と出ていたが、対右どうしなら4.67%）。
  const lgCtxRef = ctxLabel ? loadLeagueSplitAverage(db, cfg.environment.reference_season, ctxLabel) : null;
  const contextAvg = (ctxLabel && lgCtx)
    ? {
      avg: ctxSel.avg, AB: ctxSel.AB, tier: ctxSel.tier, lgAvg: lgCtx.avg, lgBasis: lgCtx,
      refAvg: lgCtxRef?.avg ?? null, refBasis: lgCtxRef ?? null,
    }
    : null;

  // 球場補正（仕様02 §4、2026-08-05 T-0103で接続）。係数は2023-2025の実測のみで、
  // それ以外の年は parkFactors が無く null になる＝補正なしで通る（推定で埋めない）
  // 年別の球場係数があればそれを使う（2026-08-05、Web収集で2006-2022年を追加）。
  // 自前の実測は2023-2025の3年平均なので、その範囲はこれまでどおり実測を使う。
  // それ以前は収集値を「幅だけ実測へ揃えた」もの（詳細は park_factors.json の historical）。
  const parkTable = normalizeParkTable(ctx, (() => {
    const hist = ctx.parkFactors?.historical?.bySeason?.[String(targetSeason)];
    if (hist) return { parks: hist };
    return ctx.parkFactors?.hr;
  })(), targetSeason);
  // 球場ごとの内訳は2つの経路がある。NF3（打数、2023-2025）を優先し、無い年は
  // 1球データ（打席、2020-2026）で補う。**打席で代用してよいことは実測済み**——
  // 同じ選手で重みを打数→打席に変えても係数の差は90%点で0.013（30本打つ選手で0.38本ぶん）、
  // 1球データの内訳とNF3の内訳の一致も球場あたりの打席差が90%点で1
  // （scripts/verify_park_pa_as_weight.mjs）。これで2020-2022も補正できるようになった。
  const parkSplit = splits?.park?.length ? splits.park : parkSplitFromPbp(ctx, p.name, targetSeason);
  const parkFactor = playerParkFactor(parkSplit, parkTable, ctx.parkAliases);

  const bat = appraiseBatting(line, cfg, dists, env, { useIsoBlend: true, prior, contextAvg, parkFactor });

  // ---- 身体能力は複数年で均す（2026-08-01 オーナー指摘への対応。詳細は durable_traits.mjs）----
  // 走る速さ・肩の強さは年でほとんど変わらないのに、1年分の観測だけで査定すると
  // 観測のブレがそのまま能力差として出る（西川龍馬の走力が年により F〜D で振れていた）。
  // 肩はさらに材料を2つ（ARMと補殺）使う——ARM単独では強肩ほど走者が走ってこず機会が減るため。
  const durable = estimateDurableTraits(db, p.player_id, targetSeason,
    { cfg, runNorm, fldNorm, lgOf, envFactorsOf, maxSeason, currentYearFirst, sufficientWeight });

  const bm = prep(`
    SELECT b.ubr, b.wsb, m.gb_pct, m.ld_pct, m.offb_pct, m.iffb_pct FROM v_bm_by_player b
    LEFT JOIN player_link l ON l.proeye_id=b.proeye_id AND l.season=b.season
    LEFT JOIN v_bm_bat m ON m.player_id=l.bm_id AND m.season=b.season AND m.farm=0
    WHERE b.proeye_id=? AND b.season=? AND b.farm=0`).get(p.player_id, targetSeason);

  // 内野安打（仕様04 §1.2 第3階層）。NF3の球団別ページから 2005-2025 で取れる
  const ihRow = prep(`
    SELECT t.ih, t.bats FROM nf3_team_bat t
    JOIN nf3_team_link l ON l.season = t.season AND l.name_norm = t.name_norm
    WHERE l.proeye_id = ? AND t.season = ?`).get(p.player_id, targetSeason);

  let run = null;
  let infieldHitSpecial = null;
  if (bm) {
    const adv = advanceOf(db, normName(p.name), targetSeason);
    const sc = speedComponents(line, { gbPct: bm.gb_pct, infieldHits: ihRow?.ih ?? null, bats: ihRow?.bats ?? null, season: targetSeason, advance: adv?.value ?? null, advanceChances: adv?.chances ?? 0 }, bm.ubr, runNorm);
    const ihNorm = ihRow?.bats == null ? null
      : runNorm.infieldHit?.byCell?.[`${targetSeason}|${ihRow.bats}`]
        ?? runNorm.infieldHit?.bySeason?.[targetSeason]
        ?? null;
    // NF3内野安打率から同年・同打席の平均を引いた「超過」を実データで作る。
    // infieldHitAbility 側で、さらに走力zで説明できる分を除いて得能を判定する。
    const gbSingleExcess = sc.raw.infieldHit != null && ihNorm
      ? sc.raw.infieldHit - ihNorm.mean
      : null;
    infieldHitSpecial = infieldHitAbility(gbSingleExcess, sc.score, cfg);
    // 走力は多年で均した推定を使う（単年だと観測のブレが能力差として出る）
    const pooledSpeed = durable.speed ?? { z: sc.score, weight: line.PA, years: 1, seasons: [targetSeason], isMultiYear: false };
    run = {
      speed: speedRating(pooledSpeed.z, cfg),
      speedDetail: pooledSpeed,
      stealing: stealingAbility({ SB: line.SB, CS: line.CS, PA: line.PA }, bm.wsb, sc.score, runNorm, cfg),
      // 走塁得能には自作の走塁指標も渡す（仕様04 §3が名指しする材料。走力に対する残差として使う）
      baserunning: baserunningAbility(bm.ubr != null ? bm.ubr / line.PA : null, sc.score, runNorm, cfg,
        { advance: adv?.value ?? null, advanceChances: adv?.chances ?? 0 }),
      _z: sc.score,
      _infieldHitExcess: gbSingleExcess,
    };
  }
  const fldRows = prep(`
    SELECT f.season, f.pos, f.inn, f.rngr, f.errr, f.arm, f.dpr, f.framing, f.blocking
    FROM bm_fld f JOIN player_link l ON l.bm_id=f.player_id AND l.season=f.season
    WHERE l.proeye_id=? AND f.season=? AND f.farm=0 AND f.inn>0`).all(p.player_id, targetSeason);

  // 併殺の各段階・守備機会・FE（送球以外の失策）を守備の行へ足す（2026-08-05 オーナー承認）。
  // 守備機会（刺殺＋補殺＋失策）はプロEYE球側にしか無く、DPS/DPTやFEを率へ直すのに要る。
  // 位置の表記が経路で違う（bm_fld は SS/2B/RF…、プロEYE球とDELTAは 遊/二/右…）ので寄せる。
  {
    const POS_JA = { '1B': '一', '2B': '二', '3B': '三', 'SS': '遊', 'LF': '左', 'CF': '中', 'RF': '右', 'C': '捕', 'P': '投' };
    for (const f of fldRows) {
      const pj = POS_JA[f.pos];
      if (!pj) continue;
      const ch = prep(`SELECT po, a, e FROM v_fielding
        WHERE player_id=? AND season=? AND position=?`).get(p.player_id, targetSeason, pj);
      if (ch) f.chances = (ch.po ?? 0) + (ch.a ?? 0) + (ch.e ?? 0);
      const dp = ctx.doublePlayOf?.get(`${normName(p.name)}|${targetSeason}|${pj}`);
      if (dp) { f.dps = dp.dps ?? null; f.dpt = dp.dpt ?? null; }
      // 案2: 送球得能（TE基準）が確定している選手だけ、捕球の材料をFEへ差し替える
      const hasThrowAbility = ctx.throwAccuracyTe?.get(`${normName(p.name)}|${pj}`);
      if (hasThrowAbility) {
        const feVal = ctx.feOf?.get(`${normName(p.name)}|${targetSeason}|${pj}`);
        // ★fld.pos は bm_fld由来の英語表記(2B等)、norm.fe.byPosのキーはv_fielding由来の
        //   日本語表記(二等)。fld.pos をそのまま使うと引けずに黙って通常のErrRへ落ちる
        //   （実際に一度これで踏んだ）ので、日本語表記を別キーで持たせる
        if (feVal != null) { f.fe = feVal; f.useFeCatching = true; f.fePos = pj; }
      }
    }
  }

  // 捕手の捕球は捕逸で測る（2026-08-05 オーナー裁定）。捕逸はプロEYE球側にあり、
  // NPB Basement（bm_fld）には無い。**2006年から取れる**のが差し替えの主目的。
  //
  // ★ここで bm_fld の行に値を足すだけでは不十分だった（2026-08-05に実データで発覚）:
  //   bm_fld は2020年以降しか無いので、2019年以前は fldRows が空＝**捕手の行そのものが作られず**、
  //   捕逸を持っていても査定に入らない。実例＝小林誠司2015は捕逸3・68試合のデータがあるのに
  //   守備が丸ごと null だった。被覆の拡大という差し替えの主目的がここで消えていた。
  //   → bm_fld に捕手の行が無く、捕逸だけある年は**捕逸だけの守備行を作る**。
  //      守備範囲・失策・肩は null のまま（欠損を0で埋めない）。
  const pbRow = prep(`
    SELECT g, pb FROM v_fielding
    WHERE player_id=? AND season=? AND position='捕' AND pb IS NOT NULL`).get(p.player_id, targetSeason);
  if (pbRow) {
    const cRow = fldRows.find(f => f.pos === 'C');
    if (cRow) { cRow.pb = pbRow.pb; cRow.g = pbRow.g; }
    else {
      fldRows.push({
        season: targetSeason, pos: 'C', inn: 0,
        rngr: null, errr: null, arm: null, dpr: null, framing: null, blocking: null,
        pb: pbRow.pb, g: pbRow.g,
        _from: 'passed_ball_only',
        _note: 'NPB Basementに守備データが無い年（2019年以前）。捕逸だけで捕球を査定する。'
          + '守備力・肩力は材料が無いのでnullのまま（未査定に出る）',
      });
    }
  }

  const fld = fldRows.length ? appraiseAllPositions(fldRows, run?._z ?? 0, fldNorm, cfg) : [];

  // 捕手の守備力を差し込む（2026-08-05）。
  // 守備範囲（RngR）は捕手に存在せず `fieldingRating` が必ず null を返すので、ここで埋める。
  // 仕様04 §10.2 が定める「捕球からリリースまでの速さ」＝盗塁阻止から投手・走者・肩を
  // 差し引いた残差。肩を引いてあるので肩力との二重計上にならない。
  const catcherFld = ctx.catcherFielding?.get(normName(p.name));
  if (catcherFld) {
    const cRow = fld.find(f => f.pos === 'C');
    if (cRow && cRow.fielding == null) {
      cRow.fielding = {
        rating: catcherFld.rating,
        material: 'catcher_steal_residual',
        events: catcherFld.events,
        throw_speed: catcherFld.throw_speed,
        residual: catcherFld.residual,
        _note: '盗塁阻止から投手のクイック・走者の足・肩の強さを差し引いた残差'
          + `（${catcherFld.events}件）。仕様04 §10.2「捕球からリリースまでの速さ、動作」。`
          + '★暫定——採否の正式な物差し（エンジンでのリーグ分布一致）は未実装',
      };
    }
  }

  // ---- チャンス・対左の素点（splits と ctxSel は査定の前で決めてある） ----
  const clutch = splits ? clutchDifferential(splits.risp, splits.nonRisp) : null;
  const platoon = splits ? plattonDifferential(splits.vsL, splits.vsR) : null;

  // 実装済み得能3種をカード生成へ接続する。
  const strikeoutSpecial = strikeoutAbility(bat.contact, cfg);
  const rawHrPer500 = line.AB > 0 ? (line.HR / line.AB) * cfg.ab_ref.value : null;
  const goldMetrics = line.AB > 0 ? {
    hrPer500: applyEnvironment(
      line.HR / line.AB, env.lgHrRate, env.refHrRate, gammaForLevel(rawHrPer500, cfg),
    ) * cfg.ab_ref.value,
    avgEnv: applyEnvironment(
      line.H / line.AB, env.lgAvg, env.refAvg, cfg.environment.gamma_avg,
    ),
  } : {};
  const goldSpecials = goldHistorical
    ? goldSpecialAbilities(goldMetrics, goldHistorical, cfg)
    : [];

  // 得能付与Phase3b（2026-08-04）: チャンス・対左の素点を平均得能込み基準から差し引き、
  // 基礎能力（ミート・パワー）へ実際に反映する（仕様02 §2/§13、05 §1-4）
  const meetLedger = buildMeetLedger(bat.meet, {
    contextTier: ctxSel.tier, infieldHitAbility: infieldHitSpecial,
    rawTotalAvg: bat.observed?.raw?.avg ?? null, env, prior, AB: line.AB, clutch, platoon,
  }, cfg);
  const powerLedger = buildPowerLedger(bat.power, {
    rawHrPerAb: line.AB > 0 ? line.HR / line.AB : null,
    env, prior, gammaUsed: bat.observed?.gammaUsed ?? null, AB: line.AB, platoon,
  }, cfg);
  const ledgers = [meetLedger, powerLedger];
  // 台帳を通した後の値。カード表示（ratings・能力欄）はこちらを使う。calcLogのbaselineは調整前のbatを使う。
  // appraiseBattingの出力（bat.meet/power）と同じ丸め桁（round1）に揃える
  const batAdjusted = { ...bat, meet: r1(meetLedger.final), power: r1(powerLedger.final) };

  const provisional = [
    cfg.power_iso_blend ? 1 : 0,
    cfg.trajectory ? 1 : 0,
    fld.length ? 1 : 0,
    cfg.environment._gamma_by_level?.enabled ? 0 : 1,
    fld.some(f => f.arm?.is_estimated) ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const confidence = assessConfidence({
    pa: line.PA, contextTier: ctxSel.tier, priorKind: prior.kind,
    hasTracking: false, hasFieldingData: fld.length > 0, provisionalCoeffs: provisional,
  });

  // 仕様03 §1.1 値ごとの出典。打撃はプロEYE球、走塁・守備はNPB Basement、肩の推定は導出値
  const S = SOURCES;
  const meetAdjNote = meetLedger.totalDelta !== 0
    ? `平均得能込み基準${bat.meet}からチャンス・対左ぶんを台帳で調整（差分${meetLedger.totalDelta.toFixed(1)}、仕様05 §2）` : null;
  const powerAdjNote = powerLedger.totalDelta !== 0
    ? `平均得能込み基準${bat.power}から対左ぶんを台帳で調整（差分${powerLedger.totalDelta.toFixed(1)}、仕様05 §2/§4）` : null;
  const provenanceByValue = {
    meet: withProvenance(batAdjusted.meet, S.proeye, {
      season: targetSeason,
      context: `文脈Tier ${ctxSel.tier}（${ctxSel.basis}）`,
      notes: meetAdjNote,
    }),
    power: withProvenance(batAdjusted.power, S.proeye, {
      season: targetSeason,
      context: splits ? '総合（対左右のHR率差を台帳で調整）' : '総合',
      notes: powerAdjNote,
    }),
    contact: withProvenance(bat.contact, S.proeye, { season: targetSeason }),
    eye: withProvenance(bat.eye, S.proeye, { season: targetSeason }),
    ...(run ? {
      speed: withProvenance(r1(run.speed), S.basement, {
        season: targetSeason, isEstimated: true,
        method: 'Sprint Speedが無いためUBR・三塁打率・内野安打から推定（仕様04 §1の第2-3階層）',
      }),
      stealing: withProvenance(r1(run.stealing?.rating), S.basement, { season: targetSeason }),
      baserunning: withProvenance(r1(run.baserunning?.rating), S.basement, { season: targetSeason }),
    } : {}),
    ...Object.fromEntries(fld.map(f => [`fielding_${f.pos}`, withProvenance(
      { fielding: r1(f.fielding?.rating), catching: r1(f.catching?.rating), arm: r1(f.arm?.rating) },
      f.arm?.is_estimated ? S.derived : S.basement,
      {
        season: targetSeason,
        isEstimated: !!f.arm?.is_estimated,
        method: f.arm?.is_estimated ? f.arm.estimation_method : null,
        notes: f.arm?.is_estimated ? f.arm.basis : null,
      })])),
  };

  // 肩力は多年＋2つの材料（ARMと補殺）から推定する。
  // ARM単独では強肩を捉えきれない（強肩ほど走者が走ってこないので機会が減る）。
  // 実測: 翌年のARMを当てる力は ARMだけ0.219／補殺だけ0.263／2つの平均0.280。
  // 補殺は2006年から取れるので、NPB Basementの範囲外の年でも肩が査定できる。
  const armTrait = traitRating(
    durable.arm, cfg.fielding.kappa_innings_arm ?? cfg.fielding.kappa_innings_range,
    cfg.zscore_ratings.arm, cfg.clamp, clamp);
  // 肩は選手の属性。その年の守備データが無くても、補殺は2006年から取れるので出せる
  const armForSheet = armTrait && {
    ...armTrait, is_estimated: false,
    basis: durable.arm.basis, components: durable.arm.components,
  };
  if (armForSheet) for (const f of fld) f.arm = armForSheet;

  // ゲーム側の約束（仕様02 §6.6）。査定値は書き換えず、表示用の値を別に持つ。
  // 台帳反映後（batAdjusted）のパワーに対して適用する——ゲーム側の下限は「最終的に査定した値」に効くべきもので、
  // 得能反映前の暫定値に効かせると二重の慣習補正になる
  const conventions = applyGameConventions(
    { power: batAdjusted.power },
    { season: targetSeason, isPitcher: false, isSpecialCard: cardType === 'prime_composite' },
    cfg);

  // 弾道（仕様02 §7）。打球のゴロ／ライナー／フライの構成比から逆算する。
  // 実測（NPB Basement、2020年以降）を優先する。
  let trajectory = null, trajectoryEstimated = false, trajectorySource = null;
  if (bm && bm.gb_pct != null && bm.offb_pct != null && bm.iffb_pct != null) {
    trajectory = trajectoryFromShares({
      gb: bm.gb_pct / 100, ld: (bm.ld_pct ?? 0) / 100,
      offb: bm.offb_pct / 100, iffb: bm.iffb_pct / 100,
    }, cfg);
    trajectorySource = 'NPB Basement（実測の打球構成比）';
  } else {
    // 実測が無い年（主に2019年以前）は、アウト内容の割合から推定する
    // （2026-08-05 オーナー承認、T-0118）。「アウトのうちフライ率」等は「全打球のうちの割合」と
    // 定義が違うため、重複期間(2020-2022)で較正した変換式（calibrate_batted_ball_conversion.mjs）を通す。
    // ★推定値であり実測ではない。trajectoryEstimated フラグを立て、実測とは区別する
    const oc = ctx.outContentOf?.get(`${normName(p.name)}|${targetSeason}`);
    const conv = cfg.batted_ball_conversion?.models;
    if (oc?.flyOut != null && oc?.groundOut != null && conv) {
      const pred = {};
      for (const [label, key] of [['gb_pct', 'gb'], ['ld_pct', 'ld'], ['offb_pct', 'offb'], ['iffb_pct', 'iffb']]) {
        const m = conv[label];
        if (!m) continue;
        pred[key] = m.intercept + m.slope_fly * oc.flyOut + m.slope_ground * oc.groundOut;
      }
      if (pred.gb != null && pred.offb != null && pred.iffb != null) {
        trajectory = trajectoryFromShares({ gb: pred.gb / 100, ld: (pred.ld ?? 0) / 100, offb: pred.offb / 100, iffb: pred.iffb / 100 }, cfg);
        trajectoryEstimated = true;
        trajectorySource = `推定（アウト内容の割合から変換。フライ${oc.flyOut}% ゴロ${oc.groundOut}%）`;
      }
    }
  }

  // けがしにくさ（仕様02 §8.2「稼働率は能力へ加点せず、ケガしにくさへ」）
  const durability = durabilityRate(line.PA, 143, cfg);

  // スカウティング評価（仕様04 §1.2 第2階層）との突き合わせ。
  // 統計は「走塁の成果」、スカウティングは「脚力そのもの」で別の量。片方で上書きせず両方残す
  const scout = opts.scoutingLedger ?? null;
  const dbName = p.name;
  const runRec = scout ? scoutReconcile(r1(run?.speed), scoutLookup(scout, dbName, targetSeason, '走力')) : null;
  const armRec = scout ? scoutReconcile(r1(armForSheet?.rating), scoutLookup(scout, dbName, targetSeason, '肩力')) : null;

  // ---- 直接計測（第1階層）を能力欄へ届ける ----
  // ★2026-08-05修理: これまで直接計測の組み立ては能力欄の**後ろ**（旧522-529行）にあり、
  //   `ability_evidence` に posterior_rating を出しても**能力値は1点も動かなかった**
  //   （カードに印字されるだけのフィールドだった。監査で「消費側がコード内にゼロ」と指摘された点）。
  //   証拠を先に組み立て、能力欄へ渡す。
  // 現在つながっているのは**捕手の肩力（NPB+の送球速度）だけ**。走力（MLB Sprint Speed）は
  //   置き換えると現行より悪化する実測があるため保留（T-0107で設計してから繋ぐ）。
  const bridgeRow = (() => {
    try {
      return db.prepare(`SELECT sprint_speed_avg, sprint_years, arm_mph_avg, arm_years, detail
                         FROM mlb_bridge WHERE proeye_id=?`).get(p.player_id) ?? null;
    } catch { return null; }   // mlb_bridge が無いDBでも査定は動く
  })();

  // 捕手の送球速度（NPB+アプリ、オーナー撮影）。2026-08-05 オーナー裁定で肩力へ接続。
  // ★捕手だけに適用する——守備位置で層別すると捕手 r=0.676 / 内野 +0.137 / 外野 -0.135 と
  //   層で符号すら違い、混ぜると打ち消し合って全体 r=0.036 になる（層別漏れをCCが一度やった）。
  const npbPlusRow = (() => {
    try {
      // ★2026-08-05修理: ここは捕手の送球速度だけを取る作りだった。
      //   パワー・走力の実測（打球速度・ハードヒット率・瞬間最高速度など）を足したので、
      //   全選手・全項目を取る。送球速度だけは捕手にしか使わないので、その印だけ残す。
      const r = db.prepare(`SELECT * FROM npb_plus_measurement WHERE player_id=?`).get(p.player_id);
      if (!r) return null;
      const isCatcher = fldRows.some(f => f.pos === 'C') || p.position === '捕';
      return { ...r, is_catcher: isCatcher };
    } catch { return null; }
  })();

  // 査定対象年を渡す。実測年から3年以上離れていれば直接計測として扱わない（加齢で変わるため）
  const directs = buildDirectMeasurements(
    { ...(bridgeRow ?? {}), ...(npbPlusRow ?? {}) },
    {
      ...cfg.direct_measurement,
      npb_plus_direct: cfg.npb_plus_direct,
      // ★仕様アンカーを持つ能力（ミート・パワー）を渡す。NPB+のモデルはパワプロの能力値を
      //   目標に当てはめた式なので、アンカーで作った値へ混ぜると目盛りが2つになる（2026-08-06）。
      //   ここで抜き出して渡さないと、direct_measurement 側からは scale_calibration が見えない。
      scale_calibration: cfg.scale_calibration,
    }, targetSeason);

  // ★2026-08-05修理: 実測を能力欄へ据える処理が**肩力にしか無かった**。
  //   走力とパワーは ability_evidence（証拠）には入るが能力欄は統計由来のままで、
  //   「実測を接続した」と言いながら値が1点も動いていなかった。
  //   仕様04 §1.2「第1階層（直接計測）は第3階層（成果指標）に優先する」に従って据える。
  //   統計由来の値は _statistical_rating に残す（上書きで消さない）。
  /**
   * 統計から出した値と、実測から出した値を混ぜる。
   * 重みは**その実測がホールドアウトでどれだけ当たったか**（configs に記録した test_r）。
   * 当たる実測ほど強く効き、当たらない実測はほとんど動かさない。
   * 実測が無ければ null を返す＝統計値がそのまま使われる。
   */
  const blendDirect = (statValue, direct) => {
    if (!direct || !Number.isFinite(direct.value)) return null;
    // 確からしさ: NPB+ は test_r、MLB Statcast は較正時の r（ホールドアウトが無いので控えめに0.8倍）
    const model = cfg.npb_plus_direct?.models?.[String(direct.source ?? '').replace('NPB+アプリ ', '')];
    const w = model?.test_r != null ? model.test_r
      : (direct.source?.includes('Statcast') ? (cfg.direct_measurement?.speed?.r ?? 0.9) * 0.8 : 0.5);
    const weight = Math.max(0, Math.min(1, w));
    if (!Number.isFinite(statValue)) {
      return { value: r1(direct.value), _direct: direct, _statistical_rating: null, _weight: weight };
    }
    const blended = statValue * (1 - weight) + direct.value * weight;
    return {
      value: r1(blended), _direct: direct, _statistical_rating: r1(statValue), _weight: Number(weight.toFixed(3)),
    };
  };

  // 捕手の肩力に実測があれば、それを能力欄の値に据える（第1階層は第3階層に優先する）。
  // 統計由来の値は provenance と ability_evidence に残す＝上書きで消さない。
  const armDirect = directs.肩力;
  const armForSheetFinal = armDirect
    ? { ...(armForSheet ?? {}), rating: armDirect.value,
        _direct: armDirect, _statistical_rating: r1(armForSheet?.rating) }
    : armForSheet;

  // 能力欄をゲームの構成どおりに組み立てる（オーナー確定 2026-08-01）。
  // ミート・パワーは得能付与Phase3b(2026-08-04)で台帳反映後の値(batAdjusted)を使う
  const abilitySheet = buildAbilitySheet({
    bat: batAdjusted, trajectory, trajectoryEstimated, trajectorySource, run, fld,
    splits: { clutch, platoon },
    durability,
    // 優先順: スカウティング評価 > 直接計測 > 統計（仕様04 §1.2 の階層どおり）
    arm: (armRec?.scouting ? { ...armForSheetFinal, rating: armRec.value, _reconciled: armRec } : armForSheetFinal),
    // 走力・パワーの実測（NPB+アプリ／MLB Statcast）を能力欄へ据える。
    // スカウティング評価があればそちらが優先（仕様04 §1.2の階層どおり）
    // ★実測で統計値を丸ごと置き換えない（2026-08-05）。
    //   仕様04 §1.2は「第1階層（直接計測）は第3階層（成果指標）に優先」と定めるが、
    //   機械的に上書きすると**精度の低い実測が精度の高い統計を壊す**。
    //   実例: 山川穂高のパワーが 88 → 70.2（ハードヒット率1つからの変換、一致0.697）。
    //   本塁打から逆算した統計値の方が確かなのに、下げてしまう。
    //   そこで**実測の確からしさ（ホールドアウトでの一致）を重みにして混ぜる**。
    //   Sprint Speed のように一致0.945の実測はほぼそのまま効き、
    //   ハードヒット率のような0.5前後の実測は半分ほどしか動かさない。
    speedOverride: runRec?.scouting ? runRec
      : (statPrimarySpeed ? null : blendDirect(run?.speed, directs.走力)),
    powerOverride: blendDirect(batAdjusted?.power, directs.パワー),
    powerDisplay: conventions.power_display,
    specialAbilities: {
      strikeout: strikeoutSpecial,
      infieldHit: infieldHitSpecial,
      gold: goldSpecials,
      // 捕手の送球（精度）。仕様04 §4.3「精度: 送球得能」（2026-08-05）。
      // 事象が稀（リーグ全体2.38%・最多の捕手でも14件）なので100段階にせず得能にした。
      // 二項分布で偶然と区別できた捕手だけが入っている（45人中2人）＝
      // 中間の選手にはキー自体が作られない
      throwAccuracy: (() => {
        // ①送球失策（TE）から判定したもの。全守備位置・2014-2026年で最もサンプルが大きい
        const byTe = ctx.throwAccuracyTe?.get(`${normName(p.name)}|${p.position}`);
        if (byTe) {
          return {
            ability: byTe.ability, color: byTe.ability === '送球◎' ? 'blue' : 'red',
            basis: `${byTe.seasons[0]}-${byTe.seasons[1]}年の守備機会${byTe.chances}のうち送球失策${byTe.te}件`
              + `（${byTe.pos}の平均なら${byTe.expected.toFixed(1)}件）`,
            events: byTe.chances, wild_throws: byTe.te,
            p_value: byTe.ability === '送球◎' ? byTe.p_low : byTe.p_high,
            source: '1.02/DELTA 送球失策',
          };
        }
        // ②捕手だけの別経路（盗塁を許した後の余分な進塁＝二塁送球の精度）
        const t = ctx.catcherThrow?.get(normName(p.name));
        if (t) {
          return {
            ability: t.ability, color: t.ability === '送球○' ? 'blue' : 'red',
            basis: t.basis, events: t.events, wild_throws: t.wild_throws,
            p_value: t.p_value,
          };
        }
        // 内野手の送球（精度）。仕様04 §4.3の同じ枠を、内野ゴロの悪送球から判定する（2026-08-05）。
        // 守備範囲（RngR）とは相関 -0.13 で重ならないので、守備力と二重計上にならない。
        // 捕手と同じく事象が稀（112打球に1回）なので100段階にせず得能。64人中2人だけ判別できた
        const f = ctx.infieldThrow?.get(normName(p.name));
        if (!f) return null;
        return {
          ability: f.ability, color: f.ability === '送球◎' ? 'blue' : 'red',
          basis: `走者なしの内野ゴロ${f.chances}打球のうち悪送球${f.errors}件`
            + `（${f.pos}の平均なら${f.expected.toFixed(1)}件）`,
          events: f.chances, wild_throws: f.errors,
          p_value: f.ability === '送球◎' ? f.p_low : f.p_high,
        };
      })(),
    },
  }, cfg);

  const card = buildCard({
    player: {
      player_id: p.player_id, name_ja: p.name.replace(/　/g, ' '), team: p.team,
      league: leagueOf(p.team), primary_position: p.position,
      secondary_positions: fld.filter(f => f.pos !== p.position).map(f => f.pos),
      team_games: 143,
    },
    cardType, seasonLabel, seasonsUsed,
    ratings: {
      meet: batAdjusted.meet, power: batAdjusted.power, contact: bat.contact, eye: bat.eye,
      // 表示用（ゲーム側の慣習を当てた後）。査定値 power とは別欄（仕様02 §6.6）
      power_display: conventions.power_display,
      game_convention_adjustments: conventions.adjustments,
      speed: r1(run?.speed), stealing: r1(run?.stealing?.rating), baserunning: r1(run?.baserunning?.rating),
      fielding: fld.map(f => ({
        pos: f.pos, innings: f.inn, is_primary: f.isPrimary,
        fielding: r1(f.fielding?.rating), catching: r1(f.catching?.rating), arm: r1(f.arm?.rating),
        arm_is_estimated: f.arm?.is_estimated ?? false,
        // 仕様04 §12「ゲーム仕様上の適性値も別管理」。能力値とは別の欄に置く
        aptitude: f.aptitude.grade,
        catcher: f.catcher ? { framing: r1(f.catcher.framing), blocking: r1(f.catcher.blocking) } : null,
      })),
    },
    calcLog: {
      ...buildCalcLog({ line, bat, run, fld, ledgers, env, prior, cfg, contextTier: ctxSel.tier, trajectoryEstimated, trajectorySource }),
      // 仕様04 §13 走守計算ログ（YAML相当の構造）
      run_field_log: buildRunFieldLog({ line, run, fld, bm }),
    },
    confidence, formula,
    sources: ['プロEYE球（基礎成績）', ...(bm ? ['NPB Basement（走塁・守備・打球）'] : [])],
    estimated: [
      ...(bm ? [] : ['NPB Basementのデータが無い年のため、走塁・守備は未査定']),
      ...(fld.some(f => f.arm?.is_estimated) ? ['内野手の肩力は守備位置からの推定値（実測ではない）'] : []),
    ],
    unresolved: [
      ...(!splits ? ['対左右・得点圏の分割成績が無い年のため、チャンス・対左の得能は未査定'] : []),
      ...(clutch?.diff == null && splits ? [`チャンス: ${clutch?.reason ?? '得点圏打数不足'}`] : []),
      ...(platoon?.meetDiff == null && splits ? [`対左: ${platoon?.reason ?? '対左打数不足'}`] : []),
      ...(!goldHistorical ? ['金特: outputs/derived/gold_historical_distribution.json が無いため未査定'] : []),
    ],
  });
  card.provenance.by_value = provenanceByValue;

  // 走力・肩力は証拠の束として持つ（GPT回答2026-08-01の推奨）。
  // 代理指標は「能力の合成値」ではなく「直接測定を予測する説明変数」へ格下げした。
  // ★directs の組み立ては能力欄より前（上記）へ移した（2026-08-05）。
  //   以前はここで作っていたため、証拠を出しても能力値に届かなかった。
  const evOf = (ability, scoutRec, statVal, components) => buildAbilityEvidence({
    ability,
    direct: directs[ability] ?? null,
    prior: scoutRec?.scouting ? {
      value: scoutRec.scouting_value, tier: 'scouting_document',
      source: scoutRec.scouting.source, basis: scoutRec.scouting.basis, dated: scoutRec.scouting.dated,
    } : null,
    proxies: statVal == null ? null : { value: statVal, components, reliability: 0.35 },
  });
  card.ability_evidence = {
    _direct_measurement_status: DIRECT_MEASUREMENT_STATUS,
    走力: evOf('走力', runRec, r1(run?.speed), ['三塁打率', '併殺回避率', 'UBR']),
    肩力: evOf('肩力', armRec, armRec?.statistical_value ?? r1(armForSheet?.rating), ['ARM', '補殺率']),
  };

  // ゲームの構成どおりの能力欄。ratings は査定の生の並びで、こちらが表として見せる方
  card.abilities = abilitySheet;

  // 分割成績から出した得能の素点（仕様05 §3 チャンス／§4 対左）。
  // ここでは素点と信頼度まで持つ。実際の得能付与はPhase 3bで調整台帳と一緒に行う
  // （素点をそのまま能力へ足すと、ミートから引く分と二重計上になるため）
  card.splits = splits ? {
    context: ctxSel,
    clutch, platoon,
    source: splits.source,
    _next: 'Phase 3bで得能を付ける時に、仕様05 §5.4 の調整台帳へ通してから基礎能力へ反映する',
  } : null;

  // observed（逆算の入力になった観測値）も返す。シーズン一括査定が、カード査定と
  // **同じ経路で**能力値を出せるようにするため（2026-08-05、査定が2経路に分かれていた修理）
  return { card, batting: bat, meta: { targetSeason, hasBasement: !!bm, provisional, contextTier: ctxSel.tier } };
}
