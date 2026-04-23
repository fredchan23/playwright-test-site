/**
 * API integration tests for the lesson-metadata-suggest edge function.
 * These tests run against the deployed function — no browser needed.
 * Signs in as the test user to get a real user JWT for Bearer auth.
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://fmuvxhjqqasdvxggggki.supabase.co';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/lesson-metadata-suggest`;

let userJwt: string;

test.beforeAll(async () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set — run from e2e/.env.test');
  const client = createClient(SUPABASE_URL, key);
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.TEST_REGULAR_USER_EMAIL!,
    password: process.env.TEST_REGULAR_USER_PASSWORD!,
  });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);
  userJwt = data.session.access_token;
});

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${userJwt}` };
}

// Minimal 1×1 white PNG in base64 (valid image, tiny)
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.describe('lesson-metadata-suggest edge function', () => {
  // ── Auth guard ────────────────────────────────────────────────────────────
  test('returns 401 when Authorization header is absent', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      data: { file_data: 'abc', mime_type: 'application/pdf' },
    });
    expect(resp.status()).toBe(401);
  });

  // ── Input validation ──────────────────────────────────────────────────────
  test('returns 400 when file_data is missing', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { mime_type: 'application/pdf' },
    });
    expect(resp.status()).toBe(400);
    expect((await resp.json()).error).toMatch(/file_data/i);
  });

  test('returns 400 when mime_type is missing', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { file_data: 'abc' },
    });
    expect(resp.status()).toBe(400);
    expect((await resp.json()).error).toMatch(/mime_type/i);
  });

  test('returns 400 for unsupported mime_type text/plain', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { file_data: 'abc', mime_type: 'text/plain' },
    });
    expect(resp.status()).toBe(400);
    expect((await resp.json()).error).toMatch(/unsupported/i);
  });

  // ── image/jpg normalisation (RED until fix is deployed) ───────────────────
  // CreateLessonPage.tsx allows 'image/jpg' (line 17) — some OSes use this
  // non-standard MIME type for JPEG files. The function must accept it too,
  // normalising to 'image/jpeg' before forwarding to Gemini.
  test('accepts image/jpg and does not return 400 validation error', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { file_data: TINY_PNG_BASE64, mime_type: 'image/jpg' },
    });
    // Must NOT be a 400 (validation rejection). 200 or 500 (Gemini) are both fine.
    expect(resp.status()).not.toBe(400);
  });

  // ── Size cap ──────────────────────────────────────────────────────────────
  test('returns 400 when file_data exceeds 7 MB base64 limit', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { file_data: 'a'.repeat(7_000_001), mime_type: 'image/png' },
    });
    expect(resp.status()).toBe(400);
    expect((await resp.json()).error).toMatch(/7 MB/i);
  });

  // ── Happy path — valid image ──────────────────────────────────────────────
  test('returns 200 with metadata fields for a valid image', async ({ request }) => {
    const resp = await request.post(FUNCTION_URL, {
      headers: authHeader(),
      data: { file_data: TINY_PNG_BASE64, mime_type: 'image/png' },
    });
    // Gemini may not extract meaningful data from a 1×1 pixel, but 200 means
    // the function ran end-to-end without a validation or infrastructure error.
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    // At minimum the response must be a JSON object (no error key)
    expect(typeof body).toBe('object');
    expect(body.error).toBeUndefined();
  });
});
