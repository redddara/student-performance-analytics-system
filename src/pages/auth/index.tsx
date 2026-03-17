import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../store';
import { GraduationCap, Mail, Lock, ArrowRight } from 'lucide-react';
import { Card, Button, Input, Select } from '../../components/ui';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, fetchCourses, fetchSubjects, fetchStudents, fetchGrades, fetchStudentSubjects } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (userData) {
          setUser(userData);
          await Promise.all([
            fetchCourses(),
            fetchSubjects(),
            fetchStudents(),
            fetchGrades(),
            fetchStudentSubjects()
          ]);

          if (userData.role === 'admin') {
            navigate('/admin');
          } else if (userData.role === 'teacher') {
            navigate('/teacher');
          } else {
            navigate('/student');
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-maroon-600 to-gold-500 mb-4">
          <GraduationCap className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white">Welcome Back</h1>
        <p className="text-gray-400 mt-2">Sign in to your account to continue</p>
      </div>

      <Card className="bg-black/40 backdrop-blur-xl border border-maroon-800/50">
        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
            <ArrowRight className="ml-2 inline" size={18} />
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">
            Don't have an account?{' '}
            <Link to="/auth/register" className="text-gold-400 hover:text-gold-300">
              Sign up
            </Link>
          </p>
        </div>
      </Card>

      <Card className="bg-black/30 backdrop-blur-xl border border-maroon-800/30">
        <p className="text-gray-400 text-sm text-center">
          Demo: Contact admin to create accounts
        </p>
      </Card>
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, fetchCourses, fetchSubjects, fetchStudents, fetchGrades, fetchStudentSubjects } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role } }
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        await supabase.from('users').insert({
          id: data.user.id,
          email,
          name,
          role,
          password_hash: 'managed_by_auth'
        });

        if (role === 'student') {
          const firstName = name.split(' ')[0];
          const lastName = name.split(' ').slice(1).join(' ') || '';
          await supabase.from('students').insert({
            user_id: data.user.id,
            first_name: firstName,
            last_name: lastName,
            grade_level: '1',
            section: 'A'
          });
        }

        const { data: loginData } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (loginData.user) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', loginData.user.id)
            .single();

          if (userData) {
            setUser(userData);
            await Promise.all([
              fetchCourses(),
              fetchSubjects(),
              fetchStudents(),
              fetchGrades(),
              fetchStudentSubjects()
            ]);

            if (userData.role === 'admin') {
              navigate('/admin');
            } else if (userData.role === 'teacher') {
              navigate('/teacher');
            } else {
              navigate('/student');
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Logo */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-maroon-600 to-gold-500 mb-4">
          <GraduationCap className="text-white" size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white">Create Account</h1>
        <p className="text-gray-400 mt-2">Join the academic analytics platform</p>
      </div>

      <Card className="bg-black/40 backdrop-blur-xl border border-maroon-800/50">
        <form onSubmit={handleRegister} className="space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            required
          />

          <Select
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'admin', label: 'Admin' },
            ]}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Create Account'}
            <ArrowRight className="ml-2 inline" size={18} />
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-400">
            Already have an account?{' '}
            <Link to="/auth/login" className="text-gold-400 hover:text-gold-300">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
};
