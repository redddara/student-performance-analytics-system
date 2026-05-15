import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button, GlassCard, Input, Spinner } from '../../components/ui';
import { supabase, generateTempPassword, hashPassword } from '../../lib/supabase';
import {
  sendEmail,
  generatePasswordResetEmail,
  generatePasswordResetConfirmationEmail,
  forgotPasswordConfirmUrl,
} from '../../api/email';

function generateResetConfirmToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const RESET_CONFIRM_TTL_MS = 60 * 60 * 1000;

type RpcResetUserRow = { id: string; email: string; first_name: string | null };

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tokenFromUrl = searchParams.get('token');

  const passwordResetEmailSent = Boolean(
    (location.state as { passwordResetEmailSent?: boolean } | null)?.passwordResetEmailSent
  );

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const [tokenCheck, setTokenCheck] = useState<'idle' | 'loading' | 'ready' | 'invalid'>('idle');
  const [tokenUser, setTokenUser] = useState<RpcResetUserRow | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeError, setCompleteError] = useState('');

  useEffect(() => {
    if (!tokenFromUrl) {
      setTokenCheck('idle');
      setTokenUser(null);
      setCompleteError('');
      return;
    }

    let cancelled = false;
    setTokenCheck('loading');

    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_user_by_password_reset_confirm_token', {
          p_token: tokenFromUrl,
        });
        if (cancelled) return;
        if (rpcError) {
          setTokenCheck('invalid');
          setTokenUser(null);
          return;
        }
        const row = Array.isArray(data) ? (data[0] as RpcResetUserRow | undefined) : (data as RpcResetUserRow | null);
        if (!row?.id || !row.email) {
          setTokenCheck('invalid');
          setTokenUser(null);
          return;
        }
        setTokenUser(row);
        setTokenCheck('ready');
      } catch {
        if (!cancelled) {
          setTokenCheck('invalid');
          setTokenUser(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl]);

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSent(false);
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        setError('Email is required.');
        return;
      }

      const { data: user, error: lookupError } = await supabase
        .from('users')
        .select('id,email,first_name')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!user?.id || !user.email) {
        setSent(true);
        return;
      }

      const confirmToken = generateResetConfirmToken();
      const expiresAt = new Date(Date.now() + RESET_CONFIRM_TTL_MS).toISOString();

      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_reset_confirm_token: confirmToken,
          password_reset_confirm_expires_at: expiresAt,
        })
        .eq('id', user.id);
      if (updateError) throw updateError;

      const confirmUrl = forgotPasswordConfirmUrl(confirmToken);
      const emailData = generatePasswordResetConfirmationEmail(user.first_name || 'User', confirmUrl);
      const emailSent = await sendEmail(user.email, emailData.subject, emailData.html);
      if (!emailSent.success) {
        throw new Error(emailSent.error || 'Unable to send email at the moment.');
      }

      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send confirmation email.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const completeResetAfterConfirm = useCallback(async () => {
    if (!tokenUser?.id || !tokenUser.email || !tokenFromUrl) return;
    setCompleteError('');
    setCompleteLoading(true);
    try {
      const { data: validRows, error: rpcError } = await supabase.rpc('get_user_by_password_reset_confirm_token', {
        p_token: tokenFromUrl,
      });
      if (rpcError) throw rpcError;
      const stillValid = Array.isArray(validRows) ? validRows[0] : validRows;
      if (!stillValid || (stillValid as RpcResetUserRow).id !== tokenUser.id) {
        setCompleteError('This confirmation link is invalid or has expired. Request a new reset from the forgot password page.');
        setTokenCheck('invalid');
        return;
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_hash: passwordHash,
          is_temp_password: true,
          temp_password_visible: tempPassword,
          password_reset_confirm_token: null,
          password_reset_confirm_expires_at: null,
        })
        .eq('id', tokenUser.id);
      if (updateError) throw updateError;

      const emailData = generatePasswordResetEmail(tokenUser.first_name || 'User', tempPassword);
      const emailSent = await sendEmail(tokenUser.email, emailData.subject, emailData.html);
      if (!emailSent.success) {
        throw new Error(emailSent.error || 'Password was updated but the email could not be sent. Contact an administrator.');
      }

      navigate('/forgot-password', { replace: true, state: { passwordResetEmailSent: true } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not complete password reset.';
      setCompleteError(message);
    } finally {
      setCompleteLoading(false);
    }
  }, [tokenFromUrl, tokenUser, navigate]);

  if (tokenFromUrl) {
    if (tokenCheck !== 'ready' && tokenCheck !== 'invalid') {
      return (
        <AuthLayout title="Confirm password reset" subtitle="Checking your confirmation link...">
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        </AuthLayout>
      );
    }

    if (tokenCheck === 'invalid') {
      return (
        <AuthLayout title="Confirm password reset" subtitle="This link is invalid or has expired.">
          <GlassCard variant="plain" className="!bg-amber-50/60 !border-amber-200 p-4">
            <p className="text-sm text-amber-900 text-center">
              Request a new confirmation email from the forgot password page.
            </p>
          </GlassCard>
          <Link
            to="/forgot-password"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Start over
          </Link>
          <Link
            to="/login"
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Back to Login
          </Link>
        </AuthLayout>
      );
    }

    return (
      <AuthLayout
        title="Confirm password reset"
        subtitle="Finish only if you requested a password reset for your account."
      >
        <>
          <GlassCard variant="plain" className="mb-4 p-4">
            <p className="text-sm text-gray-700 text-center">
              Account: <span className="font-semibold text-gray-900">{tokenUser?.email}</span>
            </p>
          </GlassCard>
          {completeError && (
            <GlassCard variant="plain" className="!bg-red-50/60 !border-red-200 mb-4 p-3">
              <p className="text-sm text-red-600 text-center">{completeError}</p>
            </GlassCard>
          )}
          <Button type="button" className="w-full" disabled={completeLoading} onClick={() => void completeResetAfterConfirm()}>
            {completeLoading ? <Spinner size="sm" /> : 'Send temporary password to my email'}
          </Button>
        </>

        <Link
          to="/login"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Back to Login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your account email. We will send a confirmation link first; your password only changes after you confirm."
    >
      <form onSubmit={handleRequestSubmit} className="space-y-5">
        <Input
          label="Account Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@school.edu"
          autoComplete="email"
          required
        />

        {passwordResetEmailSent && (
          <GlassCard variant="plain" className="!bg-green-50/60 !border-green-200 p-3">
            <p className="text-sm text-green-800 text-center">
              A temporary password was sent to your email. Sign in and change your password right away.
            </p>
          </GlassCard>
        )}

        {sent && (
          <GlassCard variant="plain" className="!bg-green-50/60 !border-green-200 p-3">
            <p className="text-sm text-green-700 text-center">
              If the email exists in our records, we sent a confirmation link. Open it to receive your temporary password.
              Check your inbox and spam folder.
            </p>
          </GlassCard>
        )}

        {error && (
          <GlassCard variant="plain" className="!bg-red-50/60 !border-red-200 p-3">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </GlassCard>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <Mail className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Send confirmation email
            </>
          )}
        </Button>

        <Link
          to="/login"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          Back to Login
        </Link>
      </form>
    </AuthLayout>
  );
}
