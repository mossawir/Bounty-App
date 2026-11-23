/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When set, the app talks to a real backend at this origin instead of the in-browser mock. */
  readonly VITE_API_BASE_URL?: string;
  /** When set, unexpected errors are POSTed here (see src/lib/logger.ts). */
  readonly VITE_ERROR_REPORT_URL?: string;
  /** "true" forces the bug lab panel on in production builds. */
  readonly VITE_ENABLE_DEVTOOLS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
