import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button, Input, GlassCard, Spinner } from '../../components/ui';
import { supabase, hashPassword } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [validRecoverySession, setValidRecoverySession] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      setValidRecoverySession(Boolean(session?.user));
      setValidating(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: authPwError } = await supabase.auth.updateUser({ password: newPassword });
      if (authPwError) throw authPwError;

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser?.email) {
        const passwordHash = await hashPassword(newPassword);
        await supabase
          .from('users')
          .update({ password_hash: passwordHash, is_temp_password: false })
          .eq('email', authUser.email.trim());
      }

      setSuccess(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <AuthLayout title="Reset Password" subtitle="Checking your reset link...">
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      </AuthLayout>
    );
  }

  if (!validRecoverySession) {
    return (
      <AuthLayout title="Reset Password" subtitle="This reset link is invalid or expired.">
        <div className="space-y-4">
          <GlassCard variant="plain" className="!bg-yellow-50/60 !border-yellow-200 p-3">
            <p className="text-sm text-yellow-800 text-center">
              Request a new reset email to continue.
            </p>
          </GlassCard>
          <Link
            to="/login"
            state={{ openForgotPassword: true }}
            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Request password reset
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set New Password" subtitle="Create a new password for your account.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Enter new password"
          required
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="Confirm new password"
          required
        />

        {error && (
          <GlassCard variant="plain" className="!bg-red-50/60 !border-red-200 p-3">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </GlassCard>
        )}

        {success && (
          <GlassCard variant="plain" className="!bg-green-50/60 !border-green-200 p-3">
            <p className="flex items-center justify-center gap-2 text-sm text-green-700 text-center">
              <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              Password updated successfully. Redirecting to login...
            </p>
          </GlassCard>
        )}

        <Button type="submit" className="w-full" disabled={loading || success}>
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <KeyRound className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Update Password
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
