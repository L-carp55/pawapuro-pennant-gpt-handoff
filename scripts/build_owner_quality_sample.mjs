// オーナーが今の査定の精度を確かめるための、10人サンプルの査定結果とパワプロ値の並べ比較。
//
// 位置づけ:
//   measure_appraisal_gap.mjs は集計（全体の系統ずれ・順位相関）を出す道具。
//   これは**個々の選手を目で見て「妥当か」を判断する**ための道具。
//   パワプロの値は採否の物差しにしない（2026-07-31オーナー確定）——ここでは
//   「査定の出力が常識的な範囲に収まっているか」の参考としてのみ横に並べる。
//
// オーナー指示（2026-08-05）:
//   ①2024年の実成績もセットで載せる ②乖離の大きいところの原因を考察する
//   ③年度補正を使うなど現状できる最大限の精度で計算する
//   ④成績は個別の詳細のところにだけ一緒に書く（表を分けない）
//   ⑤基準打率・本塁打率・肩力・守備力・捕球をどう求めたのか分かるように書く
//
// ⑤への対応: 「計算方法の説明」という節を新設し、専門用語を使わず・具体例を先に出す
// 形で、5つの数字それぞれが何をどう混ぜて出しているかを書く。個別詳細でも同じ手順を
// 各選手の実際の数字で辿れるようにする。
//
// 使い方: node scripts/build_owner_quality_sample.mjs

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeContext, appraiseCard } from '../src/cards/pipeline.mjs';
import { loadLedger } from '../src/ratings/scouting_input.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const J = f => JSON.parse(readFileSync(path.join(ROOT, 'configs', f), 'utf8'));
const cfg = J('ratings.json'), rv = J('run_values.json').values;
const runNorm = J('running_norms.json'), fldNorm = J('fielding_norms.json');
const scoutingLedger = loadLedger(J('scouting.json'));
const db = new DatabaseSync(path.join(ROOT, 'data', 'pennant.db'), { readOnly: true });
const ctx = makeContext(db, cfg);
const norm = s => (s ?? '').normalize('NFKC').replace(/[\s　]/g, '');
const fmt3 = v => v == null ? '-' : v.toFixed(3).replace(/^0/, '');

const TARGETS = [
  '村上　宗隆', '山川　穂高', '周東　佑京', '近本　光司', '佐藤　輝明',
  '菊池　涼介', '源田　壮亮', '甲斐　拓也', '岡本　和真', '牧　秀悟',
];
const SEASON = 2024;

// パワプロ基礎能力（pawapuro_rating＝「パワプロ2024-2025」405人。2024シーズンに対応する版）
const pawaBase = new Map();
for (const r of db.prepare(`SELECT p.* FROM pawapuro_rating p
  JOIN pawapuro_link l ON l.name_norm = p.name_norm`).all()) {
  pawaBase.set(norm(r.name), r);
}
// パワプロ得能（pawapuro_full 2024作品＝ranked_json等）
const pawaFull = new Map();
for (const r of db.prepare(`SELECT f.*, l.proeye_name FROM pawapuro_full f
  JOIN pawapuro_full_link l ON l.pawa_rowid = f.rowid AND l.work = f.work
  WHERE f.work = '2024'`).all()) {
  pawaFull.set(norm(r.proeye_name), r);
}

function fmtAbility(v) {
  if (v == null) return '  -  ';
  const n = typeof v === 'object' ? v.value : v;
  return n == null ? '  -  ' : String(Math.round(n)).padStart(5);
}
const ABIL_MAP = { 弾道: 'trajectory', ミート: 'meet', パワー: 'power', 走力: 'speed', 肩力: 'arm', 守備力: 'fielding', 捕球: 'catching' };

const lines = [];
const push = s => { lines.push(s); console.log(s); };

push('# オーナー品質確認サンプル — 10選手・2024年（改訂版2）\n');
push(`生成日: ${new Date().toISOString().slice(0, 10)}\n`);
push('**パワプロの値は採否の物差しではない**（2026-07-31確定）。ここでは「査定の出力が');
push('常識的な範囲に収まっているか」を目視確認する参考としてのみ横に並べる。\n');

// =================================================================================
// 計算方法の説明（オーナー指示④）
// =================================================================================
push('## 計算方法の説明\n');
push('5つの数字（基準打率・本塁打率・肩力・守備力・捕球）が、それぞれ何を混ぜて');
push('出ているかを説明する。個別の選手の実際の数字は「個別の詳細」で同じ手順を辿れる。\n');

