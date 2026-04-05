import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Input, Table, Modal, Spinner, Badge, Select, ConfirmModal } from '../../components/ui';
import { supabase, hashPassword, generateTempPassword, generateStudentUsername } from '../../lib/supabase';
import { sendEmail, generateStudentCredentialEmail, generatePasswordResetEmail } from '../../api/email';

export default function AdminUsersPage() {
  // const { setStudents } = useDataStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'student' | 'teacher' | 'admin'>('student');
  const [courses, setCourses] = useState<any[]>([]);

  const [filterSearch, setFilterSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterYearLevel, setFilterYearLevel] = useState('');
  const [filterTempStatus, setFilterTempStatus] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'delete' | 'reset' | null;
    userId: string | null;
    userName: string | null;
  }>({ isOpen: false, type: null, userId: null, userName: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, coursesRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('courses').select('*'),
      ]);
      
      setUsers(usersRes.data || []);
      setCourses(coursesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirmModal.userId) return;
    
    // Get user data first
    const { data: user } = await supabase.from('users').select('*').eq('id', confirmModal.userId).single();
    if (!user) return;
    
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    
    await supabase
      .from('users')
      .update({ 
        password_hash: passwordHash,
        is_temp_password: true,
        temp_password_visible: tempPassword 
      })
      .eq('id', confirmModal.userId);

    let emailNote = user.email ? '' : 'No email on file for this user.';
    if (user.email) {
      const emailData = generatePasswordResetEmail(user.first_name || 'User', tempPassword);
      const sent = await sendEmail(user.email, emailData.subject, emailData.html);
      emailNote = sent.success
        ? `Notification sent to ${user.email}.`
        : `Email could not be sent (${sent.error ?? 'unknown error'}). Share the new password manually.`;
    }

    alert(`Password reset successful!\n\nTemporary password: ${tempPassword}\n\n${emailNote}`);
  };

  const handleDeleteUser = async () => {
    if (!confirmModal.userId) return;
    
    try {
      const { data: user } = await supabase.from('users').select('*').eq('id', confirmModal.userId).single();
      
      if (user?.role === 'student') {
        // First get the student record
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', confirmModal.userId)
          .single();
        
        if (studentData?.id) {
          // Delete grades associated with the student
          await supabase.from('grades').delete().eq('student_id', studentData.id);
          // Delete student subject enrollments
          await supabase.from('student_subjects').delete().eq('student_id', studentData.id);
          // Delete the student record
          await supabase.from('students').delete().eq('user_id', confirmModal.userId);
        }
      }
      
      // Also clean up any subjects where this user was assigned as teacher
      await supabase.from('subjects').update({ teacher_id: null }).eq('teacher_id', confirmModal.userId);
      
      // Delete the user
      await supabase.from('users').delete().eq('id', confirmModal.userId);
      
      alert('User deleted successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const openConfirmModal = (type: 'delete' | 'reset', userId: string, userName: string) => {
    setConfirmModal({ isOpen: true, type, userId, userName });
  };

  const handleEditUser = async (userId: string, updatedData: any) => {
    try {
      await supabase
        .from('users')
        .update({
          first_name: updatedData.first_name,
          last_name: updatedData.last_name,
          email: updatedData.email,
          year_level: updatedData.year_level,
          section: updatedData.section,
          course_id: updatedData.course_id || null,
        })
        .eq('id', userId);
      
      loadData();
      alert('User updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return users.filter((u) => {
      const displayName = (u.name || `${u.first_name || ''} ${u.last_name || ''}`).trim().toLowerCase();
      const email = String(u.email || '').toLowerCase();
      const uname = String(u.username || '').toLowerCase();
      if (q && !displayName.includes(q) && !email.includes(q) && !uname.includes(q)) return false;
      if (filterRole && u.role !== filterRole) return false;
      if (filterCourseId && u.course_id !== filterCourseId) return false;
      if (filterYearLevel && (u.year_level || '') !== filterYearLevel) return false;
      if (filterTempStatus === 'temp' && !u.is_temp_password) return false;
      if (filterTempStatus === 'active' && u.is_temp_password) return false;
      return true;
    });
  }, [users, filterSearch, filterRole, filterCourseId, filterYearLevel, filterTempStatus]);

  const hasActiveFilters =
    Boolean(filterSearch.trim()) ||
    Boolean(filterRole) ||
    Boolean(filterCourseId) ||
    Boolean(filterYearLevel) ||
    Boolean(filterTempStatus);

  const clearFilters = () => {
    setFilterSearch('');
    setFilterRole('');
    setFilterCourseId('');
    setFilterYearLevel('');
    setFilterTempStatus('');
  };

  if (loading) {
    return (
      <DashboardLayout title="Users">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Management">
      <div className="mb-5 w-full max-w-2xl">
        <label htmlFor="user-search" className="sr-only">
          Search users
        </label>
        <div className="relative">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-maroon-700/75"
            aria-hidden
          >
            <i className="hgi-stroke hgi-search text-xl" />
          </span>
          <input
            id="user-search"
            type="search"
            autoComplete="off"
            placeholder="Search by name, email, or student ID…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/55 py-3.5 pl-12 pr-4 text-base text-gray-900 shadow-[0_8px_32px_rgba(128,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl placeholder:text-gray-500 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/35"
          />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          variant="glass"
          className="w-full sm:w-auto"
          onClick={() => {
            setCreateType('student');
            setShowCreateModal(true);
          }}
        >
          <i className="hgi-stroke hgi-add-to-list text-lg" aria-hidden />
          Add Student
        </Button>
        <Button
          variant="glass"
          className="w-full sm:w-auto"
          onClick={() => {
            setCreateType('teacher');
            setShowCreateModal(true);
          }}
        >
          <i className="hgi-stroke hgi-add-to-list text-lg" aria-hidden />
          Add Teacher
        </Button>
        <Button
          variant="glass"
          className="w-full sm:w-auto"
          onClick={() => {
            setCreateType('admin');
            setShowCreateModal(true);
          }}
        >
          <i className="hgi-stroke hgi-add-to-list text-lg" aria-hidden />
          Add Admin
        </Button>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-maroon-200 bg-white text-[#800000] shadow-sm transition-colors hover:bg-maroon-50 touch-manipulation"
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? 'Hide user filters' : 'Show user filters'}
          title="Filters"
        >
          <i className="hgi-stroke hgi-filter text-xl" aria-hidden />
          {hasActiveFilters && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[#d4af37] ring-2 ring-white" aria-hidden />
          )}
        </button>
        {!filtersOpen && (
          <span className="text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredUsers.length}</span>
            {' / '}
            {users.length} user{users.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {filtersOpen && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 animate-fade-in">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#800000]">Filter users</h2>
            {hasActiveFilters && (
              <Button type="button" variant="secondary" className="w-full shrink-0 sm:w-auto" onClick={clearFilters}>
                <i className="hgi-stroke hgi-refresh text-lg" aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
          <p className="mb-4 text-sm text-gray-600">
            Use the search bar above to filter by name, email, or student ID.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Role"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              options={[
                { value: '', label: 'All roles' },
                { value: 'admin', label: 'Admin' },
                { value: 'teacher', label: 'Teacher' },
                { value: 'student', label: 'Student' },
              ]}
            />
            <Select
              label="Course"
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              options={[{ value: '', label: 'All courses' }, ...courses.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <Select
              label="Year level"
              value={filterYearLevel}
              onChange={(e) => setFilterYearLevel(e.target.value)}
              options={[
                { value: '', label: 'All years' },
                { value: '1st', label: '1st Year' },
                { value: '2nd', label: '2nd Year' },
                { value: '3rd', label: '3rd Year' },
                { value: '4th', label: '4th Year' },
              ]}
            />
            <Select
              label="Password status"
              value={filterTempStatus}
              onChange={(e) => setFilterTempStatus(e.target.value)}
              options={[
                { value: '', label: 'All' },
                { value: 'temp', label: 'Temporary password' },
                { value: 'active', label: 'Active (password changed)' },
              ]}
            />
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Showing <span className="font-semibold text-[#800000]">{filteredUsers.length}</span> of {users.length} user
            {users.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      <GlassCard className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">All Users</h2>
        <Table headers={['Name', 'Username', 'Role', 'Email', 'Status', 'Actions']}>
          {filteredUsers.map((user) => (
            <tr key={user.id} className="hover:bg-white/20 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center text-white text-sm font-bold">
                    {user.name?.[0] || user.first_name?.[0] || 'U'}
                  </div>
                  <span className="font-medium text-gray-800">
                    {user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-600">{user.username || '-'}</td>
              <td className="px-4 py-3">
                <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'teacher' ? 'warning' : 'success'}>
                  {user.role}
                </Badge>
              </td>
              <td className="px-4 py-3 text-gray-600">{user.email}</td>
              <td className="px-4 py-3">
                {user.is_temp_password && (
                  <Badge variant="warning">Temp</Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button 
                    type="button"
                    className="p-2 rounded-lg glass-hover text-[#800000]" 
                    onClick={() => openConfirmModal('reset', user.id, user.name || `${user.first_name} ${user.last_name}`)}
                    title="Reset Password"
                  >
                    <i className="hgi-stroke hgi-refresh" aria-hidden />
                  </button>
                  <EditUserModal user={user} courses={courses} onSave={handleEditUser} />
                  <button 
                    type="button"
                    className="p-2 rounded-lg glass-hover text-red-600" 
                    onClick={() => openConfirmModal('delete', user.id, user.name || `${user.first_name} ${user.last_name}`)}
                    title="Delete User"
                  >
                    <i className="hgi-stroke hgi-delete-01" aria-hidden />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
        {users.length === 0 && <p className="text-center text-gray-500 py-8">No users found</p>}
        {users.length > 0 && filteredUsers.length === 0 && (
          <p className="text-center text-gray-500 py-8">No users match your filters. Try adjusting or clear filters.</p>
        )}
      </GlassCard>

      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        type={createType}
        courses={courses}
        onSuccess={loadData}
      />
      
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, userId: null, userName: null })}
        onConfirm={() => {
          if (confirmModal.type === 'reset') handleResetPassword();
          else if (confirmModal.type === 'delete') handleDeleteUser();
        }}
        title={confirmModal.type === 'reset' ? 'Reset Password' : 'Delete User'}
        message={confirmModal.type === 'reset' 
          ? `Are you sure you want to reset the password for ${confirmModal.userName}?`
          : `Are you sure you want to delete ${confirmModal.userName}? This action cannot be undone.`
        }
        confirmText={confirmModal.type === 'reset' ? 'Reset' : 'Delete'}
        variant={confirmModal.type === 'reset' ? 'warning' : 'danger'}
      />
    </DashboardLayout>
  );
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'student' | 'teacher' | 'admin';
  courses: any[];
  onSuccess: () => void;
}

function CreateUserModal({ isOpen, onClose, type, courses, onSuccess }: CreateUserModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    course_id: '',
    grade_level: '1st',
    section: '3N1',
    semester: '1st Sem',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const course = courses.find(c => c.id === formData.course_id);
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      let username: string | null = null;

      if (type === 'student') {
        // Generate student ID for students
        const { data: existingUsers } = await supabase
          .from('users')
          .select('username')
          .like('username', 'STUD-%')
          .order('username', { ascending: false })
          .limit(1);

        let nextNumber = 1001;
        if (existingUsers && existingUsers.length > 0) {
          const lastNum = parseInt(existingUsers[0].username?.split('-')[2] || '1000');
          nextNumber = lastNum + 1;
        }

        username = generateStudentUsername(course?.name || 'BSCS', nextNumber);
      }

      if (formData.email?.trim()) {
        const { data: existingEmail } = await supabase
          .from('users')
          .select('id')
          .eq('email', formData.email.trim())
          .maybeSingle();

        if (existingEmail?.id) {
          alert('A user with this email already exists. Use a different email or edit the existing user.');
          setLoading(false);
          return;
        }
      }

      if (username) {
        const { data: existingUsername } = await supabase
          .from('users')
          .select('id')
          .eq('username', username)
          .maybeSingle();

        if (existingUsername?.id) {
          alert('This student ID is already in use. Try again or adjust the sequence.');
          setLoading(false);
          return;
        }
      }

      // Create the user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          email: formData.email,
          password_hash: passwordHash,
          role: type,
          username,
          is_temp_password: true,
          temp_password_visible: tempPassword,
          first_name: formData.first_name,
          last_name: formData.last_name,
          course_id: type === 'admin' ? null : formData.course_id || null,
          year_level: type === 'student' ? formData.grade_level : null,
          section: type === 'student' ? formData.section : null,
        })
        .select()
        .single();

      if (userError) {
        // If error is about duplicate, try to handle it
        if (userError.message?.includes('duplicate') || userError.code === '23505') {
          alert('A user with this email already exists. Please use a different email.');
          setLoading(false);
          return;
        }
        throw userError;
      }

      // If creating a student, also create student record
      if (type === 'student' && userData?.id) {
        // Check if student record already exists
        const { data: existingStudent } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', userData.id)
          .limit(1);

        if (!existingStudent || existingStudent.length === 0) {
          const { data: studentData, error: studentError } = await supabase
            .from('students')
            .insert({
              first_name: formData.first_name,
              last_name: formData.last_name,
              grade_level: formData.grade_level,
              section: formData.section,
              course_id: formData.course_id,
              user_id: userData.id,
            })
            .select()
            .single();

          if (studentError && !studentError.message?.includes('duplicate')) {
            console.error('Student creation error:', studentError);
          }

          // Auto-enroll student in subjects for their year level and course
          if (studentData?.id) {
            const { data: matchingSubjects } = await supabase
              .from('subjects')
              .select('*')
              .eq('course_id', formData.course_id)
              .eq('year_level', formData.grade_level)
              .eq('semester', formData.semester);

            if (matchingSubjects && matchingSubjects.length > 0) {
              const enrollments = matchingSubjects.map(sub => ({
                student_id: studentData.id,
                subject_id: sub.id,
              }));
              await supabase.from('student_subjects').insert(enrollments);
            }
          }
        }
      }

      let emailNote = formData.email
        ? ''
        : 'No email on file; share credentials manually.';
      if (formData.email) {
        const credentialRole =
          type === 'admin' ? 'admin' : type === 'teacher' ? 'teacher' : 'student';
        const emailData = generateStudentCredentialEmail(
          formData.first_name,
          username || formData.email,
          tempPassword,
          credentialRole
        );
        const sent = await sendEmail(formData.email, emailData.subject, emailData.html);
        emailNote = sent.success
          ? `Credentials sent to ${formData.email}.`
          : `Email could not be sent (${sent.error ?? 'unknown error'}). Share credentials manually.`;
      }

      const loginLine =
        type === 'student'
          ? `Student ID: ${username}`
          : `Login email: ${formData.email}`;

      alert(
        `User created successfully!\n\n${loginLine}\nTemporary password: ${tempPassword}\n\n${emailNote}`
      );
      onSuccess();
      onClose();
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        course_id: '',
        grade_level: '1st',
        section: '3N1',
        semester: '1st Sem',
      });
    } catch (err: any) {
      console.error('Create user error:', err);
      alert(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create ${type === 'student' ? 'Student' : type === 'teacher' ? 'Teacher' : 'Admin'}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="First Name" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} required />
        <Input label="Last Name" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} required />
        <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
        
        {type === 'student' && (
          <>
            <Select label="Course" value={formData.course_id} onChange={e => setFormData({ ...formData, course_id: e.target.value })} options={courses.map(c => ({ value: c.id, label: c.name }))} required />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select label="Year Level" value={formData.grade_level} onChange={e => setFormData({ ...formData, grade_level: e.target.value })} options={[{ value: '1st', label: '1st Year' }, { value: '2nd', label: '2nd Year' }, { value: '3rd', label: '3rd Year' }, { value: '4th', label: '4th Year' }]} />
              <Input label="Section" value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })} required />
              <Select label="Semester" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} options={[{ value: '1st Sem', label: '1st Sem' }, { value: '2nd Sem', label: '2nd Sem' }]} />
            </div>
          </>
        )}
        
        {type === 'teacher' && (
          <Select label="Course" value={formData.course_id} onChange={e => setFormData({ ...formData, course_id: e.target.value })} options={courses.map(c => ({ value: c.id, label: c.name }))} />
        )}

        <div className="flex gap-4 pt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            <i className="hgi-stroke hgi-close-circle text-lg" aria-hidden />
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <i className="hgi-stroke hgi-plus text-lg" aria-hidden />
                Create
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface EditUserModalProps {
  user: any;
  courses: any[];
  onSave: (userId: string, data: any) => void;
}

function EditUserModal({ user, courses, onSave }: EditUserModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    email: user.email || '',
    year_level: user.year_level || '',
    section: user.section || '',
    course_id: user.course_id || '',
  });

  useEffect(() => {
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      year_level: user.year_level || '',
      section: user.section || '',
      course_id: user.course_id || '',
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSave(user.id, formData);
    setLoading(false);
    setIsOpen(false);
  };

  return (
    <>
      <button 
        type="button"
        className="p-2 rounded-lg glass-hover text-[#800000]" 
        onClick={() => setIsOpen(true)}
        title="Edit User"
      >
        <i className="hgi-stroke hgi-edit-02" aria-hidden />
      </button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Edit User">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="First Name" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} required />
            <Input label="Last Name" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} required />
          </div>
          <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
          {(user.role === 'student' || user.role === 'teacher') && (
            <>
              <Select label="Course" value={formData.course_id} onChange={e => setFormData({ ...formData, course_id: e.target.value })} options={courses.map(c => ({ value: c.id, label: c.name }))} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select label="Year Level" value={formData.year_level} onChange={e => setFormData({ ...formData, year_level: e.target.value })} options={[{ value: '1st', label: '1st Year' }, { value: '2nd', label: '2nd Year' }, { value: '3rd', label: '3rd Year' }, { value: '4th', label: '4th Year' }]} />
                <Input label="Section" value={formData.section} onChange={e => setFormData({ ...formData, section: e.target.value })} />
              </div>
            </>
          )}
          <div className="flex gap-4 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setIsOpen(false)}>
              <i className="hgi-stroke hgi-close-circle text-lg" aria-hidden />
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <Spinner size="sm" />
              ) : (
                <>
                  <i className="hgi-stroke hgi-checkmark-circle-02 text-lg" aria-hidden />
                  Save
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}