import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button, Input, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, hashPassword, setAuthStoragePreference } from '../../lib/supabase';
import { SAPAS_REMEMBER_KEY } from '../../lib/sessionConstants';
import { touchLastActivity } from '../../lib/profileStorage';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();

  const [showExpiredNotice] = useState(() =>
    Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired)
  );

  useEffect(() => {
    if (showExpiredNotice) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [showExpiredNotice, location.pathname, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const trimmed = username.trim();
    const isEmail = trimmed.includes('@');

    try {
      localStorage.setItem(SAPAS_REMEMBER_KEY, rememberMe ? 'true' : 'false');
      setAuthStoragePreference(rememberMe);

      const passwordHash = await hashPassword(password);

      const profileQuery = isEmail
        ? supabase.from('users').select('*').eq('email', trimmed).limit(1)
        : supabase.from('users').select('*').eq('username', trimmed).limit(1);

      const { data: users, error: fetchError } = await profileQuery;

      if (fetchError) {
        throw fetchError;
      }

      if (!users || users.length === 0) {
        setError(isEmail ? 'Invalid email or password' : 'Invalid student ID or password');
        setLoading(false);
        return;
      }

      const user = users[0] as (typeof users)[0];
      if (user.password_hash !== passwordHash) {
        setError(isEmail ? 'Invalid email or password' : 'Invalid student ID or password');
        setLoading(false);
        return;
      }

      if (user.is_temp_password) {
        navigate('/change-password', { state: { user } });
        setLoading(false);
        return;
      }

      if (user.email && typeof user.email === 'string' && user.email.includes('@')) {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: user.email.trim(),
          password,
        });
        if (authError) {
          // Legacy row valid but no matching Supabase Auth user — continue with app session only
          console.warn('Supabase Auth sign-in skipped:', authError.message);
        }
      }

      setUser(user);
      touchLastActivity();

      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else if (user.role === 'student') {
        navigate('/student/dashboard');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Edulytics PHILTECH " subtitle="Sign in to access the Academic Performance System">
      <form onSubmit={handleSubmit} className="space-y-6">
        {showExpiredNotice && (
          <div
            className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-900 text-sm backdrop-blur-md"
            role="status"
          >
            Session expired. Please log in again.
          </div>
        )}

        {error && (
          <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-800 text-sm backdrop-blur-md">
            {error}
          </div>
        )}

        <Input
          label="Email / Student ID"
          placeholder={
            username.includes('@') ? 'Enter your email' : 'Enter your student ID (e.g., STUD-CS-0001)'
          }
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <Input
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-maroon-300 text-maroon-700 focus:ring-maroon-500"
          />
          <span className="text-sm text-gray-700">Remember me</span>
        </label>
        <p className="text-xs text-gray-500 -mt-4 ml-7">
          When off, your session ends when you close the browser. When on, you stay signed in longer on this
          device.
        </p>

        <Button type="submit" className="w-full py-3" disabled={loading}>
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <i className="hgi-stroke hgi-login-01"></i>
              Sign In
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
