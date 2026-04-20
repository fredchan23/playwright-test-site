import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Library, Settings, LogOut, X } from 'lucide-react';

interface SidebarProps {
  isMobile?: boolean;
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isMobile = false, open = false, onClose }: SidebarProps) {
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

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile && onClose) onClose();
  };

  const username = user?.email?.split('@')[0] ?? '';
  const initials = username.slice(0, 2).toUpperCase() || 'U';

  const content = (
    <>
      {/* Logo */}
      <div
        className="px-5 py-5 flex items-center justify-between"
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
        {isMobile && (
          <button
            onClick={onClose}
            className="p-1 rounded"
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            data-testid="mobile-sidebar-close-button"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5">
        <button
          onClick={() => handleNavClick('/library')}
          className="flex items-center gap-2.5 w-full px-3 rounded-lg mb-0.5 text-sm transition-colors"
          style={{
            padding: isMobile ? '13px 14px' : '9px 12px',
            background: isLibraryActive ? 'var(--accent-light)' : 'transparent',
            color: isLibraryActive ? 'var(--accent)' : 'var(--text-secondary)',
            fontWeight: isLibraryActive ? 600 : 400,
            fontSize: isMobile ? 16 : 14,
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            borderRadius: 8,
            marginBottom: 2,
          }}
          data-testid="sidebar-library-button"
        >
          <Library style={{ width: isMobile ? 20 : 16, height: isMobile ? 20 : 16 }} className="shrink-0" />
          Library
        </button>

        {isAdmin && (
          <button
            onClick={() => handleNavClick('/settings')}
            className="flex items-center gap-2.5 w-full rounded-lg mb-0.5 text-sm transition-colors"
            style={{
              padding: isMobile ? '13px 14px' : '9px 12px',
              background: isSettingsActive ? 'var(--accent-light)' : 'transparent',
              color: isSettingsActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: isSettingsActive ? 600 : 400,
              fontSize: isMobile ? 16 : 14,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              borderRadius: 8,
              marginBottom: 2,
            }}
            data-testid="library-settings-button"
          >
            <Settings style={{ width: isMobile ? 20 : 16, height: isMobile ? 20 : 16 }} className="shrink-0" />
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
    </>
  );

  if (isMobile) {
    return (
      <>
        {open && (
          <div
            className="fixed inset-0"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 40 }}
            onClick={onClose}
            data-testid="mobile-sidebar-overlay"
          />
        )}
        <aside
          className="fixed top-0 left-0 bottom-0 flex flex-col"
          style={{
            width: 270,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            zIndex: 41,
            transform: open ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.24s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: open ? 'var(--shadow-lg)' : 'none',
          }}
        >
          {content}
        </aside>
      </>
    );
  }

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 shrink-0"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {content}
    </aside>
  );
}