push('### ミートの元になる「基準打率」\n');
push('村上宗隆の2024年で言うと、打率.244（500打数122安打）という数字がある。');
push('だがミートの計算はこの.244をそのまま使わない。手順は4段階。\n');
push('**1. 対戦相手を絞る。** 右投手と対戦した時の成績だけを取り出す（左投手の成績は');
push('別枠で扱う。「対左投手」という別の得能になる）。これが「基準打率」。村上の場合、');
push('327打数で.217——全体の.244より低い。これは対左投手の方が調子が良く、右投手だけ');
push('見ると低く出ているため。★対戦相手を絞った分割成績が無い年（2005年以前など）は、');
push('打率全体をそのまま使う。\n');
push('**2. その年のリーグ水準に合わせて底上げ・割引する（年度補正）。** 同じ.217でも、');
push('リーグ全体の打率が低い年に出した.217と、高い年に出した.217では価値が違う。');
push('2019年を基準の年と決め、**対象年の「対右投手」のリーグ平均と、2019年の「対右投手」の');
push('リーグ平均**を比べて、差の分だけ底上げ・割引する。★比べる相手も同じ対戦条件で');
push('揃える（2026-08-05に修理。以前は対象年だけ対右・基準年は総合を使っており、環境の差を');
push('小さく見積もっていた）。なお環境が1%動いても打者の打率は0.91%しか動かない、と');
push('実測されているため、補正はそのぶん弱めにかける。\n');
push('**3. 出場が少ない年だけ、本人の実績と混ぜる（縮小）。** ★2026-08-05にオーナー指示で');
push('全面変更した——「基本的にはその年だけで査定してください。過去の実績から補正が入るのは');
push('成績が明らかに下振れたときとけがなどであまり出られなかったときだけです」。');
push('**その年に十分出場していれば（打数359以上）、その年の成績をそのまま使う**（混ぜない）。');
push('出場が少ない年だけ、不足した打数の分だけ本人の直近実績へ寄せる。');
push('閾値359は恣意的な数字ではなく、規定打席（試合数×3.1=443）に到達した845人年');
push('（2010-2025）の打数の最小値を取ったもの。\n');
push('※変更前は全選手に一律の縮小がかかっており、フル出場の選手でも本人の過去実績が');
push('4割前後混ざっていた。年度ごとの査定としては誤りだった。\n');
push('**4. リーグ平均と比べて点数にする。** ここで出来た数字を、同じ年・同じ対戦相手条件の');
push('リーグ平均と比べて点数化する。★2026-08-06修理: 以前はこの後に「パワプロ143人の分布に');
push('合わせる」という段が入っていたが、これを**廃止した**（後述）。\n');
push('★得点圏（チャンス）の扱いについて: 本来は「得点圏で特別強い分はチャンス得能へ移し、');
push('ミートからは引く」のが仕様の意図（仕様05 §2）。だが対右投手の打率を基準にしている');
push('場合、引くには「対右投手の中での得点圏の成績」が必要で、そのデータが公開されていない。');
push('総合打率ベースの得点圏差を代わりに使うと母集団の違うものを引くことになるため、');
push('**Tier B（対右投手が基準）では引かない**（2026-08-05にオーナー指摘で修理）。');
push('結果として、対右投手の打率には得点圏の成分が残っている。\n');

push('### パワーの元になる「本塁打率」\n');
push('本塁打率も同じ考え方で4段階を通る。村上2024年で言うと本塁打33本／500打数=6.6%。\n');
push('**1. 打数のばらつきを揃える。** 打席数が多い選手ほど本塁打の絶対数は増えやすいので、');
push('「打数490（規定打席に達する選手の平均的な打数）あたり何本か」に換算する。');
push('**2. 球場補正。** 本拠地によって本塁打の出やすさが大きく違う（神宮球場は平均の');
push('1.86倍、バンテリンドームは0.60倍、というように）。実際にどの球場で何打数立ったかを');
push('調べ、加重平均した係数で本塁打率を割り引く（打ちやすい球場の本塁打ほど価値を下げる）。');
push('**3. 年度補正。** 打率と同じくその年のリーグの本塁打率を2019年基準に合わせる。');
push('本塁打は選手の実力による差が大きいほど環境の影響を受けにくいと実測されているため、');
push('補正の強さは選手の水準によって変える（強打者ほど補正を弱める）。');
push('**4. 点数化。** 出来上がった「本塁打◯本相当」を、目安の表に当てはめて点数にする——');
push('**20本→70 / 30本→80 / 40本→86.5 / 46本→90**（間は線でつなぐ）。★打率と同じく、');
push('その年に十分出場していれば本人の過去実績とは混ぜない（2026-08-05オーナー指示）。');
push('出場が少ない年だけ、不足した打数の分だけ本人の実績へ寄せる。\n');

