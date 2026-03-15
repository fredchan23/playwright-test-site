import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus } from 'lucide-react';

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
      newErrors.password = 'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <UserPlus className="w-10 h-10 text-slate-700" />
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">
            Create Account
          </h1>
          <p className="text-center text-slate-600 mb-6">
            Start learning Playwright automation
          </p>

          <form onSubmit={handleSubmit} data-testid="registration-form">
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="you@example.com"
                data-testid="registration-email-input"
                aria-label="Email address"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600" data-testid="registration-email-error">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent ${
                  errors.password ? 'border-red-500' : 'border-slate-300'
                }`}
                placeholder="••••••••"
                data-testid="registration-password-input"
                aria-label="Password"
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600" data-testid="registration-password-error">
                  {errors.password}
                </p>
              )}
            </div>

            {errors.form && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="registration-form-error">
                {errors.form}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-2 px-4 rounded-lg hover:bg-slate-800 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
              data-testid="registration-submit-button"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-slate-900 font-medium hover:underline" data-testid="registration-login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
