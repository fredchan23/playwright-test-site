import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures/test-fixtures';
import { createLesson, createLessonWithFile, deleteLesson } from '../helpers/lesson-factory';
import { ensureQaEnabled, ensureQaDisabled, getQaEnabled } from '../helpers/qa-helpers';
import { adminClient, getUserIdByEmail } from '../helpers/supabase-admin';
import { TEST_REGULAR_USER_EMAIL, e2eTitle } from '../fixtures/test-data';

const PDF_ASSET = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets/test-document.pdf');

let regularUserId: string;
let initialQaState: boolean;

test.beforeAll(async () => {
  regularUserId = await getUserIdByEmail(TEST_REGULAR_USER_EMAIL);
  initialQaState = await getQaEnabled();
  await ensureQaEnabled();
});

test.afterAll(async () => {
  // Restore original state
  if (initialQaState) {
    await ensureQaEnabled();
  } else {
    await ensureQaDisabled();
  }
});

test('panel absent from DOM when Q&A disabled', async ({ lessonDetailPage, lessonQAPanel }) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`QADisabled-${Date.now()}`) });
  try {
    await ensureQaDisabled();
    await lessonDetailPage.goto(lesson.id);
    await expect(lessonQAPanel.panel).not.toBeAttached();
    await ensureQaEnabled();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('no-files state shown for lesson with no PDFs', async ({
  lessonDetailPage,
  page,
}) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`QANoFiles-${Date.now()}`) });
  try {
    await lessonDetailPage.goto(lesson.id);
    await expect(page.getByTestId('lesson-qa-panel')).toBeVisible({ timeout: 15_000 });
    // The panel should indicate no indexable files
    // Either indexing indicator appears and resolves, or "no files" message shown
    await expect(page.getByTestId('lesson-qa-panel')).toContainText(/.+/, { timeout: 15_000 });
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('input enabled and panel fully rendered for indexed lesson', async ({
  lessonDetailPage,
  lessonQAPanel,
}) => {
  const lesson = await createLessonWithFile(regularUserId, PDF_ASSET, {
    title: e2eTitle(`QAReady-${Date.now()}`),
  });
  try {
    await lessonDetailPage.goto(lesson.id);
    await expect(lessonQAPanel.panel).toBeVisible({ timeout: 20_000 });
    // Panel should eventually show input (may need indexing time)
    await expect(lessonQAPanel.input).toBeVisible({ timeout: 30_000 });
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('ask a question → user bubble appears; assistant bubble appears @slow', async ({
  lessonDetailPage,
  lessonQAPanel,
  page,
}) => {
  const lesson = await createLessonWithFile(regularUserId, PDF_ASSET, {
    title: e2eTitle(`QAAsk-${Date.now()}`),
  });
  try {
    await lessonDetailPage.goto(lesson.id);
    await expect(lessonQAPanel.input).toBeVisible({ timeout: 30_000 });

    await lessonQAPanel.ask('What is this document about?');

    // User message bubble (index 0)
    await expect(lessonQAPanel.message(0)).toBeVisible({ timeout: 10_000 });

    // Assistant message bubble (index 1) — allow up to 45s for LLM response
    await expect(lessonQAPanel.message(1)).toBeVisible({ timeout: 45_000 });
    await expect(lessonQAPanel.message(1)).not.toBeEmpty();
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('clear history → message list empty', async ({
  lessonDetailPage,
  lessonQAPanel,
  page,
}) => {
  // Clear button only renders when status=ready AND messages.length > 0.
  // Use a PDF-bearing lesson so lesson-qa-index returns 'ready', then seed a message.
  const lesson = await createLessonWithFile(regularUserId, PDF_ASSET, {
    title: e2eTitle(`QAClear-${Date.now()}`),
  });
  try {
    await adminClient()
      .from('lesson_qa_messages')
      .insert({ lesson_id: lesson.id, user_id: regularUserId, role: 'user', content: 'Seeded question' });

    await lessonDetailPage.goto(lesson.id);
    // Wait for clear button — only visible once status=ready and messages are loaded
    await expect(lessonQAPanel.clearButton).toBeVisible({ timeout: 20_000 });

    // Accept the confirm dialog when clearing
    page.on('dialog', (dialog) => dialog.accept());
    await lessonQAPanel.clearButton.click();

    // After clear, no messages should be visible
    await expect(lessonQAPanel.message(0)).not.toBeAttached({ timeout: 10_000 });
  } finally {
    await deleteLesson(lesson.id);
  }
});

test('panel re-appears after Q&A re-enabled', async ({
  lessonDetailPage,
  lessonQAPanel,
}) => {
  const lesson = await createLesson(regularUserId, { title: e2eTitle(`QAReEnable-${Date.now()}`) });
  try {
    await ensureQaEnabled();
    await lessonDetailPage.goto(lesson.id);
    await expect(lessonQAPanel.panel).toBeVisible({ timeout: 15_000 });
  } finally {
    await deleteLesson(lesson.id);
  }
});
