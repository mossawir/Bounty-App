import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/app/App';
import { store } from '@/app/store';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider } from '@/components/ToastProvider';
import { installGlobalErrorHandlers } from '@/lib/logger';
import '@/styles/base.css';
import '@/styles/components.css';
import '@/styles/pages.css';

installGlobalErrorHandlers();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </BrowserRouter>
      </Provider>
    </ErrorBoundary>
  </StrictMode>,
);
