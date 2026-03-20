import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Button, Input, Select, Modal, Table, Badge } from '../../components/ui';
import { 
  Users, 
  Plus, 
  Search,
  UserPlus,
  Trash2,
  Edit,
  X,
  Mail,
  Shield,
  BookOpen,
  GraduationCap,
  UserCog
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const GRADE_LEVELS = [
  { value: '1st-Year', label: '1st-Year' },
  { value: '2nd-Year', label: '2nd-Year' },
  { value: '3rd-Year', label: '3rd-Year' },
  { value: '4th-Year', label: '4th-Year' },
];

const SECTIONS = [
  { value: '1m1', label: '1m1 - 1st Year Morning Section 1' },
  { value: '1m2', label: '1m2 - 1st Year Morning Section 2' },
  { value: '1n1', label: '1n1 - 1st Year Afternoon Section 1' },
  { value: '1n2', label: '1n2 - 1st Year Afternoon Section 2' },
  { value: '2m1', label: '2m1 - 2nd Year Morning Section 1' },
  { value: '2m2', label: '2m2 - 2nd Year Morning Section 2' },
  { value: '2n1', label: '2n1 - 2nd Year Afternoon Section 1' },
  { value: '2n2', label: '2n2 - 2nd Year Afternoon Section 2' },
  { value: '3m1', label: '3m1 - 3rd Year Morning Section 1' },
  { value: '3m2', label: '3m2 - 3rd Year Morning Section 2' },
  { value: '3n1', label: '3n1 - 3rd Year Afternoon Section 1' },
  { value: '3n2', label: '3n2 - 3rd Year Afternoon Section 2' },
  { value: '4m1', label: '4m1 - 4th Year Morning Section 1' },
  { value: '4m2', label: '4m2 - 4th Year Morning Section 2' },
  { value: '4n1', label: '4n1 - 4th Year Afternoon Section 1' },
  { value: '4n2', label: '4n2 - 4th Year Afternoon Section 2' },
];

const AdminUsers: React.FC = () => {
  const { courses, students, subjects } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [studentsData, setStudentsData] = useState<any[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student',
    firstName: '',
    lastName: '',
    gradeLevel: '1st-Year',
    section: '1m1',
    courseId: ''
  });

  // Edit form
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    role: 'student',
    firstName: '',
    lastName: '',
    gradeLevel: '1st-Year',
    section: '1m1',
    courseId: ''
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      // Fetch all students with their user data
      const { data: studentsDataResult, error: studentsError } = await supabase
        .from('students')
        .select('*, user:users(*)')
        .order('last_name');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
      }

      console.log('Users:', usersData);
      console.log('Students:', studentsDataResult);

      setUsers(usersData || []);
      setStudentsData(studentsDataResult || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  // Merge users with student data
  const getFullUserData = (user: any) => {
    const student = studentsData.find(s => s.user_id === user.id);
    return { ...user, student };
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: { data: { name: formData.name, role: formData.role } }
      });

      if (error) throw error;

      if (data.user) {
        await supabase.from('users').insert({
          id: data.user.id,
          email: formData.email,
          name: formData.name,
          role: formData.role,
          password_hash: 'managed_by_auth'
        });

        if (formData.role === 'student') {
          await supabase.from('students').insert({
            user_id: data.user.id,
            first_name: formData.firstName,
            last_name: formData.lastName,
            grade_level: formData.gradeLevel,
            section: formData.section,
            course_id: formData.courseId || null
          });
        }

        await fetchAllData();
        setIsModalOpen(false);
        resetForm();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update user record
      await supabase.from('users').update({ 
        name: editData.name,
        role: editData.role 
      }).eq('id', selectedUser.id);

      // If student, update student record
      const { data: studentData } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', selectedUser.id)
        .single();
      
      if (studentData) {
        await supabase.from('students').update({
          first_name: editData.firstName,
          last_name: editData.lastName,
          grade_level: editData.gradeLevel,
          section: editData.section,
          course_id: editData.courseId || null
        }).eq('id', studentData.id);
      } else if (editData.role === 'student') {
        // Create student record if doesn't exist
        await supabase.from('students').insert({
          user_id: selectedUser.id,
          first_name: editData.firstName,
          last_name: editData.lastName,
          grade_level: editData.gradeLevel,
          section: editData.section,
          course_id: editData.courseId || null
        });
      }

      await fetchAllData();
      setIsEditModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: any) => {
    const fullUser = getFullUserData(user);
    setSelectedUser(fullUser);
    setEditData({
      name: fullUser.name || '',
      email: fullUser.email || '',
      role: fullUser.role || 'student',
      firstName: fullUser.student?.first_name || '',
      lastName: fullUser.student?.last_name || '',
      gradeLevel: fullUser.student?.grade_level || '1st-Year',
      section: fullUser.student?.section || '1m1',
      courseId: fullUser.student?.course_id || ''
    });
    setIsEditModalOpen(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await supabase.from('users').delete().eq('id', userId);
      await fetchAllData();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'student',
      firstName: '',
      lastName: '',
      gradeLevel: '1st-Year',
      section: '1m1',
      courseId: ''
    });
  };

  const filteredUsers = users.filter(user => {
    const fullUser = getFullUserData(user);
    const matchesSearch = 
      fullUser.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullUser.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullUser.student?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullUser.student?.last_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || fullUser.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="danger">Admin</Badge>;
      case 'teacher':
        return <Badge variant="info">Teacher</Badge>;
      default:
        return <Badge variant="success">Student</Badge>;
    }
  };

  const getCourseName = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    return course?.name || 'N/A';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">User Management</h1>
            <p className="text-gray-400 mt-2">Manage all users - students, teachers, and admins</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add User
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search size={18} />}
              />
            </div>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Roles' },
                { value: 'admin', label: 'Admins' },
                { value: 'teacher', label: 'Teachers' },
                { value: 'student', label: 'Students' },
              ]}
            />
          </div>
        </Card>

        {/* Users Table */}
        <Card>
          <Table headers={['User', 'Email', 'Role', 'Details', 'Created', 'Actions']}>
            {filteredUsers.map(user => {
              const fullUser = getFullUserData(user);
              return (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-maroon-600 to-gold-500 flex items-center justify-center text-white font-semibold">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      <span className="text-white font-medium">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{user.email}</td>
                  <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {user.role === 'student' && fullUser.student ? (
                      <div>
                        <p>{fullUser.student.first_name} {fullUser.student.last_name}</p>
                        <p className="text-xs text-gray-500">
                          {fullUser.student.grade_level} - {fullUser.student.section}
                        </p>
                      </div>
                    ) : user.role === 'teacher' ? (
                      <span className="text-gray-400">Teacher Account</span>
                    ) : (
                      <span className="text-gray-400">Admin Account</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(fullUser)}
                        className="p-2 rounded-lg text-gold-400 hover:bg-gold-500/10 transition-colors"
                        title="Edit User"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              {users.length === 0 ? 'No users found. Create your first user!' : 'No users match your search criteria.'}
            </div>
          )}
        </Card>

        {/* Debug info */}
        <div className="text-center text-gray-500 text-sm">
          Total Users: {users.length} | Students: {studentsData.length}
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); resetForm(); }}
        title="Add New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />
          <Input
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          
          {formData.role === 'student' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
                <Input
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
              <Select
                label="Year Level"
                value={formData.gradeLevel}
                onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                options={GRADE_LEVELS}
              />
              <Select
                label="Section"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                options={SECTIONS}
              />
              <Select
                label="Course"
                value={formData.courseId}
                onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                options={[
                  { value: '', label: 'Select Course' },
                  ...courses.map(c => ({ value: c.id, label: c.name }))
                ]}
              />
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit User Information"
      >
        <form onSubmit={handleEditUser} className="space-y-4">
          <Input
            label="Full Name"
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            required
          />
          
          <Select
            label="Role"
            value={editData.role}
            onChange={(e) => setEditData({ ...editData, role: e.target.value })}
            options={[
              { value: 'student', label: 'Student' },
              { value: 'teacher', label: 'Teacher' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          
          {(editData.role === 'student' || selectedUser?.student) && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  value={editData.firstName}
                  onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                  required
                />
                <Input
                  label="Last Name"
                  value={editData.lastName}
                  onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                  required
                />
              </div>
              <Select
                label="Year Level"
                value={editData.gradeLevel}
                onChange={(e) => setEditData({ ...editData, gradeLevel: e.target.value })}
                options={GRADE_LEVELS}
              />
              <Select
                label="Section"
                value={editData.section}
                onChange={(e) => setEditData({ ...editData, section: e.target.value })}
                options={SECTIONS}
              />
              <Select
                label="Course"
                value={editData.courseId}
                onChange={(e) => setEditData({ ...editData, courseId: e.target.value })}
                options={[
                  { value: '', label: 'Select Course' },
                  ...courses.map(c => ({ value: c.id, label: c.name }))
                ]}
              />
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default AdminUsers;
