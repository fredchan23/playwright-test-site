import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures/test-fixtures';
import { createLessonWithFile, deleteLesson } from '../helpers/lesson-factory';
import { ensureQaEnabled, getQaEnabled, ensureQaDisabled } from '../helpers/qa-helpers';
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
  if (initialQaState) {
    await ensureQaEnabled();
  } else {
    await ensureQaDisabled();
  }
});

test('LaTeX in assistant response renders as KaTeX HTML', async ({
  page, lessonDetailPage,
}) => {
  const lesson = await createLessonWithFile(regularUserId, PDF_ASSET, {
    title: e2eTitle(`LaTeX-${Date.now()}`),
  });
  try {
    await adminClient()
      .from('lesson_qa_messages')
      .insert({
        lesson_id: lesson.id,
        user_id: regularUserId,
        role: 'assistant',
        content: 'The formula is $x^2 + y^2 = z^2$ and the sum is $\\sum_{i=1}^{n} x_i$.',
      });

    await lessonDetailPage.goto(lesson.id);

    const message = page.locator('[data-testid="lesson-qa-message-0"]');
    await expect(message).toBeVisible({ timeout: 20_000 });

    // KaTeX-rendered math has class="katex" on the root span
    const katexEl = message.locator('.katex').first();
    await expect(katexEl).toBeAttached();
  } finally {
    await deleteLesson(lesson.id);
  }
});
