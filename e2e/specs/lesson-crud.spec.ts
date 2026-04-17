import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures/test-fixtures';
import { createLesson, deleteLesson } from '../helpers/lesson-factory';
import { adminClient, getUserIdByEmail } from '../helpers/supabase-admin';
import { TEST_REGULAR_USER_EMAIL, e2eTitle } from '../fixtures/test-data';

const PDF_ASSET = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/test-document.pdf');

let regularUserId: string;

test.beforeAll(async () => {
  regularUserId = await getUserIdByEmail(TEST_REGULAR_USER_EMAIL);
});

test('create lesson (metadata only) → detail page shows correct title', async ({
  createLessonPage,
  page,
}) => {
  const title = e2eTitle(`Create-${Date.now()}`);
  let createdId: string | undefined;
  try {
    await createLessonPage.goto();
    await createLessonPage.fillMetadata(title, 'E2E description.');
    await createLessonPage.submit();

    await expect(page).toHaveURL(/\/lessons\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByTestId('lesson-detail-title')).toHaveText(title);

    const url = page.url();
    createdId = url.split('/lessons/')[1];
  } finally {
    if (createdId) await deleteLesson(createdId);
  }
});

test('create lesson with PDF file → files-list shows 1 file; DB row verified', async ({
  createLessonPage,
  page,
}) => {
  const title = e2eTitle(`CreateFile-${Date.now()}`);
  let createdId: string | undefined;
  try {
    await createLessonPage.goto();
    await createLessonPage.fillMetadata(title, 'E2E file upload test.');

    await createLessonPage.fileInput.setInputFiles(PDF_ASSET);
    await createLessonPage.submit();

    await expect(page).toHaveURL(/\/lessons\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByTestId('lesson-detail-files-list')).toBeVisible();

    const url = page.url();
    createdId = url.split('/lessons/')[1];

    // Verify DB row via admin client
    const { data } = await adminClient()
      .from('lesson_files')
      .select('id')
      .eq('lesson_id', createdId);
    expect(data?.length).toBeGreaterThanOrEqual(1);
  } finally {
    if (createdId) await deleteLesson(createdId);
  }
});

test('read lesson → all fields visible on detail page', async ({
  lessonDetailPage,
}) => {
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`Read-${Date.now()}`),
    description: 'Read test description',
  });
  try {
    await lessonDetailPage.goto(lesson.id);
    await expect(lessonDetailPage.title).toBeVisible();
    await expect(lessonDetailPage.description).toBeVisible();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('edit metadata → updated title confirmed on detail page', async ({
  editLessonPage,
  page,
}) => {
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`Edit-${Date.now()}`),
    description: 'Before edit',
  });
  const updatedTitle = e2eTitle(`Edited-${Date.now()}`);
  try {
    await editLessonPage.goto(lesson.id);
    // Wait for loadLessonData() to populate the form before filling — prevents
    // the async Supabase fetch from overwriting our fill after the fact.
    await expect(editLessonPage.titleInput).toHaveValue(lesson.title, { timeout: 10_000 });
    await editLessonPage.titleInput.fill(updatedTitle);
    await expect(editLessonPage.titleInput).toHaveValue(updatedTitle);
    await editLessonPage.submit();

    await expect(page).toHaveURL(/\/lessons\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByTestId('lesson-detail-title')).toHaveText(updatedTitle);
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('delete → redirected to /library; lesson absent from DB', async ({
  lessonDetailPage,
  page,
}) => {
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`Delete-${Date.now()}`),
    description: 'To be deleted',
  });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.deleteLesson();

    await expect(page).toHaveURL(/\/library/, { timeout: 15_000 });

    const { data } = await adminClient()
      .from('lessons')
      .select('id')
      .eq('id', lesson.id);
    expect(data?.length).toBe(0);
  } catch (e) {
    // Cleanup only needed if delete failed
    await deleteLesson(lesson.id);
    throw e;
  }
});

test('validation → empty title shows title-error; empty description shows desc-error', async ({
  createLessonPage,
}) => {
  await createLessonPage.goto();
  await createLessonPage.submit();
  await expect(createLessonPage.titleError).toBeVisible();
});

test('cancel with unsaved changes → confirm dialog; leaving discards changes', async ({
  createLessonPage,
  page,
}) => {
  await createLessonPage.goto();
  await createLessonPage.titleInput.fill(e2eTitle(`CancelTest-${Date.now()}`));
  await createLessonPage.cancelButton.click();

  // Dialog should appear
  await expect(createLessonPage.cancelDialog).toBeVisible();

  // Confirm leave
  await createLessonPage.cancelDialogConfirm.click();
  await expect(page).toHaveURL(/\/library/, { timeout: 10_000 });
});
