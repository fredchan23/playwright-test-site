export const E2E_PREFIX = '[E2E]';

export function e2eTitle(suffix: string): string {
  return `${E2E_PREFIX} ${suffix}`;
}

export const TEST_REGULAR_USER_EMAIL = process.env.TEST_REGULAR_USER_EMAIL ?? '';
export const TEST_REGULAR_USER_PASSWORD = process.env.TEST_REGULAR_USER_PASSWORD ?? '';
export const TEST_ADMIN_USER_EMAIL = process.env.TEST_ADMIN_USER_EMAIL ?? '';
export const TEST_ADMIN_USER_PASSWORD = process.env.TEST_ADMIN_USER_PASSWORD ?? '';

export type LessonSeed = {
  title: string;
  description: string;
  genre?: string;
  tags?: string[];
};

export const DEFAULT_LESSON_SEED: LessonSeed = {
  title: e2eTitle('Default Lesson'),
  description: 'An E2E test lesson created by the factory.',
};
