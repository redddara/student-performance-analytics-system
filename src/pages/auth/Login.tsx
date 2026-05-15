import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button, MessageModal, type AppMessagePayload } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, hashPassword, setAuthStoragePreference } from '../../lib/supabase';
import { SAPAS_REMEMBER_KEY } from '../../lib/sessionConstants';
import { touchLastActivity } from '../../lib/profileStorage';
import {
  formatLockUntil,
  isLoginLocked,
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_ATTEMPTS,
} from '../../lib/loginLock';
import logoSpas from '../../assets/LOGO SPAS.png';
import { ForgotPasswordModal } from '../../components/auth/ForgotPasswordModal';

function PillField({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="flex min-h-[52px] w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm transition-colors focus-within:border-maroon-400 focus-within:ring-2 focus-within:ring-maroon-500/25 lg:min-h-[60px] lg:gap-3 lg:px-6 lg:py-3">
      <span className="shrink-0 text-sm font-medium tracking-wide text-gray-500 lg:text-base">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#b8860b] lg:h-5 lg:w-5" strokeWidth={2} aria-hidden />
      <input
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 lg:text-lg"
        {...props}
      />
      <span className="h-10 w-10 shrink-0 opacity-0 pointer-events-none lg:h-11 lg:w-11" aria-hidden />
    </div>
  );
}

function PillPasswordField({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  id,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex min-h-[52px] w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm transition-colors focus-within:border-maroon-400 focus-within:ring-2 focus-within:ring-maroon-500/25 lg:min-h-[60px] lg:gap-3 lg:px-6 lg:py-3">
      <span className="shrink-0 text-sm font-medium tracking-wide text-gray-500 lg:text-base">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#b8860b] lg:h-5 lg:w-5" strokeWidth={2} aria-hidden />
      <input
        id={id}
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 lg:text-lg"
        type={show ? 'text' : 'password'}
        name="password"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-label="Password"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-maroon-800 lg:h-11 lg:w-11"
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden /> : <Eye className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />}
      </button>
    </div>
  );
}

