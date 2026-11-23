import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { createAppStore, type PreloadedAppState } from '@/app/store';
import { ToastProvider } from '@/components/ToastProvider';

export function makeTestStore(preloaded?: PreloadedAppState) {
  return createAppStore(preloaded);
}

interface Options {
  route?: string;
  preloaded?: PreloadedAppState;
}

/** Render with the same providers the app uses, minus the browser router. */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const store = makeTestStore(options.preloaded);
  const result = render(
    <Provider store={store}>
      <MemoryRouter
        initialEntries={[options.route ?? '/']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <ToastProvider>{ui}</ToastProvider>
      </MemoryRouter>
    </Provider>,
  );
  return { ...result, store };
}
