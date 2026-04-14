import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constants ─────────────────────────────────────────────────────────────────

const GCP_PROJECT = 'automatic-ace-488412-a7';
const GCP_LOCATION = 'asia-southeast1';
const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_QUESTION_CHARS = 500;
const HISTORY_LIMIT = 6;

const INJECTION_PATTERNS = [
  'ignore previous instructions',
  'ignore all instructions',
  'forget everything',
  'system:',
  'disregard',
  'new instruction',
  'you are now',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── GCP service account JWT auth ──────────────────────────────────────────────

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlBuf(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getGcpAccessToken(saKeyJson: string): Promise<string> {
  const sa = JSON.parse(saKeyJson);
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const pemBody = (sa.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyBytes = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  const jwt = `${header}.${payload}.${b64urlBuf(sigBuf)}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const body = await tokenResp.text();
    throw new Error(`GCP token exchange HTTP ${tokenResp.status}: ${body.slice(0, 200)}`);
  }
  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error(`GCP token exchange failed: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token as string;
}

// ── Base64 helper ─────────────────────────────────────────────────────────────

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(binary);
}

// ── Main handler ──────────────────────────────────────────────────────────────

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  // Parse body
  let lesson_id: string;
  let question: string;
  try {
    ({ lesson_id, question } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!lesson_id) return json({ error: 'Missing lesson_id' }, 400);
  if (!question) return json({ error: 'Missing question' }, 400);

  // Guardrails
  if (question.length > MAX_QUESTION_CHARS) {
    return json({ error: `Question must be ${MAX_QUESTION_CHARS} characters or fewer` }, 400);
  }
  const lowerQ = question.toLowerCase();
  if (INJECTION_PATTERNS.some(p => lowerQ.includes(p))) {
    return json({ error: 'Question contains disallowed content' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Check qa_enabled
  const { data: config } = await admin
    .from('app_config')
    .select('value')
    .eq('key', 'qa_enabled')
    .single();
  if (config?.value === 'false') {
    return json({ error: 'Q&A is currently disabled' }, 403);
  }

  // Verify user has access to this lesson
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: lesson } = await userClient
    .from('lessons')
    .select('id')
    .eq('id', lesson_id)
    .maybeSingle();
  if (!lesson) return json({ error: 'Lesson not found or access denied' }, 404);

  // Get user id from JWT
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const userId = user.id;

  // Load conversation history (last N messages, chronological order)
  const { data: historyRows } = await admin
    .from('lesson_qa_messages')
    .select('role, content')
    .eq('lesson_id', lesson_id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = (historyRows ?? []).reverse();

  // Fetch PDF files for this lesson
  const { data: pdfFiles } = await admin
    .from('lesson_files')
    .select('id, filename, storage_path')
    .eq('lesson_id', lesson_id)
    .eq('file_type', 'application/pdf');

  if (!pdfFiles?.length) {
    return json({ error: 'No PDF files found for this lesson' }, 400);
  }

  // Get GCP access token
  const saKey = Deno.env.get('GCP_VERTEX_SA_KEY');
  if (!saKey) throw new Error('GCP_VERTEX_SA_KEY secret is not set');
  const accessToken = await getGcpAccessToken(saKey);

  // Download all PDFs
  const pdfParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  for (const file of pdfFiles) {
    const { data: blob, error: dlErr } = await admin.storage
      .from('lesson-files')
      .download(file.storage_path);
    if (dlErr || !blob) {
      console.error(`Failed to download "${file.filename}":`, dlErr?.message);
      continue;
    }
    pdfParts.push({
      inlineData: { mimeType: 'application/pdf', data: toBase64(await blob.arrayBuffer()) },
    });
  }

  if (pdfParts.length === 0) {
    return json({ error: 'Could not download any PDF files for this lesson' }, 500);
  }

  // Build Gemini request
  // First turn: PDF files + system instruction
  const systemInstruction =
    'You are a Q&A assistant for this lesson. ' +
    'Answer ONLY using the content from the provided lesson PDF files. ' +
    "If the answer is not in the lesson content, say exactly: \"I can't find an answer to that in this lesson.\" " +
    'Do not use any knowledge outside the provided files. ' +
    'Be concise and cite relevant details from the lesson where helpful.';

  type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
  type GeminiContent = { role: string; parts: GeminiPart[] };

  const contents: GeminiContent[] = [
    {
      role: 'user',
      parts: [
        ...pdfParts,
        { text: systemInstruction },
      ],
    },
    {
      role: 'model',
      parts: [{ text: 'Understood. I will answer questions strictly based on the provided lesson PDF files.' }],
    },
  ];

  // Append prior conversation turns
  for (const msg of history) {
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  // Append the new question
  contents.push({ role: 'user', parts: [{ text: question }] });

  const url =
    `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT}` +
    `/locations/${GCP_LOCATION}/publishers/google/models/${GEMINI_MODEL}:generateContent`;

  const geminiResp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
  });

  if (!geminiResp.ok) {
    const err = await geminiResp.text();
    throw new Error(`Gemini API failed (${geminiResp.status}): ${err.slice(0, 300)}`);
  }

  const geminiData = await geminiResp.json();
  const answer: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  if (!answer) {
    return json({ error: 'No response from model' }, 500);
  }

  // Persist messages (skip if model couldn't find the answer)
  const cannotFind = answer.toLowerCase().includes("i can't find an answer");
  if (!cannotFind) {
    await admin.from('lesson_qa_messages').insert([
      { lesson_id, user_id: userId, role: 'user', content: question },
      { lesson_id, user_id: userId, role: 'assistant', content: answer },
    ]);
  }

  return json({ answer });
});
