import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import {
  TEST_REGULAR_USER_EMAIL,
  TEST_REGULAR_USER_PASSWORD,
  TEST_ADMIN_USER_EMAIL,
  TEST_ADMIN_USER_PASSWORD,
} from './test-data';

const _dir = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.resolve(_dir, '../.auth');

async function loginAndSave(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  outFile: string
): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('login-email-input').fill(email);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-submit-button').click();
  await expect(page).toHaveURL(/\/library/, { timeout: 15_000 });
  await page.context().storageState({ path: outFile });
}

setup('authenticate regular user', async ({ page }) => {
  if (!TEST_REGULAR_USER_EMAIL || !TEST_REGULAR_USER_PASSWORD) {
    throw new Error('TEST_REGULAR_USER_EMAIL and TEST_REGULAR_USER_PASSWORD must be set in e2e/.env.test');
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await loginAndSave(
    page,
    TEST_REGULAR_USER_EMAIL,
    TEST_REGULAR_USER_PASSWORD,
    path.join(AUTH_DIR, 'regular-user.json')
  );
});

setup('authenticate admin user', async ({ page }) => {
  if (!TEST_ADMIN_USER_EMAIL || !TEST_ADMIN_USER_PASSWORD) {
    throw new Error('TEST_ADMIN_USER_EMAIL and TEST_ADMIN_USER_PASSWORD must be set in e2e/.env.test');
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  await loginAndSave(
    page,
    TEST_ADMIN_USER_EMAIL,
    TEST_ADMIN_USER_PASSWORD,
    path.join(AUTH_DIR, 'admin-user.json')
  );
});
