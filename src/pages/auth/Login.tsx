import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, hashPassword, setAuthStoragePreference } from '../../lib/supabase';
import { SAPAS_REMEMBER_KEY } from '../../lib/sessionConstants';
import { touchLastActivity } from '../../lib/profileStorage';

const LOGO_SRC = `${import.meta.env.BASE_URL}spas-logo.png`;

function PillField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex min-h-[52px] w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm transition-colors focus-within:border-maroon-400 focus-within:ring-2 focus-within:ring-maroon-500/25">
      <span className="shrink-0 text-sm font-medium lowercase tracking-wide text-gray-500">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#b8860b]" strokeWidth={2} aria-hidden />
      <input
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400"
        {...props}
      />
    </div>
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuthStore();

  const [showExpiredNotice] = useState(() =>
    Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired)
  );

  useEffect(() => {
    if (showExpiredNotice) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [showExpiredNotice, location.pathname, navigate]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'signup') setAuthTab('signup');
  }, [searchParams]);

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

  const brandPanel = (
    <div className="relative flex min-h-[220px] flex-col justify-between overflow-hidden bg-gradient-to-b from-maroon-700 via-maroon-800 to-maroon-950 px-8 py-10 text-white lg:min-h-0 lg:w-[42%] lg:shrink-0 lg:py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-white/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-12 right-0 h-52 w-52 rounded-full bg-[#d4af37]/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute left-1/3 top-1/2 h-36 w-36 -translate-y-1/2 rounded-full border border-white/10 bg-maroon-600/40 blur-sm" aria-hidden />

      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90">Philtech</p>
        <h1 className="mt-3 text-2xl font-bold uppercase leading-tight tracking-wide text-white sm:text-3xl">
          Student performance analytics
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
          Sign in to view grades, analytics, and subject records. Your data stays with your institution.
        </p>
      </div>

      <div className="relative z-10 mt-8 flex justify-center lg:mt-0 lg:justify-start">
        <img
          src={LOGO_SRC}
          alt="PHILTECH Student Performance Analytics System"
          className="h-28 w-auto max-w-[min(100%,220px)] object-contain drop-shadow-[0_12px_32px_rgba(0,0,0,0.45)] sm:h-32"
          width={220}
          height={220}
        />
      </div>
    </div>
  );

  const tabBtn = (id: 'login' | 'signup', label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={authTab === id}
      onClick={() => setAuthTab(id)}
      className={`relative pb-2 text-sm font-medium lowercase transition-colors ${
        authTab === id ? 'text-maroon-800' : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {label}
      {authTab === id && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-[#800000] to-[#b8860b]" />
      )}
    </button>
  );

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-maroon-50/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(128,0,0,0.06),transparent_50%)]" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
        <div className="w-full overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-[0_24px_64px_rgba(51,0,0,0.12)]">
          <div className="flex flex-col lg:flex-row lg:min-h-[520px]">
            {brandPanel}

            <div className="flex flex-1 flex-col bg-white px-5 py-8 sm:px-8 sm:py-10 lg:max-w-none">
              <div className="mb-8 flex justify-end gap-8" role="tablist" aria-label="Account access">
                {tabBtn('signup', 'sign up')}
                {tabBtn('login', 'login')}
              </div>

              {authTab === 'signup' ? (
                <div className="mx-auto w-full max-w-md space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold lowercase text-gray-900">sign up</h2>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600">
                      New accounts are created by your school administrator. If you are a student or teacher and need
                      access, contact the registrar or IT office with your official school email or student ID.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-full lowercase"
                    onClick={() => setAuthTab('login')}
                  >
                    back to login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md space-y-5">
                  {showExpiredNotice && (
                    <div
                      className="rounded-2xl border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                      role="status"
                    >
                      Session expired. Please log in again.
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                      {error}
                    </div>
                  )}

                  <PillField
                    label="login"
                    type="text"
                    name="username"
                    autoComplete="username"
                    placeholder={username.includes('@') ? 'name@school.edu' : 'e.g. STUD-CS-0001'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    aria-label="Email or student ID"
                  />

                  <PillField
                    label="password"
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aria-label="Password"
                  />

                  <label className="flex cursor-pointer items-start gap-3 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded-full border-gray-300 text-maroon-700 focus:ring-maroon-500"
                    />
                    <span className="text-sm text-gray-600">
                      Remember this device — stay signed in longer when the browser stays open.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-between gap-3 rounded-full border border-maroon-800/20 bg-gradient-to-r from-maroon-800 to-maroon-950 px-5 py-3.5 text-left text-base font-medium lowercase text-white shadow-lg transition hover:from-maroon-700 hover:to-maroon-900 hover:shadow-xl disabled:opacity-60"
                  >
                    <span>{loading ? 'Signing in…' : 'log in'}</span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white" strokeWidth={2} aria-hidden />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
                      )}
                    </span>
                  </button>
                </form>
              )}

              <p className="mx-auto mt-auto max-w-md pt-10 text-center text-xs text-gray-500">
                PHILTECH Student Performance Analytics System
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