push('#### ★2026-08-06 修理: 目安の表が2つの経路から壊されていた\n');
push('オーナー指摘「35.89本相当でパワーが80行かないのもおかしい」「前言ったホームランの');
push('本数とパワーのざっくりとした目安を覚えていますか？」で発覚。上の目安（20本→70 /');
push('30本→80 / 46本→90）は正本に入っていたのに、**その後ろで2つの処理が値を書き換えて');
push('いた**。どちらもパワプロの能力値を目盛りにしている。\n');
push('**① パワプロ143人への分布合わせ**（2026-08-01導入）。傾き0.679・切片17.77の一次式を');
push('最後に掛けていた。この式を目安の表そのものに当てると **20本 70→65.3 / 30本 80→72.1 /');
push('46本 90→78.9 / 56本 100→85.7** となり、本塁打王級の46本ですら90に届かない。');
push('目安はどこも成立していなかった。村上のパワーはこれで83.8→74.7に落ちていた。\n');
push('**② NPB+実測の混合**。ハードヒット率などから能力値を出す式だが、その式は');
push('`SELECT power FROM pawapuro_full`——つまり**パワプロの能力値を目標に当てはめたもの**で、');
push('出てくるのは「パワプロの目盛りの上の点数」。これを52%の重みで混ぜていた。');
push('実害: 山川穂高2024は素点88.5（オーナーが2026-07-31に「89.8で妥当」と裁定した水準）');
push('だったのに、78.9まで下がっていた。**オーナー自身の裁定が上書きされていた。**\n');
push('**なぜ起きたか**: 2026-08-01に走力の目盛りずれを見つけた時、「相関0.4以上の能力は');
push('分布を合わせる」という一律ルールを4能力に当てた。このとき**その能力が既に正本で');
push('目盛りを決められているかを確認しなかった**。走力・弾道には目安の表が無く、');
push('「リーグ平均=50」という未検証の仮置きだったので、分布合わせが唯一の根拠として妥当。');
push('ミート・パワーには目安の表があり、しかもオーナーが個別に裁定していた。\n');
push('**直した内容**: ミート・パワーには①②のどちらも当てない（目安の表が唯一の目盛り）。');
push('走力・弾道には引き続き当てる（目盛りの根拠がそこにしか無いため）。');
push('NPB+の実測そのものを捨てたわけではなく、捨てたのは「パワプロの目盛りへの変換式」。');
push('正しい直し方＝ハードヒット率→**本塁打率**を当てはめ、その本塁打率を目安の表へ通す');
push('（目盛りの出所を1つにする）。それまでは適用しない＝T-0147として登録した。\n');
push('**パワプロとの誤差はこの修理で増える**（パワー5.33→8.61）。だがパワプロは正解では');
push('ないので、誤差が増えたことを撤回の理由にしない（2026-07-31オーナー確定「KONAMI比較は');
push('参考チェックに格下げ」）。\n');

push('### 肩力（送球の強さ）\n');
push('経路が2つある。**①実測がある場合**: 外野手・捕手の一部は、送球でどれだけ');
push('走者をアウトにできたかという公式の高度統計（ARM）と、実際にアウトにした補殺の');
push('数の2つを組み合わせて測る。1年だけでなく直近数年分を平均する（肩の強さは1年で');
push('大きく変わらないため）。**②実測が無い場合（多くの内野手）**: NPBの公開データには');
push('内野手の送球速度そのものが無いため、代わりに「どの守備位置を守れているか」から');
push('推定する（遊撃を守れる選手は肩が強いはず、という考え方）。★この推定方式は、');
push('今日DELTA社の実測データで答え合わせしたところ**当てずっぽうに近い**（実際の送球の');
push('強さとの一致がほぼ無い）と判明した。内野手の肩力は実測が無い限り参考程度に見てほしい。\n');

push('### 守備力（どこまで打球に追いつけるか）\n');
push('公式の高度統計（RngR＝守備範囲によってどれだけアウトを稼いだか）を使う。');
push('そのまま使うと「足が速いから広く守れる」のか「守備の判断が上手いから広く守れる」');
push('のかが混ざってしまうので、**まず選手の脚の速さ（走力）から「この速さなら普通は');
push('これくらい守れるはず」という基準値を計算し、実際の記録からその基準値を引く**。');
push('残った差（残差）だけを守備の巧さとして評価する。加えて、2026年に追加した材料として');
push('併殺（ダブルプレー）で始める役・中継する役をどれだけ果たしたかも二塁手・遊撃手には');
push('加味する（これは守備範囲そのものではなく別の技術だが、翌年への再現性が高いことを');
push('確認したうえで追加した）。出場イニングが少ないとこの評価は中央値（50点）へ');
push('寄せられる（信頼度が下がるため）。\n');

push('### 捕球（打球やゴロを確実に処理できるか）\n');
push('選手によって経路が3つある。**①捕手**: 捕逸（ワンバウンドの投球を後ろへ逸らして');
push('走者を進めてしまうこと）の少なさで測る。公式の失策数より、こちらの方が');
push('捕手本人の実力を年をまたいで安定して映すと実測で確認できたため。**②送球の正確さが');
push('確定している29選手（後述）**: 失策を「送球のミス」と「それ以外（捕球・処理の');
push('ミス）」に分けた記録があるので、そのうち「それ以外」だけを使う。理由は、送球の');
push('ミスは別の能力（送球という得能）として既に評価しているため、両方に失策の数を');
push('使うと同じ情報を二重に数えることになるから。**③それ以外の選手**: 通常の失策数の');
push('高度統計（ErrR）をそのまま使う。守備位置・年ごとの平均と比べ、出場量に応じて');
push('中央値へ寄せる。\n');

push('---\n');

// =================================================================================
// 基礎能力・得能の並べ比較
// =================================================================================
push('## 基礎能力（7項目・自作/パワプロ）\n');
push('| 選手 | 弾道 | ミート | パワー | 走力 | 肩力 | 守備力 | 捕球 |');
push('|---|---|---|---|---|---|---|---|');

