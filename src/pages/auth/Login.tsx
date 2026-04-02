import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layouts/AuthLayout';
import { Button, Input, Spinner } from '../../components/ui';
import { useAuthStore } from '../../store';
import { supabase, hashPassword } from '../../lib/supabase';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const passwordHash = await hashPassword(password);
      
      const { data: users, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password_hash', passwordHash)
        .limit(1);

      if (fetchError) {
        throw fetchError;
      }

      if (!users || users.length === 0) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      const user = users[0];
      
      if (user.is_temp_password) {
        navigate('/change-password', { state: { user } });
        setLoading(false);
        return;
      }

      setUser(user);
      
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'teacher') {
        navigate('/teacher/dashboard');
      } else if (user.role === 'student') {
        navigate('/student/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="SAPAS Login" subtitle="Sign in to access the academic system">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-700 text-sm backdrop-blur-sm">
            {error}
          </div>
        )}
        
        <Input
          label="Username"
          placeholder="Enter your username"
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
        
        <Button 
          type="submit" 
          className="w-full py-3"
          disabled={loading}
        >
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