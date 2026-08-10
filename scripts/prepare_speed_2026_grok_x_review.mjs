#!/usr/bin/env node
/**
 * Make a deterministic, human-reviewable candidate register from the raw
 * Grok-X search receipts.  This script does not make acceptance decisions;
 * it preserves the returned post text, receipt references, and known baseline
 * duplicate status so that the integration step can be reproduced.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RECEIPTS_PATH = path.join(ROOT, 'data/manual/speed_2026_grok_x_search_receipts_20260810.json');
const EXISTING_PATH = path.join(ROOT, 'data/normalized/speed_2026_sns_consensus_sources.json');
const OUTPUT_PATH = path.join(ROOT, 'data/manual/speed_2026_grok_x_candidate_review_20260810.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + '.tmp';
  fs.writeFileSync(temporaryPath, JSON.stringify(value, null, 2) + '\n', 'utf8');
  fs.renameSync(temporaryPath, filePath);
}

function compactWhitespace(value) {
  return String(value ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizedPostText(value) {
  return compactWhitespace(value)
    .replace(/[\s　]/g, '')
    .replace(/[\p{P}\p{S}]/gu, '')
    .toLowerCase();
}

function postIdFromUrl(value) {
  const matched = String(value ?? '').match(/(?:status|statuses)\/(\d{8,})/u);
  return matched?.[1] ?? null;
}

function extractPostTextFromContext(context, postUrl, postId, fallbackHandle) {
  const raw = String(context ?? '').replace(/\r/g, '');
  const urlIndex = raw.indexOf(postUrl);
  const idIndex = urlIndex >= 0 ? urlIndex : raw.indexOf(postId);
  if (idIndex < 0) {
    return {
      author_account: fallbackHandle,
      post_text_returned: null,
      posted_at_returned: null,
      parse_confidence: 'NO_MATCH_IN_CONTEXT'
    };
  }

  // Grok-X returned both "author -> text -> URL" and "URL -> author -> text"
  // layouts. Prefer the latter when the handle directly follows this URL.
  const suffixStart = urlIndex >= 0 ? urlIndex + postUrl.length : idIndex + postId.length;
  const directSuffix = raw.slice(suffixStart, suffixStart + 900);
  const suffixAuthorMatch = directSuffix.match(/^\s*(?:\n\s*)?(@[A-Za-z0-9_]+)/u);
  if (suffixAuthorMatch) {
    const authorAccount = suffixAuthorMatch[1];
    const afterAuthor = directSuffix.slice(suffixAuthorMatch[0].length);
    const dateMatch = afterAuthor.match(/\b(20\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?(?:\s*(?:GMT|UTC|JST))?)\b/u);
    const nextUrlMatch = afterAuthor.match(/\n\s*https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//iu);
    const cutAt = Math.min(
      dateMatch?.index ?? Number.POSITIVE_INFINITY,
      nextUrlMatch?.index ?? Number.POSITIVE_INFINITY,
      afterAuthor.indexOf('\nNothing') >= 0 ? afterAuthor.indexOf('\nNothing') : Number.POSITIVE_INFINITY,
      afterAuthor.indexOf('\n(cost:') >= 0 ? afterAuthor.indexOf('\n(cost:') : Number.POSITIVE_INFINITY
    );
    const postText = compactWhitespace(afterAuthor.slice(0, Number.isFinite(cutAt) ? cutAt : undefined));
    return {
      author_account: authorAccount,
      post_text_returned: postText || null,
      posted_at_returned: dateMatch?.[1] ?? null,
      parse_confidence: postText ? 'CONTEXT_PARSED_URL_FIRST' : 'PARTIAL_CONTEXT_PARSED_URL_FIRST'
    };
  }

  const prefix = raw.slice(Math.max(0, idIndex - 1200), idIndex);
  const authorPattern = /(?:^|\n)\s*(?:[-*]\s*)?(@[A-Za-z0-9_]+)/gu;
  const authorMatches = [...prefix.matchAll(authorPattern)];
  const authorMatch = authorMatches.at(-1);
  const authorAccount = authorMatch?.[1] ?? fallbackHandle;
  const contentStart = authorMatch ? authorMatch.index + authorMatch[0].length : Math.max(0, prefix.lastIndexOf('\n'));
  let postText = prefix.slice(contentStart)
    .replace(/^\s*(?:\*\*Post\s+\d+\*\*|\*\*\d{4}年投稿[^*]*\*\*|\*\*\d{4}年[^*]*\*\*)\s*/gu, '')
    .replace(/^\s*(?:[-*]\s*)?/u, '')
    .replace(/\n\s*$/u, '');

  // A result may include the following post heading in its leading context.
  postText = postText.split(/\n\s*(?:[-*]\s*)?@[A-Za-z0-9_]+\s*$/u)[0];
  postText = compactWhitespace(postText);
  const suffix = raw.slice(suffixStart, suffixStart + 220);
  const dateMatch = suffix.match(/\b(20\d{2}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?(?:\s*(?:GMT|UTC|JST))?)\b/u);

  return {
    author_account: authorAccount,
    post_text_returned: postText || null,
    posted_at_returned: dateMatch?.[1] ?? null,
    parse_confidence: authorMatch && postText ? 'CONTEXT_PARSED' : 'PARTIAL_CONTEXT_PARSED'
  };
}

function sortText(left, right) {
  return String(left).localeCompare(String(right), 'ja');
}

