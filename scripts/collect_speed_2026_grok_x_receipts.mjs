#!/usr/bin/env node
/**
 * Collect raw Grok-X x_search receipts for the fixed 19-player SNS tie-break queue.
 * This script never creates a rating or classifies evidence as accepted. It records
 * search receipts and extracted x.com status URLs for later human/rule-based review.
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const AS_OF = '2026-08-10';
const WORKDIR = process.cwd();
const INPUT = 'outputs/derived/speed_2026_sns_tiebreak_consensus.json';
const OUTPUT = 'data/manual/speed_2026_grok_x_search_receipts_20260810.json';
const DEFAULT_SERVER = 'C:\\Users\\amila\\.claude\\tools\\grok-x-mcp\\server.js';
const SERVER = process.env.GROK_X_MCP_SERVER || DEFAULT_SERVER;
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const CONCURRENCY = Math.max(1, Math.min(4, Number(concurrencyArg?.split('=')[1] ?? 3)) || 3);
const RESUME = process.argv.includes('--resume');
const maxQueriesArg = process.argv.find((arg) => arg.startsWith('--max-queries='));
const MAX_QUERIES = Math.max(0, Number(maxQueriesArg?.split('=')[1] ?? 0) || 0);

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function writeJson(path, data) {
  const absolute = resolve(WORKDIR, path);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = absolute + '.tmp';
  writeFileSync(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(temporary, absolute);
}

function nowIso() {
  return new Date().toISOString();
}

function canonicalUrl(handle, postId) {
  return `https://x.com/${handle}/status/${postId}`;
}

function extractPostOccurrences(text, receiptId) {
  const urlPattern = /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([^\/\s?#]+)\/status\/(\d+)/giu;
  const occurrences = [];
  for (const match of text.matchAll(urlPattern)) {
    const [rawUrl, author, postId] = match;
    const before = text.slice(Math.max(0, (match.index ?? 0) - 550), match.index ?? 0).trim();
    const after = text.slice((match.index ?? 0) + rawUrl.length, Math.min(text.length, (match.index ?? 0) + rawUrl.length + 180)).trim();
    occurrences.push({
      receipt_id: receiptId,
      post_id: postId,
      post_url: canonicalUrl(author, postId),
      raw_url_returned: rawUrl,
      author_handle_from_url: '@' + author,
      surrounding_returned_text: [before, rawUrl, after].filter(Boolean).join('\n')
    });
  }
  return occurrences;
}

function callXSearch(query, maxResults = 5) {
  return new Promise((resolveCall) => {
    const startedAt = nowIso();
    const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolveCall({ started_at: startedAt, retrieved_at: nowIso(), ...result });
    };
    const messageForToolCall = () => stdout.split(/\r?\n/).filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    }).find((message) => message.id === 2);
    const resultFromMessage = (callMessage, code = null, signal = null) => {
      const content = callMessage?.result?.content?.find((item) => item.type === 'text')?.text;
      const isError = Boolean(callMessage?.result?.isError || callMessage?.error || !content);
      const returnedError = callMessage?.error?.message ?? (isError ? (content ?? `server exited code=${code} signal=${signal ?? ''}`) : null);
      const creditLimit = /used all available credits|monthly spending limit|prepaid credits are depleted/iu.test(returnedError ?? '');
      return {
        status: isError ? (creditLimit ? 'CREDIT_LIMIT_REACHED' : 'SEARCH_ERROR') : 'OK',
        raw_response_text: content ?? '',
        error: returnedError,
        stderr: stderr || null,
        server_exit_code: code,
        server_exit_signal: signal ?? null
      };
    };
    const stopChild = () => {
      if (!child.killed) child.kill();
    };
    // The configured MCP server is persistent by design. Resolve as soon as the
    // tools/call response arrives, then stop this per-query child deliberately.
    const timeout = setTimeout(() => {
      if (!settled) {
        stopChild();
        finish({ status: 'SEARCH_TIMEOUT', raw_response_text: '', error: 'x_search response was not received within 120 seconds', stderr: stderr || null, server_exit_code: null, server_exit_signal: 'TIMEOUT' });
      }
    }, 120000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const callMessage = messageForToolCall();
      if (callMessage && !settled) {
        const result = resultFromMessage(callMessage);
        stopChild();
        finish(result);
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      stopChild();
      finish({ status: 'TRANSPORT_ERROR', raw_response_text: '', error: error.message, stderr: stderr || null, server_exit_code: null, server_exit_signal: null });
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      finish(resultFromMessage(messageForToolCall(), code, signal));
    });
    const messages = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } },
      { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'x_search', arguments: { query, max_results: maxResults } } }
    ];
    child.stdin.end(messages.map((message) => JSON.stringify(message)).join('\n') + '\n');
  });
}

function searchPrompt(player, theme, year = null) {
  const dateClause = year
    ? `優先期間は${year}年の投稿です。${year}年に見つからない場合だけ、2024–2026年で明示的に日付が分かる投稿を返してください。`
    : '優先期間は2026年、次に2025年、次に2024年です。';
  return [
    'X（Twitter）の実在する投稿だけを検索してください。',
    `対象選手は日本プロ野球の「${player}」です。投稿本文に「${player}」または明確に同選手を指す表記を実際に含むものだけにしてください。`,
    `検索観点: ${theme}。`,
    dateClause,
    '採用候補は、野球で一歩目から約90ftまで走る純粋な身体的running ability（足の速さ、直線速度、加速、全力疾走、以前より足が落ちた等）への直接言及だけです。',
    '盗塁、盗塁数、走塁判断、スタート技術、内野安打、三塁打、守備範囲、バント後の一塁到達、ゲーム査定だけの投稿は返さないでください。',
    '各結果は、実在するx.com/status URL、@handle、投稿本文の必要最小限の原文、投稿日時を必ず付けてください。条件を満たす投稿がなければ「Nothing found」とだけ答えてください。推測・要約・無関係な投稿は返さないでください。'
  ].join('\n');
}

const themes = [
  ['fast', '「足が速い」「速い足」「快足」など、速さそのものへの直接評価'],
  ['speedster', '「俊足」など、身体的running abilityを指す直接評価'],
  ['running_ability', '「走力」「脚力」など、身体的な走る能力への直接評価'],
  ['speed', '「スピード」「直線速度」「加速」など、走る速さへの直接評価'],
  ['slow', '「足が遅い」「遅い」「鈍足」など、身体的running abilityの低下又は遅さへの直接評価'],
  ['all_out_run', '「全力疾走」「加速」「疾走」など、実際の身体的な走りへの直接観察']
];

const consensus = JSON.parse(readFileSync(resolve(WORKDIR, INPUT), 'utf8'));
const canonical = consensus.consensus.map((row) => ({
  player: row.player,
  team: row.team,
  packet_id: row.packet_id,
  case_type: row.case_type
}));
if (canonical.length !== 19 || new Set(canonical.map((row) => row.player)).size !== 19) {
  throw new Error('Canonical 19-player scope is not intact.');
}
if (!existsSync(SERVER)) throw new Error(`Grok-X MCP server path not found: ${SERVER}`);

const planned = [];
for (const target of canonical) {
  for (const [key, theme] of themes) {
    planned.push({ player: target.player, packet_id: target.packet_id, case_type: target.case_type, query_kind: key, query: searchPrompt(target.player, theme) });
  }
  for (const year of [2026, 2025, 2024]) {
    planned.push({ player: target.player, packet_id: target.packet_id, case_type: target.case_type, query_kind: `year_${year}`, query: searchPrompt(target.player, `${year}年の「足」「俊足」「走力」「スピード」「全力疾走」の直接的な身体速度評価`, year) });
  }
}

const pairwise = [
  ['友杉 篤輝', '林 琢真', '足'],
  ['友杉 篤輝', '林 琢真', '速い'],
  ['林 琢真', '奈良間 大己', '足'],
  ['友杉 篤輝', '奈良間 大己', '足']
];
for (const [player, comparator, term] of pairwise) {
  planned.push({
    player,
    packet_id: canonical.find((row) => row.player === player)?.packet_id ?? null,
    case_type: 'TYPE_B_PHYSICAL_ORDER_CONFLICT',
    query_kind: 'pairwise',
    comparator,
    query: [
      'X（Twitter）の実在する投稿だけを検索してください。',
      `「${player}」と「${comparator}」を同じ投稿本文で明示し、野球における身体的な足の速さ・直線速度・加速を比較している投稿を探してください。検索語は「${term}」です。`,
      '盗塁、走塁判断、守備、ゲーム査定の比較は除外してください。2026、2025、2024を優先します。',
      '各結果には実在するx.com/status URL、@handle、投稿本文の必要最小限の原文、投稿日時を必ず付けてください。該当なしならNothing foundとだけ答えてください。'
    ].join('\n')
  });
}

const previousArtifact = RESUME && existsSync(resolve(WORKDIR, OUTPUT))
  ? JSON.parse(readFileSync(resolve(WORKDIR, OUTPUT), 'utf8'))
  : null;
const previousByReceiptId = new Map((previousArtifact?.query_receipts ?? []).map((receipt) => [receipt.receipt_id, receipt]));
const receipts = planned.map((plan, index) => {
  const receiptId = `GXQ${String(index + 1).padStart(3, '0')}`;
  const previous = previousByReceiptId.get(receiptId);
  return previous?.query === plan.query ? previous : undefined;
});
const retryCandidates = planned.map((_, index) => index).filter((index) => receipts[index]?.status !== 'OK');
const pendingIndices = MAX_QUERIES > 0 ? retryCandidates.slice(0, MAX_QUERIES) : retryCandidates;
let nextPending = 0;
async function worker() {
  while (true) {
    const index = pendingIndices[nextPending++];
    if (index === undefined) return;
    const plan = planned[index];
    const receiptId = `GXQ${String(index + 1).padStart(3, '0')}`;
    const result = await callXSearch(plan.query, 5);
    const occurrences = result.status === 'OK' ? extractPostOccurrences(result.raw_response_text, receiptId) : [];
    receipts[index] = {
      receipt_id: receiptId,
      provenance: 'GROK_X_SUPPLEMENT',
      ...plan,
      ...result,
      x_post_occurrence_count: occurrences.length,
      x_post_occurrences: occurrences
    };
    console.log(JSON.stringify({ receipt_id: receiptId, player: plan.player, query_kind: plan.query_kind, status: result.status, hits: occurrences.length }));
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const byPost = new Map();
for (const receipt of receipts) {
  for (const occurrence of receipt.x_post_occurrences) {
    const key = occurrence.post_id;
    const existing = byPost.get(key) ?? {
      post_id: occurrence.post_id,
      post_url: occurrence.post_url,
      author_handle_from_url: occurrence.author_handle_from_url,
      seen_in_receipt_ids: [],
      observed_players: [],
      surrounding_returned_text_by_receipt: []
    };
    existing.seen_in_receipt_ids.push(receipt.receipt_id);
    if (!existing.observed_players.includes(receipt.player)) existing.observed_players.push(receipt.player);
    existing.surrounding_returned_text_by_receipt.push({ receipt_id: receipt.receipt_id, text: occurrence.surrounding_returned_text });
    byPost.set(key, existing);
  }
}

const artifact = {
  schema_version: 'speed-2026-grok-x-receipts/v1.0.0',
  as_of: AS_OF,
  provenance: 'GROK_X_SUPPLEMENT',
  purpose: 'Raw Grok-X x_search receipts for the canonical 19-player SNS tie-break queue. Search output is not accepted evidence until separately reviewed for identity, direct physical-speed content, time, independence, and duplicate origin.',
  scope: {
    canonical_input: INPUT,
    canonical_player_count: canonical.length,
    restriction: 'No player outside the canonical 19-player SNS_TIEBREAK queue is researched or assigned a consensus. Pairwise comparator names are query terms only and do not create target-player records.'
  },
  collector: {
    script: 'scripts/collect_speed_2026_grok_x_receipts.mjs',
    grok_x_server_path: SERVER,
    grok_x_server_sha256: sha256File(SERVER),
    protocol: 'MCP stdio JSON-RPC tools/call x_search',
    max_results_per_query: 5,
    concurrency: CONCURRENCY,
    query_count: receipts.length,
    resumed: RESUME,
    carried_forward_successful_receipts: receipts.filter((receipt) => receipt?.status === 'OK').length,
    retry_candidates_before_run: retryCandidates.length,
    max_queries_this_run: MAX_QUERIES || null
  },
  canonical_targets: canonical,
  query_receipts: receipts,
  unique_x_post_candidates: [...byPost.values()]
};

writeJson(OUTPUT, artifact);
const summary = {
  status: 'ok',
  canonical_targets: canonical.length,
  query_count: receipts.length,
  attempted_this_run: pendingIndices.length,
  successful_queries: receipts.filter((receipt) => receipt.status === 'OK').length,
  failed_queries: receipts.filter((receipt) => receipt.status !== 'OK').length,
  raw_x_hit_occurrences: receipts.reduce((sum, receipt) => sum + receipt.x_post_occurrence_count, 0),
  unique_x_post_candidates: byPost.size,
  output: OUTPUT
};
console.log(JSON.stringify(summary, null, 2));
