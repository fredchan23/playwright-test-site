/**
 * admin-settings.spec.ts
 *
 * Scenarios 2, 4, 5 (admin user) — run only by the chromium-admin project.
 * Scenarios 1, 3, 6 (regular user) — see regular-settings.spec.ts, run by chromium.
 */
import { test, expect } from '../fixtures/test-fixtures';
import { adminClient } from '../helpers/supabase-admin';
import { ensureQaEnabled } from '../helpers/qa-helpers';

test.afterAll(async () => {
  await ensureQaEnabled();
});

test('admin user sees settings-page-title and settings-qa-toggle', async ({
  settingsPage,
}) => {
  await settingsPage.goto();
  await expect(settingsPage.pageTitle).toBeVisible();
  await expect(settingsPage.qaToggle).toBeVisible();
});

test('library-settings-button visible for admin; navigates to /settings', async ({
  libraryPage,
  page,
}) => {
  await libraryPage.goto();
  await expect(libraryPage.settingsButton).toBeVisible();
  await libraryPage.settingsButton.click();
  await expect(page).toHaveURL(/\/settings/, { timeout: 10_000 });
});

test('Q&A toggle: enabled → disabled; DB value verified', async ({
  settingsPage,
}) => {
  await ensureQaEnabled();
  await settingsPage.goto();
  await settingsPage.qaToggle.click();

  // Verify DB
  const { data } = await adminClient()
    .from('app_config')
    .select('value')
    .eq('key', 'qa_enabled')
    .single();
  expect(data?.value).toBe('false');
  await ensureQaEnabled();
});

test('Q&A toggle: disabled → enabled; DB value verified', async ({
  settingsPage,
}) => {
  await settingsPage.goto();
  // Force disabled first
  await adminClient().from('app_config').upsert({ key: 'qa_enabled', value: 'false' });
  await settingsPage.page.reload();

  await settingsPage.qaToggle.click();

  const { data } = await adminClient()
    .from('app_config')
    .select('value')
    .eq('key', 'qa_enabled')
    .single();
  expect(data?.value).toBe('true');
});