const receiptsRoot = readJson(RECEIPTS_PATH);
const existingRoot = readJson(EXISTING_PATH);
const receiptsById = new Map(receiptsRoot.query_receipts.map((receipt) => [receipt.receipt_id, receipt]));
const existingPostIds = new Set((existingRoot.source_records ?? [])
  .map((source) => postIdFromUrl(source.source_url))
  .filter(Boolean));

const candidates = receiptsRoot.unique_x_post_candidates.map((candidate) => {
  const matchingOccurrences = receiptsRoot.query_receipts.flatMap((receipt) => receipt.x_post_occurrences
    .filter((occurrence) => occurrence.post_id === candidate.post_id)
    .map((occurrence) => ({ receipt, occurrence })));
  const parsedContexts = matchingOccurrences.map(({ receipt, occurrence }) => {
    const parsed = extractPostTextFromContext(
      occurrence.surrounding_returned_text,
      occurrence.raw_url_returned,
      candidate.post_id,
      occurrence.author_handle_from_url
    );
    return {
      receipt_id: receipt.receipt_id,
      raw_url_returned: occurrence.raw_url_returned,
      author_handle_from_url: occurrence.author_handle_from_url,
      ...parsed
    };
  });
  const chosen = [...parsedContexts].sort((left, right) => {
    const leftScore = (left.post_text_returned?.length ?? 0) + (left.parse_confidence === 'CONTEXT_PARSED' ? 1000 : 0);
    const rightScore = (right.post_text_returned?.length ?? 0) + (right.parse_confidence === 'CONTEXT_PARSED' ? 1000 : 0);
    return rightScore - leftScore;
  })[0];
  const matchingReceipts = candidate.seen_in_receipt_ids.map((receiptId) => receiptsById.get(receiptId)).filter(Boolean);
  const fingerprint = crypto.createHash('sha256')
    .update(normalizedPostText(chosen?.post_text_returned ?? candidate.post_id))
    .digest('hex')
    .slice(0, 16);

  const uniqueReturnedUrls = [...new Set(parsedContexts.map((context) => context.raw_url_returned).filter(Boolean))].sort(sortText);
  const identityStatus = uniqueReturnedUrls.length === 1
    ? 'SINGLE_RETURNED_URL'
    : uniqueReturnedUrls.length > 1
      ? 'CONFLICTING_RETURNED_URL_FOR_SAME_POST_ID'
      : 'NO_RETURNED_URL';

  return {
    candidate_id: 'GXPOST_' + candidate.post_id,
    player_scope: [...candidate.observed_players].sort(sortText),
    post_id: candidate.post_id,
    post_url: candidate.post_url,
    author_account: uniqueReturnedUrls.length === 1
      ? (parsedContexts.find((context) => context.raw_url_returned === uniqueReturnedUrls[0])?.author_handle_from_url ?? candidate.author_handle_from_url)
      : candidate.author_handle_from_url,
    author_id: null,
    posted_at_returned: chosen?.posted_at_returned ?? null,
    post_text_returned: chosen?.post_text_returned ?? null,
    parse_confidence: chosen?.parse_confidence ?? 'NO_CONTEXT',
    all_parsed_contexts: parsedContexts,
    returned_identity_variants: uniqueReturnedUrls.map((rawUrl) => {
      const contexts = parsedContexts.filter((context) => context.raw_url_returned === rawUrl);
      return {
        raw_url_returned: rawUrl,
        author_handle_from_url: contexts[0]?.author_handle_from_url ?? null,
        receipt_ids: contexts.map((context) => context.receipt_id),
        returned_text_variants: [...new Set(contexts.map((context) => context.post_text_returned).filter(Boolean))],
        returned_posted_at_variants: [...new Set(contexts.map((context) => context.posted_at_returned).filter(Boolean))]
      };
    }),
    identity_status: identityStatus,
    receipt_ids: [...candidate.seen_in_receipt_ids],
    query_kinds: [...new Set(matchingReceipts.map((receipt) => receipt.query_kind))].sort(sortText),
    queries: matchingReceipts.map((receipt) => ({ receipt_id: receipt.receipt_id, query_kind: receipt.query_kind, query: receipt.query })),
    existing_ledger_duplicate: existingPostIds.has(candidate.post_id),
    text_fingerprint: fingerprint,
    review_status: 'PENDING',
    review_note: null
  };
}).sort((left, right) => {
  const playerCompare = sortText(left.player_scope[0], right.player_scope[0]);
  return playerCompare || sortText(left.post_id, right.post_id);
});

const byFingerprint = new Map();
for (const candidate of candidates) {
  const list = byFingerprint.get(candidate.text_fingerprint) ?? [];
  list.push(candidate.post_id);
  byFingerprint.set(candidate.text_fingerprint, list);
}
for (const candidate of candidates) {
  candidate.same_text_candidate_post_ids = (byFingerprint.get(candidate.text_fingerprint) ?? [])
    .filter((postId) => postId !== candidate.post_id)
    .sort(sortText);
}

writeJsonAtomic(OUTPUT_PATH, {
  schema_version: 'speed-2026-grok-x/candidate-review-v1.0.0',
  as_of: '2026-08-10',
  provenance: 'GROK_X_SUPPLEMENT',
  generated_from: {
    raw_receipts: path.relative(ROOT, RECEIPTS_PATH).replaceAll('\\', '/'),
    existing_ledger: path.relative(ROOT, EXISTING_PATH).replaceAll('\\', '/')
  },
  candidate_count: candidates.length,
  candidate_register: candidates
});

console.log(JSON.stringify({ candidate_count: candidates.length, output: path.relative(ROOT, OUTPUT_PATH) }, null, 2));
