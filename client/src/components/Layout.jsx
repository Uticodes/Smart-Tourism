import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const navClass = ({ isActive }) =>
  `rounded-md px-2 py-2 text-[15px] font-semibold sm:px-3 ${
    isActive ? 'bg-green-50 text-green-700' : 'text-granite-700 hover:bg-granite-100'
  }`;

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const initial = (user.display_name || user.full_name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-granite-100"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-green-600 text-sm font-bold text-white">
          {initial}
        </span>
        <span className="hidden text-[15px] font-semibold sm:inline">{user.display_name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-granite-200 bg-surface py-1 shadow-lg">
          <p className="truncate px-4 py-2 text-sm text-granite-500">{user.email}</p>
          <Link role="menuitem" to="/report" className="block px-4 py-2 text-[15px] hover:bg-granite-100">Add a place</Link>
          <Link role="menuitem" to="/reports/mine" className="block px-4 py-2 text-[15px] hover:bg-granite-100">Your reports</Link>
          <Link role="menuitem" to="/community" className="block px-4 py-2 text-[15px] hover:bg-granite-100 sm:hidden">Check new places</Link>
          <Link role="menuitem" to="/preferences" className="block px-4 py-2 text-[15px] hover:bg-granite-100">Your interests</Link>
          {user.role === 'admin' && (
            <Link role="menuitem" to="/admin/reports" className="block px-4 py-2 text-[15px] hover:bg-granite-100">Admin</Link>
          )}
          <button role="menuitem" type="button" onClick={onLogout} className="block w-full px-4 py-2 text-left text-[15px] hover:bg-granite-100">
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function onLogout() {
    await logout();
    navigate('/', { replace: true });
  }

  return (
    <div className={`flex flex-col ${pathname === '/explore' ? 'fixed inset-0 overflow-clip' : 'min-h-screen'}`}>
      <header className="sticky top-0 z-40 shrink-0 border-b border-granite-200 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Link to="/" aria-label="Discover Abuja home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-1">
            <NavLink to="/explore" className={navClass}>Explore</NavLink>
            {user && <NavLink to="/community" className={(a) => `${navClass(a)} hidden sm:inline-flex`}>Community</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin/reports" className={({ isActive }) => navClass({ isActive: isActive || pathname.startsWith('/admin') })}>Admin</NavLink>}
            {user && <Link to="/report" className="btn-primary mx-1 hidden !py-2 md:inline-flex">Add a place</Link>}
            {!loading && !user && (
              <>
                <NavLink to="/login" className={navClass}>Sign in</NavLink>
                <Link to="/register" className="btn-primary ml-1 hidden sm:inline-flex">Create account</Link>
              </>
            )}
            {user && <UserMenu user={user} onLogout={onLogout} />}
          </nav>
        </div>
      </header>

      <main className={`flex-1 ${pathname === '/explore' ? 'min-h-0 overflow-y-auto overscroll-contain lg:overflow-clip' : ''}`}>
        <Outlet />
      </main>

      <footer className="shrink-0 border-t border-granite-200 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-granite-500 sm:px-6">
          Attractions across the Federal Capital Territory, including places reported and confirmed by residents.
        </div>
      </footer>
    </div>
  );
}
