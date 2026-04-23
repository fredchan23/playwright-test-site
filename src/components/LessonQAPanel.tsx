import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { katexSanitizeSchema } from '../lib/sanitizeSchema';
import { supabase } from '../lib/supabase';
import { Sparkles, Send, Trash2, Loader2, Download, MessageCircle } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface LessonQAPanelProps {
  lessonId: string;
  columnMode?: boolean;
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

export default function LessonQAPanel({ lessonId, columnMode = false }: LessonQAPanelProps) {
  const [qaEnabled, setQaEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'no_files' | 'error'>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from('app_config')
      .select('value')
      .eq('key', 'qa_enabled')
      .single()
      .then(({ data }) => setQaEnabled(data?.value !== 'false'));
  }, []);

  useEffect(() => {
    if (!qaEnabled) return;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;

      const indexResp = await callFunction('lesson-qa-index', { lesson_id: lessonId }, token);
      if (!indexResp.ok) { setStatus('no_files'); return; }

      const indexData = await indexResp.json();
      if (indexData.status === 'no_files') { setStatus('no_files'); return; }

      const { data: history } = await supabase
        .from('lesson_qa_messages')
        .select('role, content')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (history) setMessages((history as Message[]).reverse());
      setStatus('ready');
    };

    init().catch(() => setStatus('error'));
  }, [qaEnabled, lessonId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || asking) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setInput('');
    setAsking(true);
    setError(null);

    try {
      const resp = await callFunction('lesson-qa-ask', { lesson_id: lessonId, question }, session.access_token);
      if (!resp.ok) {
        let errorMsg = 'Something went wrong. Please try again.';
        try { const d = await resp.json(); errorMsg = d.error ?? errorMsg; } catch { /* non-JSON */ }
        setError(errorMsg);
      } else {
        const data = await resp.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setAsking(false);
    }
  };

  const handleSaveMd = () => {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `lesson-${lessonId}-chat-${today}.md`;
    const body = messages
      .map(m => m.role === 'user' ? `**You:** ${m.content}` : `**Assistant:** ${m.content}`)
      .join('\n\n');
    const content = `# Lesson Chat Session\n*Exported: ${today}*\n\n${body}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (!window.confirm('Clear your conversation history for this lesson?\n\nRemember to Save your chat first if you want to keep it.')) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await callFunction('lesson-qa-clear', { lesson_id: lessonId }, session.access_token);
    setMessages([]);
  };

  if (qaEnabled === null || qaEnabled === false) return null;

  // ── Header ────────────────────────────────────────────────────────────────────
  const header = (
    <div
      className="flex items-center justify-between shrink-0"
      style={{
        padding: '16px 18px',
        borderBottom: '1px solid var(--border-light)',
        background: columnMode ? 'var(--surface)' : 'var(--surface2)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="flex items-center justify-center rounded-md shrink-0"
          style={{ width: 26, height: 26, background: 'linear-gradient(135deg, var(--accent) 0%, var(--teal) 100%)' }}
        >
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ask this lesson</span>
      </div>
      {status === 'ready' && messages.length > 0 && (
        <div className="flex items-center gap-1">
          <button
            onClick={handleSaveMd}
            className="flex items-center justify-center rounded"
            style={{ width: 28, height: 28, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            title="Export chat"
            data-testid="lesson-qa-save-md-button"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClear}
            className="flex items-center justify-center rounded"
            style={{ width: 28, height: 28, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
            title="Clear chat"
            data-testid="lesson-qa-clear-button"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  // ── Messages ──────────────────────────────────────────────────────────────────
  const messagesArea = (
    <div
      className="flex flex-col gap-3.5 overflow-y-auto"
      style={{ flex: 1, padding: 16 }}
    >
      {/* Empty state */}
      {status === 'ready' && messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center" style={{ padding: '40px 16px', color: 'var(--text-muted)' }}>
          <MessageCircle className="w-7 h-7 mb-2.5" />
          <p className="text-sm" style={{ lineHeight: 1.5 }}>Ask any question about this lesson's content</p>
        </div>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }} data-testid="lesson-qa-indexing-indicator">
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
          <span>Loading…</span>
        </div>
      )}

      {/* No files */}
      {status === 'no_files' && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Upload PDF files to this lesson to enable Q&amp;A.
        </p>
      )}

      {/* Error */}
      {status === 'error' && (
        <p className="text-sm" style={{ color: 'var(--red)' }}>
          Failed to load Q&amp;A. Please refresh the page.
        </p>
      )}

      {/* Messages */}
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          data-testid={`lesson-qa-message-${idx}`}
        >
          <div
            className="text-sm"
            style={{
              maxWidth: '85%',
              padding: '10px 13px',
              borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
              background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
              color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
              lineHeight: 1.5,
            }}
          >
            {msg.role === 'user' ? (
              <span className="whitespace-pre-wrap">{msg.content}</span>
            ) : (
              <div className="prose prose-sm max-w-none" style={{ color: 'var(--text-primary)' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[
                    [rehypeKatex, { output: 'html', throwOnError: false }],
                    [rehypeSanitize, katexSanitizeSchema],
                  ]}
                  components={{
                    a: ({ children, href }) => (
                      <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                        {children}
                      </a>
                    ),
                    code: ({ children, className }) => {
                      const isBlock = className?.includes('language-');
                      return isBlock ? (
                        <code className={className}>{children}</code>
                      ) : (
                        <code className="font-mono text-xs rounded px-1" style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className="font-mono text-xs rounded p-3 overflow-x-auto my-2" style={{ background: 'var(--text-primary)', color: 'var(--surface)' }}>
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Asking — bouncing dots */}
      {asking && (
        <div className="flex items-start">
          <div
            className="flex items-center gap-1.5 px-4 py-3 rounded-[12px_12px_12px_3px]"
            style={{ background: 'var(--surface2)' }}
          >
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 7, height: 7,
                  background: 'var(--text-muted)',
                  animation: `qa-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <p className="text-xs rounded px-3 py-2" style={{ color: 'var(--red)', background: 'var(--red-light)' }}>{error}</p>
      )}

      <div ref={bottomRef} />
    </div>
  );

  // ── Input ─────────────────────────────────────────────────────────────────────
  const inputArea = (
    <div className="shrink-0" style={{ padding: '12px 14px', borderTop: '1px solid var(--border-light)' }}>
      <div className="flex items-end gap-2">
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
          disabled={asking || status !== 'ready'}
          className="flex-1 resize-none text-sm focus:outline-none disabled:opacity-50"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '9px 11px',
            fontSize: 13,
            color: 'var(--text-primary)',
            background: 'var(--bg)',
            lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
          data-testid="lesson-qa-input"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!input.trim() || asking || status !== 'ready'}
          className="flex items-center justify-center shrink-0"
          style={{
            width: 36, height: 36,
            borderRadius: 8,
            border: 'none',
            background: input.trim() && !asking ? 'var(--accent)' : 'var(--surface2)',
            color: input.trim() && !asking ? '#fff' : 'var(--text-muted)',
            cursor: input.trim() && !asking ? 'pointer' : 'default',
          }}
          data-testid="lesson-qa-submit-button"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-right mt-1.5 text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{input.length}/500</div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  if (columnMode) {
    return (
      <div className="flex flex-col h-full" data-testid="lesson-qa-panel">
        {header}
        {messagesArea}
        {inputArea}
      </div>
    );
  }

  return (
    <div
      className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      data-testid="lesson-qa-panel"
    >
      {header}
      <div className="flex flex-col gap-4 p-5">
        {messagesArea}
        {inputArea}
      </div>
    </div>
  );
}
