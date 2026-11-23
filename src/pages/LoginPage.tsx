import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useLoginMutation } from '@/app/api';
import {
  clearNotice,
  selectAuthNotice,
  selectIsAuthenticated,
  signedIn,
} from '@/features/auth/authSlice';
import { safeNextPath } from '@/features/auth/nextPath';
import { useToast } from '@/components/toastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { normalizeError, messageFor } from '@/api/errors';
import { AlertIcon, LockIcon } from '@/components/icons';
import type { AppError } from '@/types/domain';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginPage() {
  useDocumentTitle('Sign in');
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const signedInAlready = useAppSelector(selectIsAuthenticated);
  const notice = useAppSelector(selectAuthNotice);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<AppError | null>(null);
  const [login, { isLoading }] = useLoginMutation();

  const next = safeNextPath(params.get('next'));
  const submitting = useRef(false);

  if (signedInAlready) return <Navigate to={next} replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    // Guard against a double click landing two requests before `isLoading` paints.
    if (submitting.current) return;
    submitting.current = true;

    const errors: Record<string, string> = {};
    if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.';
    if (password.length < 6) errors.password = 'Passwords are at least 6 characters.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      submitting.current = false;
      document.getElementById(errors.email ? 'login-email' : 'login-password')?.focus();
      return;
    }

    setFieldErrors({});
    setFormError(null);

    try {
      const result = await login({ email: email.trim(), password }).unwrap();
      dispatch(signedIn(result));
      dispatch(clearNotice());
      toast.push(`Welcome back, ${result.user.name}`, 'success');
      navigate(next, { replace: true });
    } catch (error) {
      const appError = normalizeError(error);
      setFormError(appError);
      const details =
        appError.kind === 'bad_request'
          ? Object.fromEntries(
              Object.entries(appError.fieldErrors ?? {}).filter(
                ([key]) => key === 'email' || key === 'password',
              ),
            )
          : {};
      setFieldErrors(details);
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="container">
      <div className="login-wrap">
        <div className="login-card">
          <p className="eyebrow">Members of the bazaar</p>
          <h1>Sign in to check out</h1>
          <p className="muted" style={{ fontSize: 14 }}>
            Your cart is waiting. Signing in brings you straight back to it.
          </p>

          {notice ? (
            <div className="form-error" role="status" style={{ marginTop: 16 }}>
              <AlertIcon size={18} aria-hidden="true" />
              <span>{notice}</span>
            </div>
          ) : null}

          {formError && Object.keys(fieldErrors).length === 0 ? (
            <div className="form-error" role="alert" style={{ marginTop: 16 }}>
              <AlertIcon size={18} aria-hidden="true" />
              <span>
                {formError.status === 401
                  ? 'That email and password do not match an account.'
                  : messageFor(formError)}
              </span>
            </div>
          ) : null}

          <form className="login-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setFieldErrors((current) => ({ ...current, email: '' }));
                }}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                placeholder="demo@bugbazaar.dev"
              />
              {fieldErrors.email ? (
                <p className="field-error" id="login-email-error" role="alert">
                  <AlertIcon size={14} aria-hidden="true" />
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                className="input"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, password: '' }));
                }}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                placeholder="••••••••"
              />
              {fieldErrors.password ? (
                <p className="field-error" id="login-password-error" role="alert">
                  <AlertIcon size={14} aria-hidden="true" />
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
              <LockIcon size={15} aria-hidden="true" />
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="demo-hint">
            <strong>Demo account</strong>
            <br />
            <span>demo@bugbazaar.dev</span>
            <br />
            <span>bazaar123</span>
            <br />
            <button
              type="button"
              className="btn btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                setEmail('demo@bugbazaar.dev');
                setPassword('bazaar123');
                setFieldErrors({});
                setFormError(null);
              }}
            >
              Fill demo credentials
            </button>
          </div>

          <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
            Need to look around first? <Link to="/">Keep browsing</Link> — the cart is saved.
          </p>
        </div>
      </div>
    </div>
  );
}
