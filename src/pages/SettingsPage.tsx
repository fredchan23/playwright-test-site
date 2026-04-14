import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Settings } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [qaEnabled, setQaEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/library', { replace: true });
      return;
    }
    loadConfig();
  }, [isAdmin, navigate]);

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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 space-x-3">
            <button
              onClick={() => navigate('/library')}
              className="flex items-center space-x-2 text-slate-700 hover:text-slate-900"
              data-testid="settings-back-button"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Library</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center space-x-3 mb-8">
          <Settings className="w-6 h-6 text-slate-700" />
          <h1 className="text-2xl font-bold text-slate-900" data-testid="settings-page-title">
            Settings
          </h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Features</h2>

          <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-0">
            <div>
              <label
                htmlFor="qa-toggle"
                className="text-sm font-medium text-slate-900 cursor-pointer"
                data-testid="settings-qa-toggle-label"
              >
                Lesson Q&A
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Allow users to ask questions about lesson content using AI
              </p>
            </div>
            <button
              id="qa-toggle"
              role="switch"
              aria-checked={qaEnabled}
              onClick={handleToggle}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 ${
                qaEnabled ? 'bg-slate-900' : 'bg-slate-300'
              }`}
              data-testid="settings-qa-toggle"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  qaEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
