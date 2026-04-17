import { type Page, type Locator } from '@playwright/test';

export class LibraryPage {
  readonly page: Page;

  readonly myLessonsHeading: Locator;
  readonly sharedLessonsHeading: Locator;
  readonly emptyMessage: Locator;
  readonly searchInput: Locator;
  readonly searchClearButton: Locator;
  readonly resultsCount: Locator;
  readonly filtersToggle: Locator;
  readonly filtersPanel: Locator;
  readonly clearFiltersButton: Locator;
  readonly createLessonButton: Locator;
  readonly emptyCreateButton: Locator;
  readonly logoutButton: Locator;
  readonly settingsButton: Locator;
  readonly viewToggle: Locator;
  readonly viewCardButton: Locator;
  readonly viewListButton: Locator;
  readonly errorBanner: Locator;
  readonly errorRetryButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.myLessonsHeading = page.getByTestId('library-my-lessons-heading');
    this.sharedLessonsHeading = page.getByTestId('library-shared-lessons-heading');
    this.emptyMessage = page.getByTestId('library-empty-message');
    this.searchInput = page.getByTestId('library-search-input');
    this.searchClearButton = page.getByTestId('library-search-clear-button');
    this.resultsCount = page.getByTestId('library-results-count');
    this.filtersToggle = page.getByTestId('library-filters-toggle-button');
    this.filtersPanel = page.getByTestId('library-filters-panel');
    this.clearFiltersButton = page.getByTestId('library-clear-filters-button');
    this.createLessonButton = page.getByTestId('library-create-lesson-button');
    this.emptyCreateButton = page.getByTestId('library-empty-create-button');
    this.logoutButton = page.getByTestId('library-logout-button');
    this.settingsButton = page.getByTestId('library-settings-button');
    this.viewToggle = page.getByTestId('library-view-toggle');
    this.viewCardButton = page.getByTestId('library-view-card-button');
    this.viewListButton = page.getByTestId('library-view-list-button');
    this.errorBanner = page.getByTestId('library-error');
    this.errorRetryButton = page.getByTestId('library-error-retry-button');
  }

  lessonCard(id: string): Locator {
    return this.page.getByTestId(`library-lesson-card-${id}`);
  }

  lessonListItem(id: string): Locator {
    return this.page.getByTestId(`library-lesson-list-${id}`);
  }

  genreFilter(genreName: string): Locator {
    return this.page.getByTestId(`library-filter-genre-${genreName.toLowerCase()}`);
  }

  tagFilter(tag: string): Locator {
    return this.page.getByTestId(`library-filter-tag-${tag.toLowerCase()}`);
  }

  async goto(): Promise<void> {
    await this.page.goto('/library');
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async clearSearch(): Promise<void> {
    await this.searchClearButton.click();
  }

  async openFilters(): Promise<void> {
    await this.filtersToggle.click();
  }
}
