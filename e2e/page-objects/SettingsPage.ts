import { type Page, type Locator } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  readonly pageTitle: Locator;
  readonly qaToggle: Locator;
  readonly qaToggleLabel: Locator;
  readonly backButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByTestId('settings-page-title');
    this.qaToggle = page.getByTestId('settings-qa-toggle');
    this.qaToggleLabel = page.getByTestId('settings-qa-toggle-label');
    this.backButton = page.getByTestId('settings-back-button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/settings');
  }
}
