import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { Spinner } from '@/components/StateViews';

/**
 * Route-level code splitting: the landing page ships first, the checkout flow
 * arrives only when it is needed. Sizes before/after are in docs/performance.md.
 */
const HomePage = lazy(async () => ({ default: (await import('@/pages/HomePage')).HomePage }));
const ProductDetailPage = lazy(async () => ({
  default: (await import('@/pages/ProductDetailPage')).ProductDetailPage,
}));
const CartPage = lazy(async () => ({ default: (await import('@/pages/CartPage')).CartPage }));
const CheckoutPage = lazy(async () => ({
  default: (await import('@/pages/CheckoutPage')).CheckoutPage,
}));
const LoginPage = lazy(async () => ({ default: (await import('@/pages/LoginPage')).LoginPage }));
const AccountPage = lazy(async () => ({
  default: (await import('@/pages/AccountPage')).AccountPage,
}));
const OrderPage = lazy(async () => ({ default: (await import('@/pages/OrderPage')).OrderPage }));
const NotFoundPage = lazy(async () => ({
  default: (await import('@/pages/NotFoundPage')).NotFoundPage,
}));

function RouteFallback() {
  return (
    <div className="container" style={{ paddingBlock: 80, display: 'grid', placeItems: 'center' }}>
      <Spinner label="Opening the stall…" />
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route
            path="checkout"
            element={
              <RequireAuth>
                <CheckoutPage />
              </RequireAuth>
            }
          />
          <Route
            path="orders/:id"
            element={
              <RequireAuth>
                <OrderPage />
              </RequireAuth>
            }
          />
          <Route path="login" element={<LoginPage />} />
          <Route
            path="account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
