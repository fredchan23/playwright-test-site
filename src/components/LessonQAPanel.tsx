import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { MessageCircle, Send, Trash2, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LessonQAPanelProps {
  lessonId: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callFunction(name: string, body: Record<string, string>, token: string) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return resp;
}

export default function LessonQAPanel({ lessonId }: LessonQAPanelProps) {
  const [qaEnabled, setQaEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'no_files' | 'error'>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Check qa_enabled on mount
  useEffect(() => {
    supabase
      .from('app_config')
      .select('value')
      .eq('key', 'qa_enabled')
      .single()
      .then(({ data }) => setQaEnabled(data?.value !== 'false'));
  }, []);

  // Once we know Q&A is enabled, check lesson status + load history
  useEffect(() => {
    if (!qaEnabled) return;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      // Quick status check (returns immediately)
      const indexResp = await callFunction('lesson-qa-index', { lesson_id: lessonId }, token);
      const indexData = await indexResp.json();

      if (!indexResp.ok || indexData.status === 'no_files') {
        setStatus('no_files');
        return;
      }

      // Load the most recent 50 messages, newest-first, then reverse for display
      const { data: history } = await supabase
        .from('lesson_qa_messages')
        .select('role, content')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (history) {
        setMessages((history as Message[]).reverse());
      }

      setStatus('ready');
    };

    init().catch(() => setStatus('error'));
  }, [qaEnabled, lessonId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || asking) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Optimistic user bubble
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setAsking(true);
    setError(null);

    // Placeholder assistant bubble
    setMessages(prev => [...prev, { role: 'assistant', content: '…' }]);

    try {
      const resp = await callFunction(
        'lesson-qa-ask',
        { lesson_id: lessonId, question },
        session.access_token,
      );
      const data = await resp.json();

      if (!resp.ok) {
        setMessages(prev => prev.slice(0, -1)); // remove placeholder
        setError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        setMessages(prev => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: data.answer },
        ]);
      }
    } catch {
      setMessages(prev => prev.slice(0, -1));
      setError('Network error. Please try again.');
    } finally {
      setAsking(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('Clear your conversation history for this lesson?')) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await callFunction('lesson-qa-clear', { lesson_id: lessonId }, session.access_token);
    setMessages([]);
  };

  // Not yet checked
  if (qaEnabled === null) return null;
  // Feature disabled
  if (qaEnabled === false) return null;

  return (
    <div
      className="bg-white rounded-lg shadow-sm border border-slate-200 mt-6"
      data-testid="lesson-qa-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-900">Ask this lesson</h2>
        </div>
        {status === 'ready' && messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center space-x-1 text-xs text-slate-500 hover:text-red-600 transition-colors"
            data-testid="lesson-qa-clear-button"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-6">
        {/* Loading state */}
        {status === 'loading' && (
          <div className="flex items-center space-x-2 text-slate-500 text-sm" data-testid="lesson-qa-indexing-indicator">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading…</span>
          </div>
        )}

        {/* No files */}
        {status === 'no_files' && (
          <p className="text-sm text-slate-500">
            Upload PDF files to this lesson to enable Q&amp;A.
          </p>
        )}

        {/* Error */}
        {status === 'error' && (
          <p className="text-sm text-red-600">
            Failed to load Q&amp;A. Please refresh the page.
          </p>
        )}

        {/* Chat UI */}
        {status === 'ready' && (
          <div className="flex flex-col space-y-4">
            {/* Message history */}
            {messages.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    data-testid={`lesson-qa-message-${idx}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}

            {/* Error banner */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
            )}

            {/* Input form */}
            <form onSubmit={handleSubmit} className="flex items-end space-x-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Ask a question about this lesson…"
                rows={2}
                maxLength={500}
                disabled={asking}
                className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50"
                data-testid="lesson-qa-input"
              />
              <button
                type="submit"
                disabled={!input.trim() || asking}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                data-testid="lesson-qa-submit-button"
              >
                {asking
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </form>
            <p className="text-xs text-slate-400">{input.length}/500</p>
          </div>
        )}
      </div>
    </div>
  );
}
