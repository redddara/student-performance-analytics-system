import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Input, Select, Modal, Spinner, Badge } from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase, generateStudentUsername, generateTempPassword, hashPassword } from '../../lib/supabase';
import { sendEmail, generateStudentCredentialEmail } from '../../api/email';
import type { Course } from '../../types';

export default function AdminDashboard() {
  const { students, teachers, courses, subjects, grades, setCourses, setSubjects, setStudents, setGrades, setTeachers } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'student' | 'teacher'>('student');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, subjectsRes, studentsRes, usersRes, gradesRes] = await Promise.all([
        supabase.from('courses').select('*'),
        supabase.from('subjects').select('*, course:courses(*), teacher:users(*)'),
        supabase.from('students').select('*, user:users(*), course:courses(*)'),
        supabase.from('users').select('*').in('role', ['teacher']),
        supabase.from('grades').select('*'),
      ]);

      if (coursesRes.data) setCourses(coursesRes.data);
      if (subjectsRes.data) setSubjects(subjectsRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);
      if (usersRes.data) setTeachers(usersRes.data);
      if (gradesRes.data) setGrades(gradesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalStudents = students.length;
  const totalTeachers = teachers.length;
  const totalSubjects = subjects.length;

  // Calculate pass rate
  const passRate = grades.length > 0
    ? Math.round((grades.filter(g => g.grade >= 75).length / grades.length) * 100)
    : 0;

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center text-2xl">
              <i className="hgi-stroke hgi-student text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#800000]">{totalStudents}</p>
              <p className="text-sm text-gray-500">Total Students</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8962e] flex items-center justify-center text-2xl">
              <i className="hgi-stroke hgi-school-tie text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#d4af37]">{totalTeachers}</p>
              <p className="text-sm text-gray-500">Total Teachers</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-maroon-500 to-maroon-600 flex items-center justify-center text-2xl">
              <i className="hgi-stroke hgi-book-02 text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-maroon-600">{totalSubjects}</p>
              <p className="text-sm text-gray-500">Total Subjects</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center text-2xl">
              <i className="hgi-stroke hgi-checkmark-circle-02 text-white text-xl"></i>
            </div>
            <div>
              <p className="text-2xl font-bold text-gold-600">{passRate}%</p>
              <p className="text-sm text-gray-500">Pass Rate</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Quick Actions */}
      <GlassCard className="p-6 mb-8">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">Quick Actions</h2>
        <div className="flex gap-4 flex-wrap">
          <Button onClick={() => { setCreateType('student'); setShowCreateModal(true); }}>
<i className="hgi-stroke hgi-plus mr-1 text-lg"/>Create Student
          </Button>
          <Button variant="secondary" onClick={() => { setCreateType('teacher'); setShowCreateModal(true); }}>
