import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button, Input, GlassCard, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, hashPassword } from '../../lib/supabase';
import type { User } from '../../types';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAuthStore();
  
  const user = location.state?.user as User | null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const passwordHash = await hashPassword(newPassword);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          password_hash: passwordHash,
          is_temp_password: false
        })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { error: authPwError } = await supabase.auth.updateUser({ password: newPassword });
        if (authPwError) console.warn('Auth password sync:', authPwError.message);
      }

      // Fetch updated user and set state
      const { data: updatedUsers } = await supabase
        .from('users')
        .select('*')
        .eq('id', user?.id)
        .limit(1);

      if (updatedUsers && updatedUsers.length > 0) {
        setUser(updatedUsers[0]);
        
        // Redirect based on role
        if (updatedUsers[0].role === 'student') {
          navigate('/student/dashboard');
        } else if (updatedUsers[0].role === 'teacher') {
          navigate('/teacher/dashboard');
        } else if (updatedUsers[0].role === 'admin') {
          navigate('/admin/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Change Password" subtitle="You must change your temporary password">
      <form onSubmit={handleSubmit} className="space-y-6">
        <GlassCard variant="plain" className="!bg-yellow-50/50 !border-yellow-200 p-4">
          <p className="flex items-start justify-center gap-2 text-sm text-yellow-800 text-center">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-700" strokeWidth={2} aria-hidden />
            <span>This is your first login. Please create a new password.</span>
          </p>
        </GlassCard>

        <Input
          label="New Password"
          type="password"
          placeholder="Enter new password (min 6 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          className="!bg-white/50 !border-white/40"
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Confirm your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="!bg-white/50 !border-white/40"
        />

        {error && (
          <GlassCard variant="plain" className="!bg-red-50/50 !border-red-200 p-3">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </GlassCard>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <>
              <KeyRound className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Change Password
            </>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}