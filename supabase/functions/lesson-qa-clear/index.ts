import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  let lesson_id: string;
  try {
    ({ lesson_id } = await req.json());
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!lesson_id) return json({ error: 'Missing lesson_id' }, 400);

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

  // Get user id
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  // Delete all messages for this user + lesson
  const admin = createClient(supabaseUrl, serviceRoleKey);
  await admin
    .from('lesson_qa_messages')
    .delete()
    .eq('lesson_id', lesson_id)
    .eq('user_id', user.id);

  return new Response(null, { status: 204, headers: CORS_HEADERS });
});
