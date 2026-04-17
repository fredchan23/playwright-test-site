import { test, expect } from '../fixtures/test-fixtures';
import { createLesson, deleteLesson } from '../helpers/lesson-factory';
import { revokeShare } from '../helpers/share-factory';
import { getUserIdByEmail } from '../helpers/supabase-admin';
import {
  TEST_REGULAR_USER_EMAIL,
  TEST_ADMIN_USER_EMAIL,
  e2eTitle,
} from '../fixtures/test-data';

let regularUserId: string;
let adminUserId: string;

test.beforeAll(async () => {
  regularUserId = await getUserIdByEmail(TEST_REGULAR_USER_EMAIL);
  adminUserId = await getUserIdByEmail(TEST_ADMIN_USER_EMAIL);
});

test('share dialog opens on share-button click', async ({ lessonDetailPage }) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`ShareDialog-${Date.now()}`) });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.shareButton.click();
    await expect(lessonDetailPage.shareDialog).toBeVisible();
    await lessonDetailPage.shareCloseButton.click();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('share with valid user → appears in users list', async ({ lessonDetailPage }) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`ShareUser-${Date.now()}`) });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.shareWith(TEST_ADMIN_USER_EMAIL);
    await expect(lessonDetailPage.shareUsersList).toBeVisible({ timeout: 10_000 });
    // Revoke before cleanup
    await revokeShare(lesson.id, adminUserId);
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('share with self → shows share-error', async ({
  lessonDetailPage,
}) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`ShareSelf-${Date.now()}`) });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.shareWith(TEST_REGULAR_USER_EMAIL);
    await expect(lessonDetailPage.shareError).toBeVisible({ timeout: 10_000 });
    await lessonDetailPage.shareCloseButton.click();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('share with unknown email → shows share-error', async ({ lessonDetailPage }) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`ShareUnknown-${Date.now()}`) });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.shareWith('nobody-unknown@nowhere.invalid');
    await expect(lessonDetailPage.shareError).toBeVisible({ timeout: 10_000 });
    await lessonDetailPage.shareCloseButton.click();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('revoke share → user removed from list', async ({ lessonDetailPage }) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`ShareRevoke-${Date.now()}`) });
  try {
    await lessonDetailPage.goto(lesson.id);
    await lessonDetailPage.shareWith(TEST_ADMIN_USER_EMAIL);
    await expect(lessonDetailPage.shareUsersList).toBeVisible({ timeout: 10_000 });

    // Find the remove button by admin user ID and click it
    await lessonDetailPage.shareRemove(adminUserId).click();
    await expect(lessonDetailPage.shareEmptyList.or(lessonDetailPage.shareUsersList.filter({ hasNot: lessonDetailPage.shareRemove(adminUserId) }))).toBeVisible({ timeout: 10_000 });
  } finally {
    await revokeShare(lesson.id, adminUserId).catch(() => {/* already revoked */});
    await deleteLesson(lesson.id);
  }
});

test('RLS visibility — user B sees shared lesson; after revoke it is gone', async ({
  browser,
}) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`RLS-${Date.now()}`) });
  try {
    // Share with admin (user B)
    const ownerContext = await browser.newContext({
      storageState: 'e2e/.auth/regular-user.json',
    });
    const ownerPage = ownerContext.newPage();
    await (await ownerPage).goto(`/lessons/${lesson.id}`);
    await (await ownerPage).getByTestId('lesson-detail-share-button').click();
    await (await ownerPage).getByTestId('lesson-share-email-input').fill(TEST_ADMIN_USER_EMAIL);
    await (await ownerPage).getByTestId('lesson-share-submit-button').click();
    await expect((await ownerPage).getByTestId('lesson-share-users-list')).toBeVisible({ timeout: 10_000 });
    await ownerContext.close();

    // User B (admin) should see the lesson in their library
    const adminContext = await browser.newContext({
      storageState: 'e2e/.auth/admin-user.json',
    });
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/library');
    await expect(adminPage.getByTestId('library-shared-lessons-heading')).toBeVisible({ timeout: 10_000 });

    // Revoke and verify it's gone
    await revokeShare(lesson.id, adminUserId);
    await adminPage.reload();
    await expect(adminPage.getByTestId('library-shared-lessons-heading')).not.toBeVisible({ timeout: 10_000 });

    // Direct navigation should not show the lesson
    await adminPage.goto(`/lessons/${lesson.id}`);
    // Should either redirect away or show not-found
    const urlOrContent = adminPage.url() + await adminPage.content();
    expect(urlOrContent.includes('/library') || urlOrContent.includes('not found') || urlOrContent.includes('Lesson not found')).toBeTruthy();

    await adminContext.close();
  } finally {
    await revokeShare(lesson.id, adminUserId).catch(() => {/* may already be revoked */});
    await deleteLesson(lesson.id);
  }
});

test('duplicate share → shows share-error', async ({ lessonDetailPage }) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`ShareDup-${Date.now()}`) });
  try {
    await lessonDetailPage.goto(lesson.id);
    // First share
    await lessonDetailPage.shareWith(TEST_ADMIN_USER_EMAIL);
    await expect(lessonDetailPage.shareUsersList).toBeVisible({ timeout: 10_000 });

    // Clear input and try again
    await lessonDetailPage.shareEmailInput.fill(TEST_ADMIN_USER_EMAIL);
    await lessonDetailPage.shareSubmitButton.click();
    await expect(lessonDetailPage.shareError).toBeVisible({ timeout: 10_000 });

    await revokeShare(lesson.id, adminUserId);
    await lessonDetailPage.shareCloseButton.click();
  } finally {
    await revokeShare(lesson.id, adminUserId).catch(() => {/* already revoked */});
    await deleteLesson(lesson.id);
  }
});
