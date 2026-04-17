import { adminClient } from './supabase-admin';

export async function shareLesson(
  lessonId: string,
  ownerUserId: string,
  sharedWithUserId: string
): Promise<void> {
  const { error } = await adminClient()
    .from('lesson_shares')
    .insert({
      lesson_id: lessonId,
      owner_id: ownerUserId,
      shared_with_id: sharedWithUserId,
    });

  if (error) throw new Error(`shareLesson failed: ${error.message}`);
}

export async function revokeShare(
  lessonId: string,
  sharedWithUserId: string
): Promise<void> {
  await adminClient()
    .from('lesson_shares')
    .delete()
    .eq('lesson_id', lessonId)
    .eq('shared_with_id', sharedWithUserId);
  // idempotent
}
