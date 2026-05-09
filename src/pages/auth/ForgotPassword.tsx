import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button, Input, GlassCard, Spinner } from '../../components/ui';
import { supabase, generateTempPassword, hashPassword } from '../../lib/supabase';
import { sendEmail, generatePasswordResetEmail } from '../../api/email';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
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

      // Keep response generic so account existence is not exposed.
      if (!user?.id || !user.email) {
        setSent(true);
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
        })
        .eq('id', user.id);
      if (updateError) throw updateError;

      const emailData = generatePasswordResetEmail(user.first_name || 'User', tempPassword);
      const emailSent = await sendEmail(user.email, emailData.subject, emailData.html);
      if (!emailSent.success) {
        throw new Error(emailSent.error || 'Unable to send email at the moment.');
      }

      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your account email and we will send a temporary password."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Account Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@school.edu"
          autoComplete="email"
          required
        />

        {sent && (
          <GlassCard variant="plain" className="!bg-green-50/60 !border-green-200 p-3">
            <p className="text-sm text-green-700 text-center">
              If the email exists in our records, a temporary password was sent. Check your inbox and spam folder.
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
              Send Reset Link
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
