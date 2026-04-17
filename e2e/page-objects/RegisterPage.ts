import { type Page, type Locator } from '@playwright/test';

export class RegisterPage {
  readonly page: Page;

  readonly form: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly formError: Locator;
  readonly loginLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = page.getByTestId('registration-form');
    this.emailInput = page.getByTestId('registration-email-input');
    this.passwordInput = page.getByTestId('registration-password-input');
    this.submitButton = page.getByTestId('registration-submit-button');
    this.emailError = page.getByTestId('registration-email-error');
    this.passwordError = page.getByTestId('registration-password-error');
    this.formError = page.getByTestId('registration-form-error');
    this.loginLink = page.getByTestId('registration-login-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
  }

  async register(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
