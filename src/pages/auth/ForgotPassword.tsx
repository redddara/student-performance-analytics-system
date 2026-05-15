import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Mail } from 'lucide-react';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button, GlassCard, Input, Spinner } from '../../components/ui';
import { supabase, generateTempPassword, hashPassword } from '../../lib/supabase';
import { sendEmail, generatePasswordResetEmail, generatePasswordResetOtpEmail } from '../../api/email';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_EXPIRES_MINUTES = Math.round(OTP_TTL_MS / 60_000);

type FlowStep = 'email' | 'confirm' | 'verify';

type RpcResetUserRow = { id: string; email: string; first_name: string | null };

function generateSixDigitOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const n = 100000 + (buf[0]! % 900000);
  return String(n);
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const legacyToken = searchParams.get('token');

  const passwordResetEmailSent = Boolean(
    (location.state as { passwordResetEmailSent?: boolean } | null)?.passwordResetEmailSent
  );

  const [step, setStep] = useState<FlowStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    if (!passwordResetEmailSent) return;
    setStep('email');
    setEmail('');
    setOtp('');
    setExpiresAtMs(null);
    setSent(false);
    setError('');
    setVerifyError('');
  }, [passwordResetEmailSent]);

  useEffect(() => {
    if (!legacyToken) return;
    navigate('/forgot-password', { replace: true });
  }, [legacyToken, navigate]);

  useEffect(() => {
    if (expiresAtMs == null || step !== 'verify') {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const left = Math.ceil((expiresAtMs - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, left));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAtMs, step]);

  const sendOtpToEmail = useCallback(async (userRow: { id: string; email: string; first_name: string | null }) => {
      const plainOtp = generateSixDigitOtp();
      const otpHash = await hashPassword(plainOtp);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

      const { error: updateError } = await supabase
        .from('users')
        .update({
          password_reset_confirm_token: null,
          password_reset_otp_hash: otpHash,
          password_reset_confirm_expires_at: expiresAt,
        })
        .eq('id', userRow.id);
      if (updateError) throw updateError;

      const emailData = generatePasswordResetOtpEmail(userRow.first_name || 'User', plainOtp, OTP_EXPIRES_MINUTES);
      const emailSent = await sendEmail(userRow.email, emailData.subject, emailData.html);
      if (!emailSent.success) {
        throw new Error(emailSent.error || 'Unable to send email at the moment.');
      }

      setExpiresAtMs(Date.now() + OTP_TTL_MS);
      setOtp('');
      setVerifyError('');
      setStep('verify');
      setSent(true);
  }, []);

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required.');
      return;
    }
    setStep('confirm');
  };

  const handleConfirmSendCode = async () => {
    const trimmedEmail = email.trim();
    setError('');
    setLoading(true);
    try {
      const { data: user, error: lookupError } = await supabase
        .from('users')
        .select('id,email,first_name')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!user?.id || !user.email) {
        setSent(true);
        setStep('verify');
        setExpiresAtMs(null);
        setSecondsLeft(0);
        return;
      }

      await sendOtpToEmail(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send verification code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    const trimmedEmail = email.trim();
    setError('');
    setLoading(true);
    try {
      const { data: user, error: lookupError } = await supabase
        .from('users')
        .select('id,email,first_name')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!user?.id || !user.email) {
        setError('Could not resend code for this address.');
        return;
      }

      await sendOtpToEmail(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resend code.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    const trimmedEmail = email.trim();
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      setVerifyError('Enter the 6-digit code from your email.');
      return;
    }
    if (expiresAtMs != null && Date.now() >= expiresAtMs) {
      setVerifyError('This code has expired. Request a new code.');
      return;
    }

    setVerifyLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_user_by_password_reset_otp', {
        p_email: trimmedEmail,
        p_otp: trimmedOtp,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? (data[0] as RpcResetUserRow | undefined) : (data as RpcResetUserRow | null);
      if (!row?.id || !row.email) {
        setVerifyError('Invalid code. Check the number and try again, or request a new code.');
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
          password_reset_otp_hash: null,
          password_reset_confirm_expires_at: null,
        })
        .eq('id', row.id);
      if (updateError) throw updateError;

      const emailData = generatePasswordResetEmail(row.first_name || 'User', tempPassword);
      const emailSent = await sendEmail(row.email, emailData.subject, emailData.html);
      if (!emailSent.success) {
        throw new Error(
          emailSent.error || 'Password was updated but the email could not be sent. Contact an administrator.'
        );
      }

      navigate('/forgot-password', { replace: true, state: { passwordResetEmailSent: true } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not verify the code.';
      setVerifyError(message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const codeExpired = expiresAtMs != null && Date.now() >= expiresAtMs;

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle={
        step === 'email'
          ? 'Enter your account email. We will confirm before sending a one-time code.'
          : step === 'confirm'
            ? 'Confirm that you want a verification code sent to your email.'
            : 'Enter the 6-digit code we emailed you. It expires after a short time.'
      }
    >
      {legacyToken && (
        <GlassCard variant="plain" className="!bg-amber-50/60 !border-amber-200 mb-4 p-3">
          <p className="text-sm text-amber-900 text-center">
            Password reset now uses a verification code by email instead of a link. Continue below with your email
            address.
          </p>
        </GlassCard>
      )}

      {passwordResetEmailSent && (
        <GlassCard variant="plain" className="!bg-green-50/60 !border-green-200 mb-4 p-3">
          <p className="text-sm text-green-800 text-center">
            A temporary password was sent to your email. Sign in and change your password right away.
          </p>
        </GlassCard>
      )}

      {step === 'email' && (
        <form onSubmit={handleEmailContinue} className="space-y-5">
          <Input
            label="Account Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@school.edu"
            autoComplete="email"
            required
          />

          {error && (
            <GlassCard variant="plain" className="!bg-red-50/60 !border-red-200 p-3">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </GlassCard>
          )}

          <Button type="submit" className="w-full">
            Continue
          </Button>

          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Back to Login
          </Link>
        </form>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <GlassCard variant="plain" className="p-4">
            <p className="text-sm text-gray-700 text-center leading-relaxed">
              We will send a <strong>6-digit verification code</strong> to{' '}
              <span className="font-semibold text-gray-900">{email.trim()}</span>. The code will work for{' '}
              <strong>{OTP_EXPIRES_MINUTES} minutes</strong>. Nothing changes on your account until you enter the code
              correctly.
            </p>
          </GlassCard>

          {error && (
            <GlassCard variant="plain" className="!bg-red-50/60 !border-red-200 p-3">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </GlassCard>
          )}

          <Button type="button" className="w-full" disabled={loading} onClick={() => void handleConfirmSendCode()}>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Mail className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                Send verification code
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={loading}
            onClick={() => {
              setError('');
              setStep('email');
            }}
          >
            Use a different email
          </Button>

          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Back to Login
          </Link>
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-5">
          {sent && expiresAtMs != null && (
            <GlassCard variant="plain" className="!bg-green-50/60 !border-green-200 p-3">
              <p className="text-sm text-green-800 text-center">
                If the email exists in our records, we sent a verification code. Check your inbox and spam folder.
              </p>
            </GlassCard>
          )}

          {sent && expiresAtMs == null && (
            <GlassCard variant="plain" className="!bg-green-50/60 !border-green-200 p-3">
              <p className="text-sm text-green-800 text-center">
                If the email exists in our records, we sent instructions. Check your inbox and spam folder.
              </p>
            </GlassCard>
          )}

          {expiresAtMs != null && (
            <GlassCard variant="plain" className="flex items-center justify-center gap-2 p-3">
              <Clock className="h-5 w-5 shrink-0 text-[#800000]" strokeWidth={2} aria-hidden />
              <p className={`text-sm font-medium ${codeExpired ? 'text-red-700' : 'text-gray-800'}`}>
                {codeExpired ? 'Code expired — use “Resend code” below.' : `Time left: ${formatMmSs(secondsLeft)}`}
              </p>
            </GlassCard>
          )}

          {expiresAtMs != null && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <Input
                label="Verification code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="font-mono text-center text-lg tracking-[0.35em]"
              />

              {verifyError && (
                <GlassCard variant="plain" className="!bg-red-50/60 !border-red-200 p-3">
                  <p className="text-sm text-red-600 text-center">{verifyError}</p>
                </GlassCard>
              )}

              <Button type="submit" className="w-full" disabled={verifyLoading || codeExpired || otp.length !== 6}>
                {verifyLoading ? <Spinner size="sm" /> : 'Verify and send temporary password'}
              </Button>
            </form>
          )}

          {error && (
            <GlassCard variant="plain" className="!bg-red-50/60 !border-red-200 p-3">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </GlassCard>
          )}

          {expiresAtMs != null && (
            <Button type="button" variant="secondary" className="w-full" disabled={loading} onClick={() => void handleResendCode()}>
              {loading ? <Spinner size="sm" /> : 'Resend code'}
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={loading || verifyLoading}
            onClick={() => {
              setError('');
              setVerifyError('');
              setOtp('');
              setExpiresAtMs(null);
              setSent(false);
              setStep('confirm');
            }}
          >
            Back
          </Button>

          <Link
            to="/login"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            Back to Login
          </Link>
        </div>
      )}
    </AuthLayout>
  );
}
