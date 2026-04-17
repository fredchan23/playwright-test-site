import { type Page, type Locator } from '@playwright/test';

export class CreateLessonPage {
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
  readonly uploadDropzone: Locator;
  readonly filesList: Locator;
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
    this.form = page.getByTestId('create-lesson-form');
    this.titleInput = page.getByTestId('create-lesson-title-input');
    this.titleError = page.getByTestId('create-lesson-title-error');
    this.descriptionInput = page.getByTestId('create-lesson-description-input');
    this.descriptionError = page.getByTestId('create-lesson-description-error');
    this.genreDropdown = page.getByTestId('create-lesson-genre-dropdown');
    this.tagsInput = page.getByTestId('create-lesson-tags-input');
    this.fileInput = page.getByTestId('create-lesson-file-input');
    this.chooseFilesButton = page.getByTestId('create-lesson-choose-files-button');
    this.uploadDropzone = page.getByTestId('create-lesson-upload-dropzone');
    this.filesList = page.getByTestId('create-lesson-files-list');
    this.fileError = page.getByTestId('create-lesson-file-error');
    this.formError = page.getByTestId('create-lesson-form-error');
    this.saveButton = page.getByTestId('create-lesson-save-button');
    this.cancelButton = page.getByTestId('create-lesson-cancel-button');
    this.backButton = page.getByTestId('create-lesson-back-button');
    this.cancelDialog = page.getByTestId('create-lesson-cancel-dialog');
    this.cancelDialogConfirm = page.getByTestId('create-lesson-cancel-dialog-confirm');
    this.cancelDialogCancel = page.getByTestId('create-lesson-cancel-dialog-cancel');
  }

  genreOption(genreName: string): Locator {
    return this.page.getByTestId(`create-lesson-genre-option-${genreName.toLowerCase()}`);
  }

  tagChip(tag: string): Locator {
    return this.page.getByTestId(`create-lesson-tag-chip-${tag}`);
  }

  tagRemove(tag: string): Locator {
    return this.page.getByTestId(`create-lesson-tag-remove-${tag}`);
  }

  fileItem(index: number): Locator {
    return this.page.getByTestId(`create-lesson-file-item-${index}`);
  }

  fileRemove(index: number): Locator {
    return this.page.getByTestId(`create-lesson-file-remove-${index}`);
  }

  async goto(): Promise<void> {
    await this.page.goto('/lessons/create');
  }

  async fillMetadata(title: string, description: string): Promise<void> {
    await this.titleInput.fill(title);
    await this.descriptionInput.fill(description);
  }

  async submit(): Promise<void> {
    await this.saveButton.click();
  }
}
