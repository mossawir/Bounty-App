import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defence. An unexpected render error shows a human fallback instead
 * of a white screen, and the error is logged with its component stack.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, {
      source: 'react-error-boundary',
      componentStack: info.componentStack,
    });
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="container">
        <div className="state" role="alert" style={{ marginBlock: '48px' }}>
          <div className="state-icon" data-tone="error" aria-hidden="true">
            <span style={{ fontSize: 24 }}>!</span>
          </div>
          <h1>Something fell off the shelf</h1>
          <p>
            A part of the store crashed while rendering. The error has been logged, and your cart is
            still saved.
          </p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={this.reset}>
              Try again
            </button>
            <a className="btn" href="/">
              Back to the shop
            </a>
          </div>
          {import.meta.env.DEV ? (
            <pre
              className="mono"
              style={{ fontSize: 11, maxWidth: 640, overflowX: 'auto', textAlign: 'left' }}
            >
              {error.message}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}
