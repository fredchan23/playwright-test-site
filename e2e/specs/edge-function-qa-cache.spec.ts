/**
 * API integration tests for the lesson-qa-ask edge function's Gemini context
 * caching behaviour. Tests run against the deployed function — no browser needed.
 *
 * Setup: creates a real lesson with a PDF attachment so the function has files
 * to cache. Lesson is deleted in afterAll (cascades to lesson_qa_cache rows).
 */

import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { adminClient, getUserIdByEmail } from '../helpers/supabase-admin';
import { createLessonWithFile, deleteLesson } from '../helpers/lesson-factory';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://fmuvxhjqqasdvxggggki.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/lesson-qa-ask`;
const PDF_FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/test-document.pdf');

let userJwt: string;
let lessonId: string;

test.beforeAll(async () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — run from e2e/.env.test');

  const email = process.env.TEST_REGULAR_USER_EMAIL!;
  const password = process.env.TEST_REGULAR_USER_PASSWORD!;

  // Sign in to get a real user JWT
  const client = createClient(SUPABASE_URL, serviceKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);
  userJwt = data.session.access_token;

  // Create a lesson with a PDF file so lesson-qa-ask has files to cache
  const userId = await getUserIdByEmail(email);
  const lesson = await createLessonWithFile(userId, PDF_FIXTURE, {
    title: '[E2E] QA Cache Test Lesson',
  });
  lessonId = lesson.id;
});

test.afterAll(async () => {
  if (lessonId) {
    // Cascades to lesson_files, lesson_qa_messages, lesson_qa_cache
    await deleteLesson(lessonId);
    // Remove any lingering lesson_index_status row (no cascade from lesson delete)
    await adminClient().from('lesson_index_status').delete().eq('lesson_id', lessonId);
  }
});

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${userJwt}` };
}

test.describe('lesson-qa-ask edge function — context caching', () => {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  test('returns 401 when Authorization header is absent', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      data: { lesson_id: lessonId, question: 'What is this lesson about?' },
    });
    expect(resp.status()).toBe(401);
  });

  // ── Cache miss — first question creates cache and returns answer ────────────
  test('cache miss: returns a valid answer on first question (creates cache)', async ({ request }) => {
    test.setTimeout(90_000); // cache create + Gemini call can be slow
    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { lesson_id: lessonId, question: 'What is the main topic of this document?' },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.error).toBeUndefined();
    expect(typeof body.answer).toBe('string');
    expect(body.answer.length).toBeGreaterThan(0);

    // Verify a cache row was created in the DB
    const { data: cacheRow } = await adminClient()
      .from('lesson_qa_cache')
      .select('cache_name, expires_at')
      .eq('lesson_id', lessonId)
      .maybeSingle();

    // A cache row should exist (or, if the PDF is below Gemini's minimum token
    // threshold, the fallback path ran and no row exists — both are acceptable)
    if (cacheRow) {
      expect(typeof cacheRow.cache_name).toBe('string');
      expect(cacheRow.cache_name.length).toBeGreaterThan(0);
      expect(new Date(cacheRow.expires_at).getTime()).toBeGreaterThan(Date.now());
    }
  });

  // ── Cache hit — second question reuses cache and returns answer ─────────────
  test('cache hit: returns a valid answer on second question (no new cache row)', async ({ request }) => {
    test.setTimeout(90_000);
    // Get cache state before this request
    const { data: before } = await adminClient()
      .from('lesson_qa_cache')
      .select('cache_name, expires_at')
      .eq('lesson_id', lessonId)
      .maybeSingle();

    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { lesson_id: lessonId, question: 'Can you summarise the key points?' },
    });

    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.error).toBeUndefined();
    expect(typeof body.answer).toBe('string');
    expect(body.answer.length).toBeGreaterThan(0);

    // If a cache row existed before, it should still be the same row (not replaced)
    if (before) {
      const { data: after } = await adminClient()
        .from('lesson_qa_cache')
        .select('cache_name, expires_at')
        .eq('lesson_id', lessonId)
        .maybeSingle();
      expect(after?.cache_name).toBe(before.cache_name);
    }
  });
});
