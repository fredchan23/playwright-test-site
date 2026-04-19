import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Library, Settings, LogOut } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();

  const isLibraryActive =
    location.pathname === '/library' ||
    location.pathname.startsWith('/lessons');

  const isSettingsActive = location.pathname === '/settings';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const username = user?.email?.split('@')[0] ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 shrink-0"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo */}
      <div
        className="px-5 py-5"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--text-primary)' }}
          >
            <span className="text-white font-bold text-[13px] tracking-tight">SN</span>
          </div>
          <span
            className="font-bold text-[15px] tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            StudyNode
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5">
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors"
          style={{
            background: isLibraryActive ? 'var(--accent-light)' : 'transparent',
            color: isLibraryActive ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: isLibraryActive ? 600 : 400,
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
          }}
          data-testid="sidebar-library-button"
        >
          <Library className="w-4 h-4 shrink-0" />
          Library
        </button>

        {isAdmin && (
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors"
            style={{
              background: isSettingsActive ? 'var(--accent-light)' : 'transparent',
              color: isSettingsActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: isSettingsActive ? 600 : 400,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
            data-testid="library-settings-button"
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </button>
        )}
      </nav>

      {/* User */}
      <div className="p-2.5" style={{ borderTop: '1px solid var(--border-light)' }}>
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
          style={{ background: 'var(--surface2)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--teal) 100%)',
            }}
          >
            <span className="text-white text-[11px] font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {username}
            </div>
            <div
              className="text-[11px] truncate"
              style={{ color: 'var(--text-muted)' }}
            >
              {user?.email}
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="p-0.5 rounded"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            data-testid="library-logout-button"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
