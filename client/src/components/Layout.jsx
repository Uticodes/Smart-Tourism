import { Link, NavLink, Outlet } from 'react-router-dom';
import Logo from './Logo.jsx';

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-[15px] font-semibold ${
    isActive ? 'bg-green-50 text-green-700' : 'text-granite-700 hover:bg-granite-100'
  }`;

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-granite-200 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" aria-label="Discover Abuja home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Explore
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-granite-200 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-granite-500 sm:px-6">
          Attractions across the Federal Capital Territory, including places reported and confirmed by residents.
        </div>
      </footer>
    </div>
  );
}
