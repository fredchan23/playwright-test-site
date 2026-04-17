import { test as base } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';
import { RegisterPage } from '../page-objects/RegisterPage';
import { LibraryPage } from '../page-objects/LibraryPage';
import { LessonDetailPage } from '../page-objects/LessonDetailPage';
import { CreateLessonPage } from '../page-objects/CreateLessonPage';
import { EditLessonPage } from '../page-objects/EditLessonPage';
import { SettingsPage } from '../page-objects/SettingsPage';
import { LessonQAPanel } from '../page-objects/LessonQAPanel';

type PageObjects = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  libraryPage: LibraryPage;
  lessonDetailPage: LessonDetailPage;
  createLessonPage: CreateLessonPage;
  editLessonPage: EditLessonPage;
  settingsPage: SettingsPage;
  lessonQAPanel: LessonQAPanel;
};

export const test = base.extend<PageObjects>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  libraryPage: async ({ page }, use) => use(new LibraryPage(page)),
  lessonDetailPage: async ({ page }, use) => use(new LessonDetailPage(page)),
  createLessonPage: async ({ page }, use) => use(new CreateLessonPage(page)),
  editLessonPage: async ({ page }, use) => use(new EditLessonPage(page)),
  settingsPage: async ({ page }, use) => use(new SettingsPage(page)),
  lessonQAPanel: async ({ page }, use) => use(new LessonQAPanel(page)),
});

export { expect } from '@playwright/test';
