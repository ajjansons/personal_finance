import { Link, NavLink } from 'react-router-dom';
import { useUIStore } from '@/lib/state/uiStore';

export default function Navbar() {
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  return (
    <header className="glass border-b border-slate-700/30 backdrop-blur-xl">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-bold text-xl gradient-text hover:scale-105 transition-transform">
          Personal Finance Tracker
        </Link>
        <nav className="flex items-center gap-6">
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              `px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink 
            to="/holdings" 
            className={({ isActive }) => 
              `px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
              }`
            }
          >
            Holdings
          </NavLink>
          <NavLink 
            to="/categories" 
            className={({ isActive }) => 
              `px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
              }`
            }
          >
            Categories
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              `px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive 
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                  : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/30'
              }`
            }
          >
            Settings
          </NavLink>
          <button
            aria-label="Toggle theme"
            className="p-2 rounded-lg bg-slate-800/30 text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-all duration-200 border border-slate-700/30"
            onClick={toggleTheme}
            title={`Theme: ${theme}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          </button>
        </nav>
      </div>
    </header>
  );
}

