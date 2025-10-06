import { Link, NavLink } from 'react-router-dom';
import { useUIStore } from '@/lib/state/uiStore';

export default function Navbar() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  const baseLinkClasses = 'px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium';

  return (
    <header className="glass border-b border-slate-700/30 backdrop-blur-xl transition-colors duration-500">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl gradient-text hover:scale-105 transition-transform">
          Personal Finance Tracker
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink
            to="/"
            className={({ isActive }) => [
              baseLinkClasses,
              isActive
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
            ].join(' ')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/holdings"
            className={({ isActive }) => [
              baseLinkClasses,
              isActive
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
            ].join(' ')}
          >
            Holdings
          </NavLink>
          <NavLink
            to="/heat-map"
            className={({ isActive }) => [
              baseLinkClasses,
              isActive
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
            ].join(' ')}
          >
            Heat Map
          </NavLink>
          <NavLink
            to="/categories"
            className={({ isActive }) => [
              baseLinkClasses,
              isActive
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
            ].join(' ')}
          >
            Categories
          </NavLink>
          <NavLink
            to="/research"
            className={({ isActive }) => [
              baseLinkClasses,
              isActive
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
            ].join(' ')}
          >
            Research
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => [
              baseLinkClasses,
              isActive
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
            ].join(' ')}
          >
            Settings
          </NavLink>
          <button
            aria-label={'Switch to ' + (isDark ? 'light' : 'dark') + ' theme'}
            className="p-2 rounded-lg bg-slate-800/30 text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-all duration-200 border border-slate-700/30"
            onClick={toggleTheme}
            title={'Theme: ' + theme}
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M7.05 7.05L5.636 5.636m12.728 0l-1.414 1.414M7.05 16.95l-1.414 1.414M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