const cards = [];
const deviations = [];
for (const name of TARGETS) {
  const r = appraiseCard(ctx, { name, mode: String(SEASON), cfg, rv, runNorm, fldNorm, scoutingLedger });
  if (r.error) { push(`| ${name} | ERROR: ${r.error} |`); continue; }
  cards.push({ name, card: r.card });
  const B = r.card.abilities?.基礎能力;
  const pb = pawaBase.get(norm(name));
  const row = k => `${fmtAbility(B?.[k])}${pb ? '/' + String(Math.round(pb[ABIL_MAP[k]])).padStart(3) : ''}`;
  push(`| ${name.replace(/　/g, ' ')} | ${row('弾道')} | ${row('ミート')} | ${row('パワー')} | ${row('走力')} | ${row('肩力')} | ${row('守備力')} | ${row('捕球')} |`);
  if (pb) {
    for (const [k, pk] of Object.entries(ABIL_MAP)) {
      const a = B?.[k]?.value, p = pb[pk];
      if (a == null || p == null) continue;
      const d = a - p;
      if (Math.abs(d) >= 12) deviations.push({ name, k, self: a, pawa: p, diff: d });
    }
  }
}
push('\n（表記: 自作の値/パワプロの値。パワプロ側が無い項目は自作のみ）\n');

push('## 得能（ランク型・自作で対応するもの）\n');
push('| 選手 | チャンス | 対左投手 | 盗塁 | 走塁 | 送球 |');
push('|---|---|---|---|---|---|');
for (const { name, card } of cards) {
  const T = card.abilities?.得能;
  const pf = pawaFull.get(norm(name));
  let pawaRanked = {};
  try { pawaRanked = JSON.parse(pf?.ranked_json ?? '{}'); } catch { /* noop */ }
  const cell = (key, pawaKey) => {
    const a = T?.[key];
    const av = a == null ? '-' : (a.value != null ? `${a.ability ?? ''}(${Math.round(a.value)})` : a.ability ?? a);
    const pv = pawaRanked[pawaKey] ?? '-';
    return `${av}/${pv}`;
  };
  push(`| ${name.replace(/　/g, ' ')} | ${cell('チャンス', 'チャンス')} | ${cell('対左', '対左投手')} | ${cell('盗塁', '盗塁')} | ${cell('走塁', '走塁')} | ${cell('送球', '送球')} |`);
}
push('\n（表記: 自作/パワプロ。自作が数値を持つのは推定値、"送球◎/×"は得能の有無のみ判定）\n');

// =================================================================================
// 精度向上機構
// =================================================================================
push('## 精度向上機構が各選手で発火したか\n');
push('自動判定。すべて appraiseCard の中で今日すでに組み込み済み（個別の有効化操作は無い）。\n');
push('| 選手 | 年度補正 | 球場補正 | ミート文脈 | 走力複数年 | 肩力複数年 | 縮小補正 | パワー実測 | 走力実測 |');
push('|---|---|---|---|---|---|---|---|---|');
for (const { name, card } of cards) {
  const log = card.calc_log;
  const B = card.abilities?.基礎能力;
  const primary = card.ratings?.fielding?.find(f => f.is_primary);
  const env = log?.environment?.applied ? `γ避${log.environment.gamma_avg}` : '-';
  const park = log?.power?.park ? `係数${log.power.park.factor.toFixed(2)}` : (log?.power?.park_skipped ? '被覆不足' : 'データなし');
  const tier = log?.meat?.context_tier_used ?? '-';
  const speedMulti = log?.running?.speed_is_multi_year ? `${log.running.speed_years}年` : (log?.running ? '単年' : '-');
  const anyMeasured = card.ratings?.fielding?.some(f => f.arm != null && !f.arm_is_estimated);
  const armMulti = anyMeasured ? '実測（複数年）' : (primary?.arm_is_estimated ? '推定(位置のみ・実測なし)' : '-');
  const kMeet = log?.shrinkage?.kappa_used?.meet;
  const shrinkD = kMeet > 0 ? `縮小あり(出場${log.shrinkage.kappa_used.season_ab}打数・不足${log.shrinkage.kappa_used.shortfall}分をPriorへ)`
    : (kMeet === 0 ? '縮小なし（十分出場・その年の成績そのまま）' : (log?.prior?.kind ? `対象外(${log.prior.kind})` : '-'));
  const powerReal = B?.パワー?.statistical_value != null ? '混合済み' : 'なし';
  const speedReal = B?.走力?.statistical_value != null ? '混合済み' : 'なし';
  push(`| ${name.replace(/　/g, ' ')} | ${env} | ${park} | ${tier} | ${speedMulti} | ${armMulti} | ${shrinkD} | ${powerReal} | ${speedReal} |`);
}
push('\n（年度補正=2019年基準への環境補正／ミート文脈=対右投手打率で基準を作れたか(B)・作れず総合打率(C)か／');
push('縮小補正=十分出場したか。十分なら過去実績とは混ぜず、その年の成績をそのまま使う。不足分だけ周辺実績を混ぜる）\n');

