import { type Page, type Locator } from '@playwright/test';

export class LessonDetailPage {
  readonly page: Page;

  readonly title: Locator;
  readonly description: Locator;
  readonly genre: Locator;
  readonly backButton: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly deleteDialog: Locator;
  readonly deleteConfirm: Locator;
  readonly deleteCancel: Locator;
  readonly deleteError: Locator;
  readonly shareButton: Locator;
  readonly shareDialog: Locator;
  readonly shareEmailInput: Locator;
  readonly shareSubmitButton: Locator;
  readonly shareCloseButton: Locator;
  readonly shareError: Locator;
  readonly shareUsersList: Locator;
  readonly shareEmptyList: Locator;
  readonly filesList: Locator;
  readonly noFiles: Locator;
  readonly uploadFilesButton: Locator;
  readonly qaPanel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.getByTestId('lesson-detail-title');
    this.description = page.getByTestId('lesson-detail-description');
    this.genre = page.getByTestId('lesson-detail-genre');
    this.backButton = page.getByTestId('lesson-detail-back-button');
    this.editButton = page.getByTestId('lesson-detail-edit-button');
    this.deleteButton = page.getByTestId('lesson-detail-delete-button');
    this.deleteDialog = page.getByTestId('lesson-detail-delete-dialog');
    this.deleteConfirm = page.getByTestId('lesson-detail-delete-confirm');
    this.deleteCancel = page.getByTestId('lesson-detail-delete-cancel');
    this.deleteError = page.getByTestId('lesson-detail-delete-error');
    this.shareButton = page.getByTestId('lesson-detail-share-button');
    this.shareDialog = page.getByTestId('lesson-share-dialog');
    this.shareEmailInput = page.getByTestId('lesson-share-email-input');
    this.shareSubmitButton = page.getByTestId('lesson-share-submit-button');
    this.shareCloseButton = page.getByTestId('lesson-share-close-button');
    this.shareError = page.getByTestId('lesson-share-error');
    this.shareUsersList = page.getByTestId('lesson-share-users-list');
    this.shareEmptyList = page.getByTestId('lesson-share-empty-list');
    this.filesList = page.getByTestId('lesson-detail-files-list');
    this.noFiles = page.getByTestId('lesson-detail-no-files');
    this.uploadFilesButton = page.getByTestId('lesson-detail-upload-files-button');
    this.qaPanel = page.getByTestId('lesson-qa-panel');
  }

  tag(value: string): Locator {
    return this.page.getByTestId('lesson-detail-tag').filter({ hasText: value });
  }

  file(id: string): Locator {
    return this.page.getByTestId(`lesson-detail-file-${id}`);
  }

  pdfThumbnail(id: string): Locator {
    return this.page.getByTestId(`lesson-file-pdf-thumbnail-${id}`);
  }

  fileDownload(id: string): Locator {
    return this.page.getByTestId(`lesson-file-download-${id}`);
  }

  sharedUser(id: string): Locator {
    return this.page.getByTestId(`lesson-share-user-${id}`);
  }

  shareRemove(userId: string): Locator {
    return this.page.getByTestId(`lesson-share-remove-${userId}`);
  }

  async goto(lessonId: string): Promise<void> {
    await this.page.goto(`/lessons/${lessonId}`);
  }

  async deleteLesson(): Promise<void> {
    await this.deleteButton.click();
    await this.deleteConfirm.click();
  }

  async shareWith(email: string): Promise<void> {
    await this.shareButton.click();
    await this.shareEmailInput.fill(email);
    await this.shareSubmitButton.click();
  }
}
