import { useState } from 'react';
import Sidebar from './Sidebar';
import useIsMobile from '../hooks/useIsMobile';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar
        isMobile={isMobile}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {isMobile && (
          <div
            className="flex items-center gap-3 shrink-0"
            style={{
              height: 52,
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              padding: '0 14px',
              zIndex: 10,
            }}
            data-testid="mobile-top-bar"
          >
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex items-center justify-center p-1"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
              data-testid="mobile-menu-button"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center rounded-md"
                style={{ width: 26, height: 26, background: 'var(--text-primary)' }}
              >
                <span className="text-white font-bold tracking-tight" style={{ fontSize: 10 }}>SN</span>
              </div>
              <span className="font-bold text-[15px] tracking-tight" style={{ color: 'var(--text-primary)' }}>
                StudyNode
              </span>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
