import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Settings, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading, signOut } = useAuth();
  const [qaEnabled, setQaEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      navigate('/library', { replace: true });
      return;
    }
    loadConfig();
  }, [isAdmin, loading, navigate]);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'qa_enabled')
      .single();
    if (data) setQaEnabled(data.value === 'true');
  };

  const handleToggle = async () => {
    setSaving(true);
    const newValue = !qaEnabled;
    const { error } = await supabase
      .from('app_config')
      .update({ value: newValue ? 'true' : 'false' })
      .eq('key', 'qa_enabled');
    if (!error) setQaEnabled(newValue);
    setSaving(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Top bar */}
      <div
        className="px-7 py-3.5 flex items-center shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border-light)' }}
      >
        <button
          onClick={() => navigate('/library')}
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          data-testid="settings-back-button"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Library
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-7 py-9 flex justify-center">
        <div className="w-full max-w-[560px]">
          <div className="flex items-center gap-2.5 mb-7">
            <Settings className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--text-primary)' }}
              data-testid="settings-page-title"
            >
              Settings
            </h1>
          </div>

          {/* Features card */}
          <div
            className="rounded-[var(--radius-lg)] overflow-hidden mb-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="px-[22px] py-4" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border-light)' }}>
              <span className="text-xs font-semibold uppercase" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Features
              </span>
            </div>
            <div className="px-[22px] py-0">
              <div className="flex items-center justify-between gap-5 py-4">
                <div>
                  <label
                    htmlFor="qa-toggle"
                    className="text-sm font-medium cursor-pointer"
                    style={{ color: 'var(--text-primary)' }}
                    data-testid="settings-qa-toggle-label"
                  >
                    Lesson Q&amp;A
                  </label>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Allow users to ask questions about lesson content using AI
                  </p>
                </div>
                <button
                  id="qa-toggle"
                  role="switch"
                  aria-checked={qaEnabled}
                  onClick={handleToggle}
                  disabled={saving}
                  className="relative inline-flex items-center rounded-full shrink-0 focus:outline-none disabled:opacity-50"
                  style={{
                    width: 42, height: 24,
                    background: qaEnabled ? 'var(--accent)' : 'var(--border)',
                    border: 'none',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                  data-testid="settings-qa-toggle"
                >
                  <span
                    className="inline-block rounded-full bg-white"
                    style={{
                      width: 18, height: 18,
                      position: 'absolute', top: 3,
                      left: qaEnabled ? 21 : 3,
                      transition: 'left 0.15s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    }}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Account card */}
          <div
            className="rounded-[var(--radius-lg)] overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="px-[22px] py-4" style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border-light)' }}>
              <span className="text-xs font-semibold uppercase" style={{ letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Account
              </span>
            </div>
            <div className="px-[22px] py-4">
              <div className="flex items-center gap-3.5 mb-4">
                <div
                  className="flex items-center justify-center rounded-full shrink-0"
                  style={{
                    width: 44, height: 44,
                    background: 'linear-gradient(135deg, var(--accent) 0%, var(--teal) 100%)',
                  }}
                >
                  <span className="text-white font-bold text-base">
                    {user?.email?.slice(0, 2).toUpperCase() ?? '??'}
                  </span>
                </div>
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {user?.email?.split('@')[0] ?? ''}
                  </div>
                  <div className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                    {user?.email ?? ''}
                  </div>
                </div>
              </div>
              <button
                onClick={async () => { await signOut(); navigate('/login'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{
                  background: 'var(--red-light)',
                  color: 'var(--red)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                data-testid="settings-sign-out-button"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