type RpcFailPayload = { found?: boolean; attempts?: number; just_locked?: boolean };

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [loginModal, setLoginModal] = useState<AppMessagePayload | null>(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotLegacyNotice, setForgotLegacyNotice] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useAuthStore();

  const [showExpiredNotice] = useState(() =>
    Boolean((location.state as { sessionExpired?: boolean } | null)?.sessionExpired)
  );

  useEffect(() => {
    const clearCredentials = () => {
      setUsername('');
      setPassword('');
    };

    clearCredentials();
    window.addEventListener('pageshow', clearCredentials);

    return () => {
      window.removeEventListener('pageshow', clearCredentials);
    };
  }, []);

  useEffect(() => {
    const s = location.state as { openForgotPassword?: boolean; forgotLegacyLink?: boolean } | null;
    if (!s?.openForgotPassword) return;
    setForgotModalOpen(true);
    setForgotLegacyNotice(Boolean(s.forgotLegacyLink));
    navigate('.', { replace: true, state: {} });
  }, [location.state, navigate]);

  useEffect(() => {
    if (showExpiredNotice) {
      setLoginModal({
        title: 'Session expired',
        message: 'Your session ended. Please sign in again.',
        variant: 'warning',
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [showExpiredNotice, location.pathname, navigate]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'signup') setAuthTab('signup');
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin') navigate('/admin/dashboard', { replace: true });
    else if (user.role === 'teacher') navigate('/teacher/dashboard', { replace: true });
    else if (user.role === 'student') navigate('/student/dashboard', { replace: true });
  }, [user, navigate]);

  const showInvalidCredentials = (isEmail: boolean, extra?: string) => {
    const base = isEmail ? 'Invalid email or password.' : 'Invalid student ID or password.';
    setLoginModal({
      title: 'Sign-in failed',
      message: extra ? `${base}\n\n${extra}` : base,
      variant: 'error',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginModal(null);
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
        showInvalidCredentials(isEmail);
        setLoading(false);
        return;
      }

      const user = users[0] as (typeof users)[0];

      if (user.role === 'student' && user.is_dropout) {
        setLoginModal({
          title: 'Account locked',
          message:
            'Your account is marked as dropout and is currently locked. Please contact an administrator for assistance.',
          variant: 'error',
        });
        setLoading(false);
        return;
      }

      if (isLoginLocked(user)) {
        const until = user.login_locked_until ? formatLockUntil(user.login_locked_until) : 'later';
        setLoginModal({
          title: 'Account temporarily locked',
          message: `Too many failed sign-in attempts. You can try again after ${until}, or ask an administrator to unlock your account.`,
          variant: 'warning',
        });
        setLoading(false);
        return;
      }

      if (user.password_hash !== passwordHash) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('record_failed_login', {
          p_lookup: trimmed,
          p_is_email: isEmail,
        });

        if (!rpcError && rpcData && typeof rpcData === 'object') {
          const r = rpcData as RpcFailPayload;
          if (r.found && r.just_locked) {
            setLoginModal({
              title: 'Account temporarily locked',
              message: `Too many failed sign-in attempts. This account is locked for ${LOGIN_LOCK_MINUTES} minutes. Contact an administrator if you need access sooner.`,
              variant: 'error',
            });
          } else if (r.found && typeof r.attempts === 'number') {
            const left = LOGIN_MAX_ATTEMPTS - r.attempts;
            const suffix =
              left > 0
                ? `${left} more failed attempt${left === 1 ? '' : 's'} will lock this account for ${LOGIN_LOCK_MINUTES} minutes.`
                : '';
            showInvalidCredentials(isEmail, suffix);
          } else {
            showInvalidCredentials(isEmail);
          }
        } else {
          showInvalidCredentials(isEmail);
        }
        setLoading(false);
        return;
      }

      await supabase.rpc('reset_login_after_auth', {
        p_user_id: user.id,
        p_password_hash: passwordHash,
      });

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
      setLoginModal({ title: 'Something went wrong', message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const brandPanel = (
    <div className="relative flex min-h-[280px] flex-col overflow-hidden bg-gradient-to-b from-maroon-700 via-maroon-800 to-maroon-950 px-6 py-8 text-white sm:px-8 sm:py-10 lg:min-h-[520px] lg:w-1/2 lg:max-w-none lg:shrink-0 lg:py-12">
      <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-white/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-12 right-0 h-52 w-52 rounded-full bg-[#d4af37]/20 blur-3xl" aria-hidden />

      <div className="relative z-10 shrink-0 lg:max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90 lg:text-sm">
          Philtech
        </p>
        <h1 className="mt-3 text-2xl font-bold uppercase leading-tight tracking-wide text-white sm:text-3xl lg:text-4xl xl:text-[2.75rem] xl:leading-tight">
          Student performance analytics system
        </h1>
        
      </div>

      <div className="relative z-10 mt-8 flex min-h-0 flex-1 flex-col items-center justify-center lg:mt-10">
        <div className="flex min-h-[200px] w-full max-w-md flex-1 items-center justify-center sm:min-h-[240px] lg:min-h-[280px] lg:max-w-lg">
          <img
            src={logoSpas}
            alt="PHILTECH Student Performance Analytics System"
            className="max-h-[min(320px,42vh)] w-auto max-w-full object-contain object-center drop-shadow-[0_20px_48px_rgba(0,0,0,0.45)] lg:max-h-[min(440px,52vh)]"
            width={512}
            height={512}
            decoding="async"
          />
        </div>
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
      className={`relative pb-2 text-sm font-medium transition-colors lg:text-lg lg:pb-3 ${
        authTab === id ? 'text-maroon-800 lg:font-semibold' : 'text-gray-400 hover:text-gray-600'
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

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-3 py-6 sm:px-4 sm:py-10 lg:max-w-7xl lg:px-8">
        <div className="w-full overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-[0_24px_64px_rgba(51,0,0,0.12)]">
          <div className="flex flex-col lg:flex-row lg:min-h-[600px] xl:min-h-[640px]">
            {brandPanel}

            <div className="flex flex-1 flex-col bg-white px-5 py-8 sm:px-8 sm:py-10 lg:max-w-none lg:px-12 lg:py-14 xl:px-16">
              <div className="mb-8 flex justify-end gap-8 lg:mb-10 lg:gap-10" role="tablist" aria-label="Account access">
                {tabBtn('signup', 'Sign up')}
                {tabBtn('login', 'Login')}
              </div>

              {authTab === 'signup' ? (
                <div className="mx-auto w-full max-w-md space-y-6 lg:max-w-xl">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 lg:text-2xl">Sign up</h2>
                    <p className="mt-3 text-sm leading-relaxed text-gray-600 lg:text-base">
                      New accounts are created by your school administrator. If you are a student or teacher and need
                      access, contact the registrar or admin office.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-full"
                    onClick={() => setAuthTab('login')}
                  >
                    Back to login
                  </Button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="mx-auto w-full max-w-md space-y-5 lg:max-w-xl lg:space-y-6"
                  autoComplete="off"
                >
                  <PillField
                    label="Username"
                    type="text"
                    name="username"
                    autoComplete="off"
                    placeholder={username.includes('@') ? 'name@school.edu' : 'e.g. STUD-CS-0001'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-label="Email or student ID"
                  />
  
                  <PillPasswordField
                    label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    id="login-password"
                  />

                  <label className="flex cursor-pointer items-start gap-3 select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded-full border-gray-300 text-maroon-700 focus:ring-maroon-500 lg:mt-1 lg:h-5 lg:w-5"
                    />
                    <span className="text-sm text-gray-600 lg:text-base lg:leading-snug">
                      Remember Me
                    </span>
                  </label>
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotLegacyNotice(false);
                        setForgotModalOpen(true);
                      }}
                      className="text-sm font-medium text-maroon-700 transition-colors hover:text-maroon-900 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-between gap-4 rounded-full border border-maroon-800/20 bg-gradient-to-r from-maroon-800 to-maroon-950 px-6 py-4 text-left text-lg font-semibold text-white shadow-lg transition hover:from-maroon-700 hover:to-maroon-900 hover:shadow-xl disabled:opacity-60 lg:gap-5 lg:px-8 lg:py-5 lg:text-xl lg:font-semibold"
                  >
                    <span className="pl-1">{loading ? 'Signing in…' : 'Log in'}</span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 lg:h-14 lg:w-14">
                      {loading ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white lg:h-7 lg:w-7" strokeWidth={2} aria-hidden />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-white lg:h-7 lg:w-7" strokeWidth={2} aria-hidden />
                      )}
                    </span>
                  </button>
                </form>
              )}

              <p className="mx-auto mt-auto max-w-md pt-10 text-center text-xs text-gray-500 lg:max-w-xl lg:text-sm">
                PHILTECH Student Performance Analytics System
              </p>
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={forgotModalOpen}
        onClose={() => {
          setForgotModalOpen(false);
          setForgotLegacyNotice(false);
        }}
        showLegacyLinkNotice={forgotLegacyNotice}
        onSuccess={() => {
          setForgotModalOpen(false);
          setForgotLegacyNotice(false);
          setLoginModal({
            title: 'Check your email',
            message:
              'A temporary password was sent to your email. Sign in and change your password right away.',
            variant: 'success',
          });
        }}
      />

      {loginModal && (
        <MessageModal
          isOpen
          onClose={() => setLoginModal(null)}
          title={loginModal.title}
          message={loginModal.message}
          variant={loginModal.variant}
        />
      )}
    </div>
  );
}
