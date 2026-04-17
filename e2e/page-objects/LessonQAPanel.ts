import { type Page, type Locator } from '@playwright/test';

export class LessonQAPanel {
  readonly page: Page;

  readonly panel: Locator;
  readonly input: Locator;
  readonly submitButton: Locator;
  readonly clearButton: Locator;
  readonly saveMdButton: Locator;
  readonly indexingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.getByTestId('lesson-qa-panel');
    this.input = page.getByTestId('lesson-qa-input');
    this.submitButton = page.getByTestId('lesson-qa-submit-button');
    this.clearButton = page.getByTestId('lesson-qa-clear-button');
    this.saveMdButton = page.getByTestId('lesson-qa-save-md-button');
    this.indexingIndicator = page.getByTestId('lesson-qa-indexing-indicator');
  }

  message(idx: number): Locator {
    return this.page.getByTestId(`lesson-qa-message-${idx}`);
  }

  async ask(question: string): Promise<void> {
    await this.input.fill(question);
    await this.submitButton.click();
  }
}
