import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '../fixtures/test-fixtures';
import { deleteLesson } from '../helpers/lesson-factory';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_ASSET = path.resolve(__dirname, '../assets/test-document.pdf');
const IMG_ASSET = path.resolve(__dirname, '../assets/test-image.png');

const MOCK_METADATA = {
  title: 'Autofill Test Title',
  description: 'Autofill test description from Gemini.',
  tags: ['react', 'hooks', 'javascript'],
  genre: 'Programming',
};

test.describe('AI Metadata Autofill', () => {
  test('shimmer appears while autofill is in-flight', async ({ createLessonPage, page }) => {
    // Delay the response so we can observe the loading state
    await page.route('**/functions/v1/lesson-metadata-suggest', async (route) => {
      await new Promise<void>((r) => setTimeout(r, 800));
      await route.fulfill({ json: MOCK_METADATA });
    });

    await createLessonPage.goto();
    await createLessonPage.fileInput.setInputFiles(PDF_ASSET);

    // Loading indicator must appear immediately
    await expect(createLessonPage.autofillLoading).toBeAttached();

    // Fields must be disabled while in-flight
    await expect(createLessonPage.titleInput).toBeDisabled();
    await expect(createLessonPage.descriptionInput).toBeDisabled();
    await expect(createLessonPage.genreDropdown).toBeDisabled();
    await expect(createLessonPage.tagsInput).toBeDisabled();
    await expect(createLessonPage.saveButton).toBeDisabled();

    // Wait for autofill to complete, then verify loading indicator is gone
    await expect(createLessonPage.autofillLoading).not.toBeAttached({ timeout: 5_000 });
    await expect(createLessonPage.titleInput).toBeEnabled();
  });

  test('fields populate from autofill response', async ({ createLessonPage, page }) => {
    let createdId: string | undefined;
    try {
      await page.route('**/functions/v1/lesson-metadata-suggest', async (route) => {
        await route.fulfill({ json: MOCK_METADATA });
      });

      await createLessonPage.goto();
      await createLessonPage.fileInput.setInputFiles(PDF_ASSET);

      // Wait for autofill to complete by gating on title value
      await expect(createLessonPage.titleInput).toHaveValue(MOCK_METADATA.title, { timeout: 10_000 });
      await expect(createLessonPage.descriptionInput).toHaveValue(MOCK_METADATA.description);

      // Tags are added to the chip list
      for (const tag of MOCK_METADATA.tags) {
        await expect(createLessonPage.tagChip(tag)).toBeVisible();
      }

      // Fields must be re-enabled
      await expect(createLessonPage.titleInput).toBeEnabled();
      await expect(createLessonPage.saveButton).toBeEnabled();

      // Create the lesson to verify genre was also set (submit and check DB via URL)
      await createLessonPage.submit();
      await expect(page).toHaveURL(/\/lessons\/[^/]+$/, { timeout: 15_000 });
      createdId = page.url().split('/lessons/')[1];
    } finally {
      if (createdId) await deleteLesson(createdId);
    }
  });

  test('second file drop does not re-trigger autofill', async ({ createLessonPage, page }) => {
    let callCount = 0;
    await page.route('**/functions/v1/lesson-metadata-suggest', async (route) => {
      callCount++;
      await route.fulfill({ json: MOCK_METADATA });
    });

    await createLessonPage.goto();

    // First file triggers autofill
    await createLessonPage.fileInput.setInputFiles(PDF_ASSET);
    await expect(createLessonPage.titleInput).toHaveValue(MOCK_METADATA.title, { timeout: 10_000 });

    // Second file must NOT trigger a second autofill call
    await createLessonPage.fileInput.setInputFiles(IMG_ASSET);
    await page.waitForTimeout(600);

    expect(callCount).toBe(1);
  });

  test('autofill does not overwrite a pre-filled title', async ({ createLessonPage, page }) => {
    await page.route('**/functions/v1/lesson-metadata-suggest', async (route) => {
      await new Promise<void>((r) => setTimeout(r, 200));
      await route.fulfill({ json: MOCK_METADATA });
    });

    await createLessonPage.goto();

    // Pre-fill the title before dropping a file
    await createLessonPage.titleInput.fill('My Custom Title');

    await createLessonPage.fileInput.setInputFiles(PDF_ASSET);

    // Gate on description being filled (confirms autofill ran)
    await expect(createLessonPage.descriptionInput).toHaveValue(
      MOCK_METADATA.description,
      { timeout: 10_000 },
    );

    // Pre-filled title must be preserved
    await expect(createLessonPage.titleInput).toHaveValue('My Custom Title');
  });
});
