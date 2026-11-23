import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '@/pages/LoginPage';
import { renderWithProviders } from '@/test/utils';
import { DEMO_USER, setChaos } from '@/mocks/db';

describe('LoginPage', () => {
  it('blocks an empty submit with announced field errors and moves focus', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login?next=/checkout' });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Passwords are at least 6 characters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a friendly message for wrong credentials without leaking the raw error', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });

    await user.type(screen.getByLabelText('Email'), DEMO_USER.email);
    await user.type(screen.getByLabelText('Password'), 'not-the-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('That email and password do not match an account.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/INVALID_CREDENTIALS/)).not.toBeInTheDocument();
  });

  it('signs in, stores the session and returns to the intended page', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<LoginPage />, { route: '/login?next=/checkout' });

    await user.click(screen.getByRole('button', { name: 'Fill demo credentials' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(store.getState().auth.token).toMatch(/^bb\./));
    expect(store.getState().auth.user?.email).toBe(DEMO_USER.email);
    expect(await screen.findByText(`Welcome back, ${DEMO_USER.name}`)).toBeInTheDocument();
  });

  it('cannot be double-submitted: two submits in one tick produce one session', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<LoginPage />, { route: '/login' });
    setChaos({ latencyMs: 120, jitterMs: 0 });

    await user.click(screen.getByRole('button', { name: 'Fill demo credentials' }));
    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form');
    expect(form).not.toBeNull();

    fireEvent.submit(form as HTMLFormElement);
    fireEvent.submit(form as HTMLFormElement);

    await waitFor(() => expect(store.getState().auth.token).toMatch(/^bb\./));
    await waitFor(() => expect(screen.getAllByText(/Welcome back/)).toHaveLength(1));
  });
});
