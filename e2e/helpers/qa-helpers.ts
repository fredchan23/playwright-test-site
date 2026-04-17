import { adminClient } from './supabase-admin';

export async function ensureQaEnabled(): Promise<void> {
  const { error } = await adminClient()
    .from('app_config')
    .upsert({ key: 'qa_enabled', value: 'true' });
  if (error) throw new Error(`ensureQaEnabled failed: ${error.message}`);
}

export async function ensureQaDisabled(): Promise<void> {
  const { error } = await adminClient()
    .from('app_config')
    .upsert({ key: 'qa_enabled', value: 'false' });
  if (error) throw new Error(`ensureQaDisabled failed: ${error.message}`);
}

export async function getQaEnabled(): Promise<boolean> {
  const { data, error } = await adminClient()
    .from('app_config')
    .select('value')
    .eq('key', 'qa_enabled')
    .single();
  if (error) throw new Error(`getQaEnabled failed: ${error.message}`);
  return data?.value === 'true';
}
