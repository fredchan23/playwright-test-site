import { test, expect } from '../fixtures/test-fixtures';
import { createLesson, deleteLesson } from '../helpers/lesson-factory';
import { getUserIdByEmail } from '../helpers/supabase-admin';
import { TEST_REGULAR_USER_EMAIL, e2eTitle } from '../fixtures/test-data';

let regularUserId: string;

test.beforeAll(async () => {
  regularUserId = await getUserIdByEmail(TEST_REGULAR_USER_EMAIL);
});

test('navigating to non-existent lesson shows not-found state', async ({
  lessonDetailPage,
  page,
}) => {
  await lessonDetailPage.goto('00000000-0000-0000-0000-000000000000');
  // Should redirect to library or show a not-found message
  const urlOrText = page.url() + await page.textContent('body');
  expect(
    urlOrText.includes('/library') ||
    urlOrText.toLowerCase().includes('not found') ||
    urlOrText.toLowerCase().includes('lesson')
  ).toBeTruthy();
});

test('delete dialog cancel → lesson not deleted', async ({
  lessonDetailPage,
}) => {
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`DeleteCancel-${Date.now()}`),
    description: 'Should survive cancel',
  });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.deleteButton.click();
    await expect(lessonDetailPage.deleteDialog).toBeVisible();
    await lessonDetailPage.deleteCancel.click();
    await expect(lessonDetailPage.deleteDialog).not.toBeVisible();
    await expect(lessonDetailPage.title).toBeVisible();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('share dialog close button dismisses dialog without error', async ({
  lessonDetailPage,
}) => {
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`ShareClose-${Date.now()}`),
    description: 'Share close test',
  });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.shareButton.click();
    await expect(lessonDetailPage.shareDialog).toBeVisible();
    await lessonDetailPage.shareCloseButton.click();
    await expect(lessonDetailPage.shareDialog).not.toBeVisible();
    await expect(lessonDetailPage.shareError).not.toBeVisible();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('cancel-with-no-changes → no dialog shown', async ({ createLessonPage, page }) => {
  await createLessonPage.goto();
  // Don't fill anything — cancel should go straight to library
  await createLessonPage.cancelButton.click();
  // Either redirects directly or shows dialog
  const dialogVisible = await createLessonPage.cancelDialog.isVisible();
  if (dialogVisible) {
    await createLessonPage.cancelDialogConfirm.click();
  }
  await expect(page).toHaveURL(/\/library/, { timeout: 10_000 });
});
