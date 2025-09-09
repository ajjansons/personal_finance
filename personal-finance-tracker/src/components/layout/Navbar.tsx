import { Link, NavLink } from 'react-router-dom';
import { useUIStore } from '@/lib/state/uiStore';

export default function Navbar() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  return (
    <header className="border-b bg-white">
      <div className="container mx-auto p-4 flex items-center justify-between">
        <Link to="/" className="font-semibold">
          Personal Finance Tracker
        </Link>
        <nav className="flex gap-4">
          <NavLink to="/" className={({ isActive }) => (isActive ? 'font-medium' : '')}>
            Dashboard
          </NavLink>
          <NavLink to="/holdings" className={({ isActive }) => (isActive ? 'font-medium' : '')}>
            Holdings
          </NavLink>
          <NavLink to="/categories" className={({ isActive }) => (isActive ? 'font-medium' : '')}>
            Categories
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'font-medium' : '')}>
            Settings
          </NavLink>
          <button
            aria-label="Toggle theme"
            className="rounded border px-2 py-1 text-sm"
            onClick={toggleTheme}
            title={`Theme: ${theme}`}
          >
            🌓
          </button>
        </nav>
      </div>
    </header>
  );
}

