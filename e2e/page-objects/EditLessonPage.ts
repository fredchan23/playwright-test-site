import { type Page, type Locator } from '@playwright/test';

export class EditLessonPage {
  readonly page: Page;

  readonly form: Locator;
  readonly titleInput: Locator;
  readonly titleError: Locator;
  readonly descriptionInput: Locator;
  readonly descriptionError: Locator;
  readonly genreDropdown: Locator;
  readonly tagsInput: Locator;
  readonly fileInput: Locator;
  readonly chooseFilesButton: Locator;
  readonly fileError: Locator;
  readonly formError: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly backButton: Locator;
  readonly cancelDialog: Locator;
  readonly cancelDialogConfirm: Locator;
  readonly cancelDialogCancel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.form = page.getByTestId('edit-lesson-form');
    this.titleInput = page.getByTestId('edit-lesson-title-input');
    this.titleError = page.getByTestId('edit-lesson-title-error');
    this.descriptionInput = page.getByTestId('edit-lesson-description-input');
    this.descriptionError = page.getByTestId('edit-lesson-description-error');
    this.genreDropdown = page.getByTestId('edit-lesson-genre-dropdown');
    this.tagsInput = page.getByTestId('edit-lesson-tags-input');
    this.fileInput = page.getByTestId('edit-lesson-file-input');
    this.chooseFilesButton = page.getByTestId('edit-lesson-choose-files-button');
    this.fileError = page.getByTestId('edit-lesson-file-error');
    this.formError = page.getByTestId('edit-lesson-form-error');
    this.saveButton = page.getByTestId('edit-lesson-save-button');
    this.cancelButton = page.getByTestId('edit-lesson-cancel-button');
    this.backButton = page.getByTestId('edit-lesson-back-button');
    this.cancelDialog = page.getByTestId('edit-lesson-cancel-dialog');
    this.cancelDialogConfirm = page.getByTestId('edit-lesson-cancel-dialog-confirm');
    this.cancelDialogCancel = page.getByTestId('edit-lesson-cancel-dialog-cancel');
  }

  tagChip(tag: string): Locator {
    return this.page.getByTestId(`edit-lesson-tag-chip-${tag}`);
  }

  tagRemove(tag: string): Locator {
    return this.page.getByTestId(`edit-lesson-tag-remove-${tag}`);
  }

  existingFile(id: string): Locator {
    return this.page.getByTestId(`edit-lesson-existing-file-${id}`);
  }

  existingFileRemove(id: string): Locator {
    return this.page.getByTestId(`edit-lesson-existing-file-remove-${id}`);
  }

  newFile(index: number): Locator {
    return this.page.getByTestId(`edit-lesson-new-file-${index}`);
  }

  newFileRemove(index: number): Locator {
    return this.page.getByTestId(`edit-lesson-new-file-remove-${index}`);
  }

  async goto(lessonId: string): Promise<void> {
    await this.page.goto(`/lessons/${lessonId}/edit`);
  }

  async submit(): Promise<void> {
    await this.saveButton.click();
  }
}
