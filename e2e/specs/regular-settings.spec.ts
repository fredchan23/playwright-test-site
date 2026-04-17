/**
 * regular-settings.spec.ts
 *
 * Settings-related scenarios for regular (non-admin) users — run by the chromium project.
 */
import { test, expect } from '../fixtures/test-fixtures';

test('regular user navigating to /settings is redirected to /library', async ({
  settingsPage,
  page,
}) => {
  await settingsPage.goto();
  await expect(page).toHaveURL(/\/library/, { timeout: 10_000 });
});

test('library-settings-button absent for regular user', async ({ libraryPage }) => {
  await libraryPage.goto();
  await expect(libraryPage.settingsButton).not.toBeVisible();
});
