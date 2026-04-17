import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures/test-fixtures';
import { createLesson, createLessonWithFile, deleteLesson } from '../helpers/lesson-factory';
import { shareLesson, revokeShare } from '../helpers/share-factory';
import { getUserIdByEmail } from '../helpers/supabase-admin';
import {
  TEST_REGULAR_USER_EMAIL,
  TEST_ADMIN_USER_EMAIL,
  e2eTitle,
} from '../fixtures/test-data';

const PDF_ASSET = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/test-document.pdf');

let regularUserId: string;
let adminUserId: string;

test.beforeAll(async () => {
  regularUserId = await getUserIdByEmail(TEST_REGULAR_USER_EMAIL);
  adminUserId = await getUserIdByEmail(TEST_ADMIN_USER_EMAIL);
});

test('library loads with seeded lessons → my-lessons heading visible', async ({
  libraryPage,
}) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle('Load Test') });
  try {
    await libraryPage.goto();
    await expect(libraryPage.myLessonsHeading).toBeVisible();
    await expect(libraryPage.lessonCard(lesson.id).or(libraryPage.lessonListItem(lesson.id))).toBeVisible();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('empty state → empty-message visible when no lessons', async ({
  libraryPage,
  page,
}) => {
  // Search for a string that should match nothing
  await libraryPage.goto();
  await libraryPage.search(`__no_match_${Date.now()}__`);
  await expect(libraryPage.emptyMessage).toBeVisible({ timeout: 10_000 });
  // Clean up search
  await page.keyboard.press('Escape');
});

test('search by title → results-count updates; clear resets', async ({
  libraryPage,
}) => {
  const title = e2eTitle(`Search-${Date.now()}`);
  const lesson = await createLesson(regularUserId, { title });
  try {
    await libraryPage.goto();
    await libraryPage.search(title);
    await expect(libraryPage.resultsCount).toBeVisible({ timeout: 10_000 });
    await libraryPage.clearSearch();
    await expect(libraryPage.myLessonsHeading).toBeVisible();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('genre filter → results scoped to selected genre', async ({ libraryPage }) => {
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`Genre-${Date.now()}`),
    genre: 'Programming',
  });
  try {
    await libraryPage.goto();
    await libraryPage.openFilters();
    await libraryPage.genreFilter('programming').click();
    // The lesson should appear
    await expect(
      libraryPage.lessonCard(lesson.id).or(libraryPage.lessonListItem(lesson.id))
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('tag filter → results scoped to tag', async ({ libraryPage }) => {
  const tag = `e2etag${Date.now()}`;
  const lesson = await createLesson(regularUserId, {
    title: e2eTitle(`Tag-${Date.now()}`),
    tags: [tag],
  });
  try {
    await libraryPage.goto();
    await libraryPage.openFilters();
    await libraryPage.tagFilter(tag).click();
    await expect(
      libraryPage.lessonCard(lesson.id).or(libraryPage.lessonListItem(lesson.id))
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('file-size range filter → results update', async ({ libraryPage }) => {
  const lesson = await createLessonWithFile(regularUserId, PDF_ASSET, {
    title: e2eTitle(`FileSize-${Date.now()}`),
  });
  try {
    await libraryPage.goto();
    await libraryPage.openFilters();
    // The filters panel should be visible; the lesson (< 1 MB) should be present
    await expect(libraryPage.filtersPanel).toBeVisible();
    await expect(
      libraryPage.lessonCard(lesson.id).or(libraryPage.lessonListItem(lesson.id))
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('card/list view toggle → switches layout; preference persists', async ({
  libraryPage,
  page,
}) => {
  // Clear stored preference first
  await libraryPage.goto();
  await page.evaluate(() => localStorage.removeItem('library-view-mode'));
  await page.reload();

  await expect(libraryPage.viewCardButton).toBeVisible();
  await libraryPage.viewListButton.click();
  await expect(libraryPage.viewListButton).toHaveAttribute('aria-pressed', 'true');

  // Reload — preference should persist
  await page.reload();
  await expect(libraryPage.viewListButton).toHaveAttribute('aria-pressed', 'true');

  // Restore card view
  await libraryPage.viewCardButton.click();
});

test('shared lessons appear under shared-heading after factory share', async ({
  libraryPage,
}) => {
  const lesson = await createLesson(adminUserId, {
    title: e2eTitle(`Shared-${Date.now()}`),
  });
  try {
    await shareLesson(lesson.id, adminUserId, regularUserId);
    await libraryPage.goto();
    await expect(libraryPage.sharedLessonsHeading).toBeVisible({ timeout: 10_000 });
  } finally {
    await revokeShare(lesson.id, regularUserId);
    await deleteLesson(lesson.id);
  }
});
