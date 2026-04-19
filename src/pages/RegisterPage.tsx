import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;
    return hasUpperCase && hasNumber && hasSpecialChar && isLongEnough;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(password)) {
      newErrors.password =
        'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setLoading(true);
      const { error } = await signUp(email, password);

      if (error) {
        if (error.message.includes('already registered')) {
          setErrors({ email: 'This email is already registered' });
        } else {
          setErrors({ form: error.message });
        }
        setLoading(false);
      } else {
        navigate('/library');
      }
    }
  };

  const inputStyle = (hasError: boolean) => ({
    border: `1px solid ${hasError ? 'oklch(0.58 0.18 25)' : 'var(--border)'}`,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: 'var(--text-primary)',
    background: 'var(--surface)',
    outline: 'none',
    height: 40,
    fontFamily: 'inherit',
    width: '100%',
  });

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{ background: 'var(--bg)' }}
    >
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage:
            'radial-gradient(circle at 70% 20%, oklch(0.94 0.04 268 / 0.4) 0%, transparent 50%), radial-gradient(circle at 30% 80%, oklch(0.93 0.04 178 / 0.3) 0%, transparent 50%)',
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
            Create account
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Start learning Playwright automation
          </p>
        </div>

        <form onSubmit={handleSubmit} data-testid="registration-form" className="flex flex-col gap-3.5">
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
              style={inputStyle(!!errors.email)}
              data-testid="registration-email-input"
              aria-label="Email address"
            />
            {errors.email && (
              <p
                className="text-xs"
                style={{ color: 'oklch(0.45 0.18 25)' }}
                data-testid="registration-email-error"
              >
                {errors.email}
              </p>
            )}
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
              style={inputStyle(!!errors.password)}
              data-testid="registration-password-input"
              aria-label="Password"
            />
            {errors.password && (
              <p
                className="text-xs"
                style={{ color: 'oklch(0.45 0.18 25)' }}
                data-testid="registration-password-error"
              >
                {errors.password}
              </p>
            )}
          </div>

          {errors.form && (
            <div
              className="p-3 text-sm rounded-lg"
              style={{
                background: 'oklch(0.95 0.04 25)',
                color: 'oklch(0.45 0.18 25)',
                border: '1px solid oklch(0.87 0.08 25)',
              }}
              data-testid="registration-form-error"
            >
              {errors.form}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="registration-submit-button"
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
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-[13px] mt-5" style={{ color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{ color: 'var(--accent)', fontWeight: 500 }}
            data-testid="registration-login-link"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