// =================================================================================
// 乖離の考察
// =================================================================================
push('## 乖離が大きい項目の考察（差12点以上）\n');
push('原因は5パターンに分かれた。うち3つ（A・B・C）は仕組みから説明できる。');
push('残り2つ（D・E）はデータの限界や個別の食い違いで、Dは仮説どまり、Eは原因未特定と');
push('明記する。個別の値は下の表、パターンの説明はその後に記す。\n');
push('| 選手 | 項目 | 自作 | パワプロ | 差 | 主因パターン |');
push('|---|---|---|---|---|---|');

function classify(name, k, card) {
  if (k === '捕球') return 'A';
  if (k === '守備力') return 'C';
  if (k === '肩力') {
    const primary = card.ratings?.fielding?.find(f => f.is_primary);
    if (primary?.arm_is_estimated) return 'B';
    return name === '甲斐　拓也' ? 'D' : 'E';
  }
  return '?';
}
for (const d of deviations) {
  const card = cards.find(c => c.name === d.name)?.card;
  const pattern = classify(d.name, d.k, card);
  push(`| ${d.name.replace(/　/g, ' ')} | ${d.k} | ${d.self.toFixed(1)} | ${d.pawa} | ${d.diff >= 0 ? '+' : ''}${d.diff.toFixed(1)} | ${pattern} |`);
}
push('');
push('**パターンA（捕球の縮小が強い）** — 近本・源田・甲斐・岡本・菊池・村上の6件すべて。');
push('捕球（ErrR/捕逸ベース）は翌年再現性が低いため（実測r=0.208）、信頼度が低く抑えられて');
push('いる（kappa=3426イニング。レギュラー級の出場でも信頼度は0.22〜0.27にしかならない）。');
push('少ない信頼度の分だけ中央値（50点）へ寄せる仕組みなので、ほぼ全選手の捕球が45〜58点の');
push('狭い範囲に収まる。パワプロは評判も含めて0〜100いっぱいに散らすため、守備の評判が');
push('高い選手（近本・源田・甲斐）は自作が低く出て、評判が低い選手（村上）は自作が高く出る');
push('——**同じ1つの原因が両方向の乖離を作る**。信頼度そのものは仕様の実測較正（別の材料の');
push('翌年再現性から逆算）なので、値を大きく動かすには縮小の強さ自体を見直す必要がある。\n');
push('**パターンB（内野手の肩は推定であり実測でない）** — 牧秀悟の肩力差(-13.3)。');
push('二塁・三塁・遊撃・一塁は肩力の直接実測（ARM）が無いことが多く、「守れる守備位置」から');
push('推定した値を使う。★この推定は今日、外部データ（DELTA実測）で答え合わせした結果、');
push('**順位相関-0.043＝当てずっぽう**と確認済み（内野手全員がほぼ同じ値に寄る）。実測では');
push('なく守備位置だけから来た値のため、パワプロが個々に付けている差を再現しない。\n');
push('**パターンC（守備範囲は走力を引いた残差）** — 近本・源田の守備力。守備力（RngRベース）');
push('は「その俊足ならこの程度の範囲は普通」という期待値を引いた残差を評価する設計');
push('（仕様§6準拠）。近本は計算ログ上、期待値（速さから予想される範囲）に対して実際の');
push('範囲がほぼ一致しており（残差z=-0.19、ほぼゼロ）、俊足であること自体が守備範囲の広さを');
push('大半説明してしまい、「純粋な守備の巧さ」として残る部分が小さい。信頼度も0.45〜0.46で');
push('中央へ寄る効果も重なる。パワプロが評判ベースで守備範囲そのものの広さを評価するのに対し、');
push('自作は「足の速さで説明できない部分」だけを評価するため、設計思想の違いが直接そのまま');
push('乖離になっている。\n');
push('**パターンD（甲斐拓也の肩力・データの年数窓のずれ）** — 甲斐拓也はNPB+アプリの実測');
push('撮影対象（109人）に入っておらず、肩力は統計（ARM+補殺、2021-2025年の複数年平均）');
push('のみで z=+0.47（やや上位、突出はしていない）。盗塁企図の実データ（2020-2026年、');
push('459企図）では阻止率42.3%（リーグ平均37.3%）と明確に上位だが際立って突出はしておらず、');
push('**2024年単年では32.7%とリーグ平均37.3%を下回る**。パワプロの評価（88）は活躍のピーク期');
push('（2017年前後の評判）を反映しているとみられ、自作は直近5年の実測window（2021-2025年）');
push('で評価するため、評価対象の期間そのものがずれている可能性がある。ただしこれは仮説で、');
push('確定した原因ではない。\n');
push('**パターンE（実測はあるがパワプロと個別に食い違う・原因未特定）** — 周東佑京・近本光司');
push('の肩力。どちらも複数年のARM+補殺実測（周東z=+1.09・5年／近本z=-0.19・5年、信頼度');
push('0.67〜0.82と低くない）を使っており、パターンB・Dのようなデータの欠落では説明できない。');
push('周東は自作が高く出て（76.8 vs 63）、近本も自作が高く出る（63.5 vs 41）——方向は同じだが、');
push('パターンAのような単一の縮小メカニズムでは説明がつかない（縮小はどちらの方向にも働くはず）。');
push('**★正直な所見: この2件は手元のデータからは原因を特定できていない。** 考えられる仮説');
push('（ARM指標は「走者が実際に走ってくるかどうか」という機会の多寡に影響される／パワプロの');
push('評価は放送・スカウトの定性的な印象を含む）はあるが、検証はしていない。個別の乖離として');
push('記録し、断定はしない。\n');

