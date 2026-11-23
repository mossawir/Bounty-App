import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetDb } from '@/mocks/db';

// jsdom does not implement these; the app guards for them, tests need the basics.
if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

// jsdom defines scrollTo but throws "Not implemented", which the app calls on every
// route change; replace it unconditionally so test output stays readable.
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => undefined });

beforeEach(() => {
  resetDb();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});
