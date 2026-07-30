import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { IS_DEMO_MODE, DEMO_EMAIL, DEMO_PASSWORD } from '../config';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState(IS_DEMO_MODE ? DEMO_EMAIL : '');
  const [password, setPassword] = useState(IS_DEMO_MODE ? DEMO_PASSWORD : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      navigate('/library');
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: 'var(--bg)' }}
    >
      {/* Gradient backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(circle at 30% 20%, oklch(0.94 0.04 268 / 0.4) 0%, transparent 50%), radial-gradient(circle at 70% 80%, oklch(0.93 0.04 178 / 0.3) 0%, transparent 50%)',
        }}
      />

      <div
        className="w-full max-w-[400px] relative z-10"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          padding: '40px 36px',
        }}
      >
        {/* Logo */}
        <div className="text-center mb-7">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--text-primary)' }}
          >
            <span className="text-white font-bold text-base tracking-tight">SN</span>
          </div>
          <h1
            className="text-[22px] font-bold tracking-tight mb-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            Welcome back
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sign in to access your lessons
          </p>
        </div>

        {IS_DEMO_MODE && (
          <div
            className="p-3 mb-4 text-xs rounded-lg flex items-start gap-2"
            style={{
              background: 'oklch(0.96 0.03 240 / 0.8)',
              color: 'oklch(0.35 0.12 240)',
              border: '1px solid oklch(0.88 0.06 240)',
            }}
            data-testid="demo-login-micro-prompt"
          >
            <span>💡 <strong>Public Demo Mode:</strong> Credentials are prefilled. Click <strong>Sign in</strong> to enter the demo site.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} data-testid="login-form" className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-[13px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              data-testid="login-email-input"
              aria-label="Email address"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                color: 'var(--text-primary)',
                background: 'var(--surface)',
                outline: 'none',
                height: 40,
                fontFamily: 'inherit',
                width: '100%',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-[13px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              data-testid="login-password-input"
              aria-label="Password"
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                color: 'var(--text-primary)',
                background: 'var(--surface)',
                outline: 'none',
                height: 40,
                fontFamily: 'inherit',
                width: '100%',
              }}
            />
          </div>

          {error && (
            <div
              className="p-3 text-sm rounded-lg"
              style={{
                background: 'oklch(0.95 0.04 25)',
                color: 'oklch(0.45 0.18 25)',
                border: '1px solid oklch(0.87 0.08 25)',
              }}
              data-testid="login-error-message"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '11px',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
              fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1,
              width: '100%',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {!IS_DEMO_MODE && (
          <p className="text-center text-[13px] mt-5" style={{ color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{ color: 'var(--accent)', fontWeight: 500 }}
              data-testid="login-register-link"
            >
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