// =================================================================================
// 村上宗隆 — 基準打率が低いのにミートが50を超える理由（オーナー質問への回答）
// =================================================================================
{
  const mk = cards.find(c => c.name === '村上　宗隆')?.card;
  const m = mk?.calc_log?.meat, pr = mk?.calc_log?.prior;
  push('## Q&A: 村上宗隆の基準打率はなぜ低いのか\n');
  push('★このQ&Aはオーナー指摘（2026-08-05）を受けて **3件を修理した後** の値で書いている。');
  push(`修理前はミート52.2点、修理後は${mk?.abilities?.基礎能力?.ミート?.value}点（パワプロ41）。\n`);
  push(`村上の「基準打率」は **${fmt3(m?.context_avg)}**（対右投手・${m?.context_ab}打数）。`);
  push('全体の打率.244より低いのは、対左投手の方が調子が良く（.295）、右投手だけに絞ると');
  push('低く出ているため。これは対右投手との対戦成績そのものであり、査定はこれを使う。\n');
  push('実際の計算は次の順で進む:\n');
  push('```');
  push(`${fmt3(m?.context_avg)}（対右投手のみ、${m?.context_ab}打数）`);
  push(`  → 年度補正で${fmt3(m?.env_avg)}（対右投手どうしで比較。2024年.2465 / 2019年.2580）`);
  push(`  → 縮小なし（${mk?.calc_log?.inputs?.AB}打数 ≧ 十分出場とみなす${mk?.calc_log?.shrinkage?.kappa_used?.full_season_ab ?? 359}打数`);
  push(`     ＝縮小係数κ=0。その年の成績をそのまま使う）→ ${fmt3(m?.post_avg)}`);
  push(`  → 対右投手のリーグ平均（${fmt3(m?.context_league_avg)}）と比べて${m?.mean_ability?.toFixed(1)}点`);
  push(`  → 加減点後${m?.final?.toFixed(1)}点`);
  push(`  → 最終${mk?.abilities?.基礎能力?.ミート?.value}点（★2026-08-06にパワプロ分布合わせを廃止したので、加減点後の値がそのまま出る）`);
  push('```\n');
  push('★以前は「本人の直近4年の実績（打率.286）と半々で混ぜて.253」という段が入っていた。');
  push('オーナー指示（2026-08-05）で「基本的にはその年だけで査定」に変更したため、');
  push('十分出場した村上にはこの段が無くなり、対右の.226がそのまま使われるようになった。\n');
  push('### 修理した3件（オーナー指摘で発見）\n');
  push('**① 得点圏の調整が、母集団の違うものを引いていた**。');
  push('「得点圏で強い分はチャンス得能へ移し、ミートからは引く」という調整（仕様05 §2）が');
  push('入っていたが、その計算は**総合打率(.244)から得点圏差を引いた値**を、**対右投手の');
  push('打率(.217)から作った基準**と比べていた。母集団が違うものの引き算になっており、');
  push('村上の場合 +3.55点を加算していた——だがその中身は得点圏の効果ではなく');
  push('**.244と.217の差(27厘)がそのまま出たもの**だった。村上は得点圏.273／非得点圏.233と');
  push('得点圏に強い選手なので、仕様の意図ではミートは**下がる**はずで、符号すら逆だった。');
  push('正しく引くには「対右投手の中での得点圏差」が要るが、公開データに交差セル');
  push('（対右×得点圏）は無く、仕様02 §5.1が周辺値からの復元を禁じている。よって**引かない**');
  push('ことにした。対右の打率に得点圏の成分は残るが、母集団の違うものを引く誤りよりは正しい。\n');
  push('**② 年度補正の比較相手が片方だけ総合打率だった**。');
  push('対象年のリーグ平均は「対右投手」(.2465)を使っていたのに、基準年(2019年)は');
  push('**総合**(.2521)を使っていた。対右どうしで揃えると2019年は.2580で、環境の差は');
  push('3.79%→**4.67%**と大きくなる。村上の基準打率は.222→.226へ約4厘上がった。\n');
  push('**③ 縮小が全選手に一律かかっており、年度ごとの査定になっていなかった**');
  push('（指摘「あくまで年度ごとの査定ですよ？」「翌年再現性は一年ごとの能力を査定するのに');
  push('完全に不要です」）。従来の縮小の強さは**翌年の成績を当てる誤差を最小にする**値で');
  push('決めていたため、フル出場の選手でも本人の過去実績が4割前後混ざっていた。');
  push('年度ごとの査定という目的には合っていない。');
  push('→ **その年に十分出場していれば（打数359以上）縮小しない**方式に変更。');
  push('過去を参照するのは出場が少なかった年だけになった（＝けが等で出られなかった場合）。');
  push('閾値359は規定打席到達者845人年の打数の最小値（実データ由来）。\n');
  push('**3件を直した効果（141人全体・パワプロとの比較）**:\n');
  push('| | 修理前 | ①②修理後 | ③も修理後（現在） |');
  push('|---|---|---|---|');
  push('| ミート順位相関 | 0.756 | 0.791 | 0.774 |');
  push('| ミート平均誤差 | 5.2 | 5.1 | 6.0 |');
  push('| 村上のミート | 52.2 | 49.5 | ' + `${mk?.abilities?.基礎能力?.ミート?.value}（パワプロ41） |`);
  push('');
  push('★③の変更でパワプロとの一致は下がった。ただし**これは方針の帰結であって欠陥ではない**。');
  push('パワプロの能力値は複数年の評判を含んだ「その選手のイメージ」であり、');
  push('「その年だけの成績」とは本来ずれる。村上個人で見ると 49.5→' +
    `${mk?.abilities?.基礎能力?.ミート?.value} とパワプロ41へ近づいており、`);
  push('単年で見た時の再現性はむしろ上がっている。パワプロは採否の物差しにしない');
  push('（2026-07-31確定）ので、この数字を理由に方針を戻すことはしない。\n');
}