<i className="hgi-stroke hgi-plus mr-1 text-lg"/>Create Teacher
          </Button>
          <Button variant="ghost" onClick={() => window.location.href = '/admin/courses'}>
            Manage Courses
          </Button>
          <Button variant="ghost" onClick={() => window.location.href = '/admin/subjects'}>
            Manage Subjects
          </Button>
        </div>
      </GlassCard>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-[#800000] mb-4">Recent Students</h2>
          {students.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No students yet</p>
          ) : (
            <div className="space-y-3">
              {students.slice(0, 5).map(student => (
                <div key={student.id} className="flex items-center justify-between p-3 rounded-xl bg-white/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center text-white font-bold">
                      {student.first_name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{student.first_name} {student.last_name}</p>
                      <p className="text-sm text-gray-500">{student.grade_level} - {student.section}</p>
                    </div>
                  </div>
                  {student.course && (
                    <Badge variant="info">{student.course.name}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-xl font-semibold text-[#800000] mb-4">Subjects Overview</h2>
          {subjects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No subjects yet</p>
          ) : (
            <div className="space-y-3">
              {subjects.slice(0, 5).map(subject => (
                <div key={subject.id} className="flex items-center justify-between p-3 rounded-xl bg-white/30">
                  <div>
                    <p className="font-medium text-gray-800">{subject.name}</p>
                    <p className="text-sm text-gray-500">{subject.year_level} - {subject.semester}</p>
                  </div>
                  {subject.teacher && (
                    <Badge variant="success">{subject.teacher.name || `${subject.teacher.first_name} ${subject.teacher.last_name}`}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Create User Modal */}
      <CreateUserModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        type={createType}
        courses={courses}
      />
    </DashboardLayout>
  );
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'student' | 'teacher';
  courses: Course[];
}

function CreateUserModal({ isOpen, onClose, type, courses }: CreateUserModalProps) {
  const { students, setStudents } = useDataStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    course_id: '',
    grade_level: '1st',
    section: '1',
    semester: '1st Sem',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const course = courses.find(c => c.id === formData.course_id);
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      // Get next student number for username
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

      const username = generateStudentUsername(course?.name || 'BSCS', nextNumber);

      // Create user
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
          course_id: formData.course_id,
          year_level: formData.grade_level,
          section: formData.section,
        })
        .select()
        .single();

      if (userError) throw userError;

      if (type === 'student') {
        // Create student record
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
          .select('*, course:courses(*), user:users(*)')
          .single();

        if (studentError) throw studentError;

        // Auto-enroll in subjects matching course, year level, semester
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

        // Update local store
        const updatedStudents: any[] = [...(students as any[]), studentData];
        setStudents(updatedStudents);

        // Send email notification
        if (formData.email) {
          const emailData = generateStudentCredentialEmail(formData.first_name, username, tempPassword, 'student');
          await sendEmail(formData.email, emailData.subject, emailData.html);
        }

        alert(`Student created successfully!\n\nUsername: ${username}\nTemporary Password: ${tempPassword}\n\nCredentials sent to ${formData.email || 'email not provided'}`);
      } else {
        // Send email notification
        if (formData.email) {
          const emailData = generateStudentCredentialEmail(formData.first_name, username, tempPassword, 'teacher');
          await sendEmail(formData.email, emailData.subject, emailData.html);
        }

        alert(`Teacher created successfully!\n\nUsername: ${username}\nTemporary Password: ${tempPassword}\n\nCredentials sent to ${formData.email || 'email not provided'}`);
      }

      onClose();
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        course_id: '',
        grade_level: '1st',
        section: '1',
        semester: '1st Sem',
      });
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create ${type === 'student' ? 'Student' : 'Teacher'}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="First Name"
          value={formData.first_name}
          onChange={e => setFormData({ ...formData, first_name: e.target.value })}
          required
        />
        <Input
          label="Last Name"
          value={formData.last_name}
          onChange={e => setFormData({ ...formData, last_name: e.target.value })}
          required
        />
        <Input
          label="Email"
          type="email"
          value={formData.email}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
          required
        />
        
        {type === 'student' && (
          <>
            <Select
              label="Course"
              value={formData.course_id}
              onChange={e => setFormData({ ...formData, course_id: e.target.value })}
              options={courses.map(c => ({ value: c.id, label: c.name }))}
              required
            />
            <div className="grid grid-cols-3 gap-4">
              <Select
                label="Year Level"
                value={formData.grade_level}
                onChange={e => setFormData({ ...formData, grade_level: e.target.value })}
                options={[
                  { value: '1st', label: '1st Year' },
                  { value: '2nd', label: '2nd Year' },
                  { value: '3rd', label: '3rd Year' },
                  { value: '4th', label: '4th Year' },
                ]}
              />
              <Input
                label="Section"
                value={formData.section}
                onChange={e => setFormData({ ...formData, section: e.target.value })}
                placeholder="e.g., 3N1"
                required
              />
              <Select
                label="Semester"
                value={formData.semester}
                onChange={e => setFormData({ ...formData, semester: e.target.value })}
                options={[
                  { value: '1st Sem', label: '1st Sem' },
                  { value: '2nd Sem', label: '2nd Sem' },
                ]}
              />
            </div>
          </>
        )}

        <div className="flex gap-4 pt-4">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? <Spinner size="sm" /> : `Create ${type === 'student' ? 'Student' : 'Teacher'}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}