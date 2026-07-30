export const IS_DEMO_MODE = true;

export const DEMO_EMAIL = 'demo@domain.com';
export const DEMO_PASSWORD = 'Abcd1234#';

export const MAX_DEMO_LESSONS = 2;
export const MAX_DEMO_QUESTIONS_PER_SESSION = 2;

const DEMO_QA_KEY = 'demo_session_qa_count';

export function getDemoSessionQaCount(): number {
  const stored = sessionStorage.getItem(DEMO_QA_KEY);
  return stored ? parseInt(stored, 10) || 0 : 0;
}

export function incrementDemoSessionQaCount(): number {
  const current = getDemoSessionQaCount();
  const next = current + 1;
  sessionStorage.setItem(DEMO_QA_KEY, next.toString());
  return next;
}

export function resetDemoSessionQaCount(): void {
  sessionStorage.removeItem(DEMO_QA_KEY);
}