// =================================================================================
// 個別の詳細
// =================================================================================
push('## 個別の詳細（成績・計算根拠つき）\n');
for (const { name, card } of cards) {
  const stat = db.prepare(`SELECT * FROM v_batting WHERE replace(replace(name,' ',''),char(12288),'')=? AND season=? AND position<>'投'`)
    .get(norm(name), SEASON);
  const fstat = db.prepare(`SELECT * FROM v_fielding WHERE replace(replace(name,' ',''),char(12288),'')=? AND season=? ORDER BY g DESC LIMIT 1`)
    .get(norm(name), SEASON);
  push(`### ${name.replace(/　/g, ' ')}（${card.team ?? ''}・${card.primary_position ?? ''}）\n`);
  if (stat) {
    push(`**2024年成績**: ${stat.g}試合 ${stat.pa}打席 ${stat.ab}打数 ${stat.h}安打 `
      + `打率${fmt3(stat.h / stat.ab)} 二塁打${stat.b2} 三塁打${stat.b3} 本塁打${stat.hr} `
      + `打点${stat.rbi} 四球${stat.bb} 三振${stat.so} 盗塁${stat.sb} `
      + (fstat ? `／ 守備: 失策${fstat.e} 守備率${fmt3(fstat.fpct)}` : '') + '\n');
  }
  const B = card.abilities?.基礎能力;
  const log = card.calc_log;
  const m = log?.meat, pr = log?.prior, pw = log?.power;

  // ★2026-08-06 オーナー指摘「縮小係数がmdに書いてない」「35.89本は少ない」を受けて、
  //   途中で引かれた本数と、実際に使われた縮小の強さを全部出す（結論の数字だけ出さない）。
  const ku = log?.shrinkage?.kappa_used;
  const shrinkLine = (label, kappa) => {
    if (ku == null) return `- 本人の実績と混ぜた後: ${label}`;
    if (kappa === 0) {
      return `- 縮小なし（その年${ku.season_ab}打数 ≧ 十分出場とみなす${ku.full_season_ab}打数）→ ${label}`;
    }
    return `- 縮小あり（その年${ku.season_ab}打数で${ku.shortfall}打数ぶん足りない → 縮小係数κ=${kappa}。`
      + `本人の実績を「${kappa}打数ぶんの重み」として足す）→ ${label}`;
  };

  push(`**ミート ${B?.ミート?.value}点**`);
  push(`- 対戦相手を絞った基準打率: ${fmt3(m?.context_avg)}（${m?.context_tier_used === 'B' ? '対右投手' : '総合（分割データ無し）'}・${m?.context_ab}打数）`);
  if (m?.env_avg != null) push(`- 年度補正後: ${fmt3(m.env_avg)}`);
  if (pr) push(shrinkLine(fmt3(m?.post_avg), ku?.meet));
  push(`- リーグ平均${fmt3(m?.context_league_avg)}と比べて${m?.mean_ability?.toFixed(1)}点 → 加減点後${m?.final?.toFixed(1)}点 → 最終${B?.ミート?.value}点`);

  push(`\n**パワー ${B?.パワー?.value}点**${B?.パワー?.statistical_value != null ? `（統計値${B.パワー.statistical_value}点にNPB+実測を混ぜて最終値へ）` : ''}`);
  push(`- 本塁打率: ${log?.inputs?.HR}本／${log?.inputs?.AB}打数（基準打数${pw?._ab_ref ?? 490}に換算すると${pw?.hr_500paeq_raw?.toFixed(2)}本）`);
  if (pw?.park) {
    const afterPark = pw.hr_500paeq_raw / pw.park.factor;
    push(`- 球場補正: **${pw.hr_500paeq_raw?.toFixed(2)}本 → ${afterPark.toFixed(2)}本**`
      + `（係数${pw.park.factor?.toFixed(3)}で割る。${pw.hr_500paeq_raw > afterPark ? `−${(pw.hr_500paeq_raw - afterPark).toFixed(2)}本` : `+${(afterPark - pw.hr_500paeq_raw).toFixed(2)}本`}）`);
    const top = (pw.park.parks ?? []).slice(0, 3)
      .map(p => `${p.park}${p.ab}打数×${p.factor.toFixed(2)}`).join(' / ');
    push(`  - 内訳（打数の多い順3球場）: ${top}。実際に立った球場の係数を打数で加重平均している`);
  } else if (pw?.park_skipped) push(`- 球場補正: ${pw.park_skipped}`);
  if (log?.environment?.applied) {
    const beforeEnv = pw.park ? pw.hr_500paeq_raw / pw.park.factor : pw.hr_500paeq_raw;
    const ratio = pw.env / beforeEnv;
    push(`- 年度補正: **${beforeEnv.toFixed(2)}本 → ${pw.env.toFixed(2)}本相当**`
      + `（${ratio.toFixed(3)}倍。2024年のリーグ本塁打率${(log.environment.league_hr_rate * 100).toFixed(2)}%を`
      + `基準年2019年の${(log.environment.ref_hr_rate * 100).toFixed(2)}%へ揃える。`
      + `強打者ほど環境に流されにくいのでγ=${log.environment.gamma_hr_used?.toFixed(3)}に弱めている）`);
  }
  if (pr) push(shrinkLine(`${pw?.post?.toFixed(2)}本相当`, ku?.power));
  push(`- 点数化: **${pw?.post?.toFixed(2)}本相当 → ${pw?.mean_ability?.toFixed(1)}点**`
    + `（目安の表: 20本→70 / 30本→80 / 40本→86.5 / 46本→90 を線でつないだもの）`);
  push(`- 加減点後${pw?.final?.toFixed(1)}点 → 最終${B?.パワー?.value}点`);

  push(`\n**走力 ${B?.走力?.value}点**${B?.走力?.statistical_value != null ? `（統計値${B.走力.statistical_value}点にNPB+実測を混ぜて最終値へ）` : ''}`);
  if (log?.running?.speed_is_multi_year) push(`- 三塁打率・併殺回避・UBR・自作の走塁指標を組み合わせ、直近${log.running.speed_years}年（${log.running.speed_seasons?.join(',')}）を平均`);
  const runAb = card.abilities?.得能?.走塁;
  if (runAb) push(`- 走塁得能 ${runAb.value}点（${runAb.rank}）※脚力を引いた「進塁判断の上手さ」の残差。脚が速いだけでは高く出ない`);

  const primary = card.ratings?.fielding?.find(f => f.is_primary);
  const primLog = log?.fielding?.find(f => f.pos === primary?.pos);
  push(`\n**肩力 ${B?.肩力?.value ?? '-'}点**`);
  if (primary?.arm_is_estimated) {
    push(`- 実測なし。「${primary.pos}を${Math.round(primary.innings)}イニング守れている」ことから守備位置経由で推定（★当てずっぽうに近いと判明済み）`);
  } else if (primLog?.arm) {
    push(`- 実測（ARM＝送球で防いだ失点／補殺＝送球でアウトにした数）を${primLog.arm.positions?.length ? '' : '複数年'}平均。信頼度${(primLog.arm.reliability * 100).toFixed(0)}%`);
  }

  push(`\n**守備力(${primary?.pos ?? '-'}) ${primary?.fielding ?? '-'}点**`);
  if (primLog?.fielding) {
    push(`- 脚の速さから期待される守備範囲（残差z=${primLog.fielding.residZ?.toFixed(3)}）× 信頼度${(primLog.fielding.reliability * 100).toFixed(0)}%（${Math.round(primary.innings)}イニング分の出場）`);
    if (primLog.fielding.components?.length > 1) push(`  - 併殺の関与も加味: ${primLog.fielding.components.map(c => c.name).join('・')}`);
  } else if (primary?.pos === 'C') {
    push('- 捕手には「守備範囲」に対応する公開データが存在しないため、この項目は判定していない（未査定）');
  }

  push(`\n**捕球(${primary?.pos ?? '-'}) ${primary?.catching ?? '-'}点**`);
  if (primLog?.catching?.material === 'fe_only') {
    push('- 送球の正確さが確定しているため、失策のうち「送球以外（捕球・処理）」だけで判定（二重計上を避ける）');
  } else if (primLog?.catching?.material === 'passed_ball') {
    push(`- 捕手のため捕逸で判定: ${primLog.catching.games}試合で${primLog.catching.passedBalls}件（1試合あたり${primLog.catching.perGame?.toFixed(3)}件）`);
  } else if (primLog?.catching) {
    push(`- 通常の失策数（ErrR）を守備位置・年の平均と比較。信頼度${(primLog.catching.reliability * 100).toFixed(0)}%`);
  }

  const sp = card.abilities?.得能?.送球;
  if (sp) push(`\n**送球: ${sp.ability}** — ${sp.basis}`);
  push('');
}

const out = path.join(ROOT, 'outputs', 'owner_quality_sample_20260805.md');
writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log(`\n保存: ${path.relative(ROOT, out)}`);
db.close();
