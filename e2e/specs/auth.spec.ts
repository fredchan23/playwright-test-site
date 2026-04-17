import { test, expect } from '../fixtures/test-fixtures';
import { adminClient } from '../helpers/supabase-admin';
import { TEST_REGULAR_USER_EMAIL, TEST_REGULAR_USER_PASSWORD } from '../fixtures/test-data';

// Auth spec runs without any storageState — uses bare chromium context
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth — registration', () => {
  test('register with valid credentials → lands on /library', async ({ registerPage, page }) => {
    const uniqueEmail = `e2e-reg-${Date.now()}@test.invalid`;
    const password = 'Password123!';
    let userId: string | undefined;

    try {
      await registerPage.goto();
      await registerPage.register(uniqueEmail, password);
      await expect(page).toHaveURL(/\/library/, { timeout: 15_000 });

      // Capture user ID for cleanup
      const { data } = await adminClient().auth.admin.listUsers();
      const created = data?.users?.find((u) => u.email === uniqueEmail);
      userId = created?.id;
    } finally {
      if (userId) {
        await adminClient().auth.admin.deleteUser(userId);
      }
    }
  });

  test('register with short password → shows password error', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.register(`e2e-short-pw-${Date.now()}@test.invalid`, '123');
    await expect(registerPage.passwordError).toBeVisible();
  });

  test('register with duplicate email → shows email or form error', async ({
    registerPage,
  }) => {
    await registerPage.goto();
    // Use the already-existing regular test user email
    await registerPage.register(TEST_REGULAR_USER_EMAIL, TEST_REGULAR_USER_PASSWORD);
    await expect(
      registerPage.emailError.or(registerPage.formError)
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Auth — login / logout', () => {
  test('login with invalid credentials → shows error message', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('nobody@nowhere.invalid', 'wrongpassword');
    await expect(loginPage.errorMessage).toBeVisible();
  });

  test('logout → lands on /login; /library redirects back to /login', async ({
    loginPage,
    page,
  }) => {
    // Log in first
    await loginPage.goto();
    await loginPage.login(TEST_REGULAR_USER_EMAIL, TEST_REGULAR_USER_PASSWORD);
    await expect(page).toHaveURL(/\/library/, { timeout: 15_000 });

    // Logout via library page
    await page.getByTestId('library-logout-button').click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Protected route redirects back
    await page.goto('/library');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
