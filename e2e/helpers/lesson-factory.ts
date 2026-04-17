import * as fs from 'fs';
import * as path from 'path';
import { adminClient } from './supabase-admin';
import { e2eTitle } from '../fixtures/test-data';

export type CreatedLesson = {
  id: string;
  title: string;
  owner_id: string;
};

type LessonOverrides = {
  title?: string;
  description?: string;
  genre?: string;
  tags?: string[];
};

async function resolveGenreId(genreName: string): Promise<string | null> {
  const { data } = await adminClient()
    .from('genres')
    .select('id')
    .ilike('name', genreName)
    .single();
  return data?.id ?? null;
}

export async function createLesson(
  ownerId: string,
  overrides: LessonOverrides = {}
): Promise<CreatedLesson> {
  const title = overrides.title ?? e2eTitle(`Lesson ${Date.now()}`);
  const description = overrides.description ?? 'E2E test lesson.';
  const tags = overrides.tags ?? [];

  let genreId: string | null = null;
  if (overrides.genre) {
    genreId = await resolveGenreId(overrides.genre);
  }

  const { data, error } = await adminClient()
    .from('lessons')
    .insert({
      owner_id: ownerId,
      title,
      description,
      tags,
      ...(genreId ? { genre_id: genreId } : {}),
    })
    .select('id, title, owner_id')
    .single();

  if (error) throw new Error(`createLesson failed: ${error.message}`);
  return data as CreatedLesson;
}

export async function createLessonWithFile(
  ownerId: string,
  localFilePath: string,
  overrides: LessonOverrides = {}
): Promise<CreatedLesson> {
  const lesson = await createLesson(ownerId, overrides);

  const filename = path.basename(localFilePath);
  const fileBytes = fs.readFileSync(localFilePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.pdf' ? 'application/pdf' : 'image/png';
  const storagePath = `${ownerId}/${lesson.id}/${filename}`;

  const { error: uploadError } = await adminClient()
    .storage
    .from('lesson-files')
    .upload(storagePath, fileBytes, { contentType: mimeType, upsert: true });

  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const { error: dbError } = await adminClient()
    .from('lesson_files')
    .insert({
      lesson_id: lesson.id,
      filename,
      file_type: mimeType,
      file_size: fileBytes.length,
      storage_path: storagePath,
    });

  if (dbError) throw new Error(`lesson_files insert failed: ${dbError.message}`);

  return lesson;
}

export async function deleteLesson(lessonId: string): Promise<void> {
  // Fetch storage paths first so we can remove objects
  const { data: files } = await adminClient()
    .from('lesson_files')
    .select('storage_path')
    .eq('lesson_id', lessonId);

  if (files && files.length > 0) {
    const paths = files.map((f: { storage_path: string }) => f.storage_path);
    await adminClient().storage.from('lesson-files').remove(paths);
  }

  // lesson_files rows cascade-delete with the lesson row
  await adminClient().from('lessons').delete().eq('id', lessonId);
  // idempotent: no error when row does not exist
}
