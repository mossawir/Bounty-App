import { Outlet } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteAnnouncer } from '@/components/RouteAnnouncer';
import { BackToTop } from '@/components/BackToTop';
import { DevLab } from '@/components/DevLab';
import { useStockFeed } from '@/hooks/useStockFeed';

const showDevLab = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEVTOOLS === 'true';

export function Layout() {
  // The live feed lives exactly as long as the shell does.
  useStockFeed();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      <RouteAnnouncer />
      {showDevLab ? <DevLab /> : null}
    </div>
  );
}
