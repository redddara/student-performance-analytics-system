import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { GlassCard, Button, Input, Select, Modal, Spinner, Badge } from '../../components/ui';
import { useDataStore } from '../../store';
import { supabase, generateStudentUsername, generateTempPassword, hashPassword } from '../../lib/supabase';
import { sendEmail, generateStudentCredentialEmail } from '../../api/email';
import type { Course } from '../../types';

export default function AdminDashboard() {
  const navigate = useNavigate();
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

  const recentStudentsSorted = useMemo(
    () =>
      [...students]
        .sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 5),
    [students]
  );

  const recentGradeHistory = useMemo(() => {
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
    return [...grades]
      .sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 25)
      .map((g) => {
        const st = studentMap.get(g.student_id);
        return {
          id: g.id,
          dateLabel: g.created_at
            ? new Date(g.created_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : '—',
          studentLabel: st ? `${st.first_name} ${st.last_name}` : '—',
          subjectLabel: subjectMap.get(g.subject_id) ?? '—',
          grade: g.grade,
          semester: g.semester,
          quarter: g.quarter,
        };
      });
  }, [grades, students, subjects]);

  const monthlyGradeVolume = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of grades) {
      if (!g.created_at) continue;
      const d = new Date(g.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12);
  }, [grades]);

  const maxMonthly = monthlyGradeVolume.reduce((m, [, n]) => Math.max(m, n), 0) || 1;

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
        <GlassCard className="p-4 sm:p-6">
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

        <GlassCard className="p-4 sm:p-6">
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

        <GlassCard className="p-4 sm:p-6">
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

        <GlassCard className="p-4 sm:p-6">
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
      <GlassCard className="p-4 sm:p-6 mb-8">
        <h2 className="text-xl font-semibold text-[#800000] mb-4">Quick Actions</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            variant="glass"
            className="w-full sm:w-auto"
            onClick={() => {
              setCreateType('student');
              setShowCreateModal(true);
            }}
          >
            <i className="hgi-stroke hgi-plus text-lg" aria-hidden />
            Create Student
          </Button>
          <Button
            variant="glass"
            className="w-full sm:w-auto"
            onClick={() => {
              setCreateType('teacher');
              setShowCreateModal(true);
            }}
          >
            <i className="hgi-stroke hgi-plus text-lg" aria-hidden />
            Create Teacher
          </Button>
          <Button
            variant="glass"
            className="w-full sm:w-auto"
            type="button"
            onClick={() => navigate('/admin/courses')}
          >
            <i className="hgi-stroke hgi-book-user text-lg" aria-hidden />
            Manage Courses
          </Button>
          <Button
            variant="glass"
            className="w-full sm:w-auto"
            type="button"
            onClick={() => navigate('/admin/subjects')}
          >
            <i className="hgi-stroke hgi-school-tie text-lg" aria-hidden />
            Manage Subjects
          </Button>
        </div>
      </GlassCard>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-[#800000] mb-4">Recent Students</h2>
          <p className="text-xs text-gray-500 mb-3">Newest registrations first (by record date).</p>
          {students.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No students yet</p>
          ) : (
            <div className="space-y-3">
              {recentStudentsSorted.map((student) => (
                <div key={student.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 glass-inset">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#800000] to-[#d4af37] flex items-center justify-center text-white font-bold">
                      {student.first_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">{student.first_name} {student.last_name}</p>
                      <p className="text-sm text-gray-500">
                        {student.grade_level} - {student.section}
                        {student.created_at && (
                          <span className="block text-xs text-gray-400 mt-0.5">
                            Added {new Date(student.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {student.course && (
                    <Badge variant="info" className="self-start sm:self-auto shrink-0">{student.course.name}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold text-[#800000] mb-4">Subjects Overview</h2>
          {subjects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No subjects yet</p>
          ) : (
            <div className="space-y-3">
              {subjects.slice(0, 5).map(subject => (
                <div key={subject.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 glass-inset">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 break-words">{subject.name}</p>
                    <p className="text-sm text-gray-500">{subject.year_level} - {subject.semester}</p>
                  </div>
                  {subject.teacher && (
                    <Badge variant="success" className="self-start sm:self-auto shrink-0 max-w-full truncate">{subject.teacher.name || `${subject.teacher.first_name} ${subject.teacher.last_name}`}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Historical data — plain card so tables & monospace labels stay readable (not maroon glass overrides) */}
      <GlassCard variant="plain" className="mt-8 border-maroon-200/70 p-4 shadow-md sm:p-6">
        <h2 className="text-xl font-semibold text-maroon-900 mb-1">Historical data</h2>
        <p className="mb-6 text-sm leading-relaxed text-gray-700">
          Grade records and trends use each row’s{' '}
          <span className="inline-block rounded-md border border-gray-400/80 bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold text-gray-900 shadow-sm">
            created_at
          </span>{' '}
          field—the time that grade was saved in the database.
        </p>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Recent grade records</h3>
            {recentGradeHistory.length === 0 ? (
              <p className="text-gray-500 text-sm py-6 text-center border border-dashed border-gray-200 rounded-xl">
                No grade history yet. Entries will appear here after teachers upload or enter grades.
              </p>
            ) : (
              <div className="max-h-[min(24rem,55vh)] overflow-auto rounded-xl border border-gray-200/80">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-10">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-700">When</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Student</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Subject</th>
                      <th className="px-3 py-2 font-semibold text-gray-700 text-right">Grade</th>
                      <th className="px-3 py-2 font-semibold text-gray-700 text-center">Sem / Q</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentGradeHistory.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.dateLabel}</td>
                        <td className="px-3 py-2 text-gray-800 max-w-[8rem] truncate" title={row.studentLabel}>
                          {row.studentLabel}
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-[10rem] truncate" title={row.subjectLabel}>
                          {row.subjectLabel}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-[#800000]">{row.grade}</td>
                        <td className="px-3 py-2 text-center text-gray-600 text-xs">
                          {row.semester} / Q{row.quarter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Grade entries by month</h3>
            {monthlyGradeVolume.length === 0 ? (
              <p className="text-gray-500 text-sm py-6 text-center border border-dashed border-gray-200 rounded-xl">
                No dated grade entries yet to chart over time.
              </p>
            ) : (
              <ul className="space-y-3">
                {monthlyGradeVolume.map(([monthKey, count]) => {
                  const [y, m] = monthKey.split('-');
                  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, {
                    month: 'short',
                    year: 'numeric',
                  });
                  const pct = Math.round((count / maxMonthly) * 100);
                  return (
                    <li key={monthKey}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{label}</span>
                        <span className="text-gray-600">{count} record{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden border border-gray-200/80">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-maroon-600 to-gold-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </GlassCard>

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
      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      if (type === 'teacher') {
        const { error: teacherUserError } = await supabase.from('users').insert({
          email: formData.email,
          password_hash: passwordHash,
          role: 'teacher',
          username: null,
          is_temp_password: true,
          temp_password_visible: tempPassword,
          first_name: formData.first_name,
          last_name: formData.last_name,
          course_id: null,
          year_level: null,
          section: null,
        });

        if (teacherUserError) throw teacherUserError;

        let emailNote = '';
        if (formData.email) {
          const emailData = generateStudentCredentialEmail(
            formData.first_name,
            formData.email,
            tempPassword,
            'teacher'
          );
          const sent = await sendEmail(formData.email, emailData.subject, emailData.html);
          emailNote = sent.success
            ? `Credentials sent to ${formData.email}.`
            : `Email could not be sent (${sent.error ?? 'unknown error'}). Share the password manually.`;
        }

        alert(
          `Teacher created successfully!\n\nLogin email: ${formData.email}\nTemporary password: ${tempPassword}\n\n${emailNote}`
        );
      } else {
        const course = courses.find(c => c.id === formData.course_id);
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

        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            email: formData.email,
            password_hash: passwordHash,
            role: 'student',
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

        const updatedStudents: any[] = [...(students as any[]), studentData];
        setStudents(updatedStudents);

        let emailNote = '';
        if (formData.email) {
          const emailData = generateStudentCredentialEmail(
            formData.first_name,
            username,
            tempPassword,
            'student'
          );
          const sent = await sendEmail(formData.email, emailData.subject, emailData.html);
          emailNote = sent.success
            ? `Credentials sent to ${formData.email}.`
            : `Email could not be sent (${sent.error ?? 'unknown error'}). Share the password manually.`;
        }

        alert(
          `Student created successfully!\n\nStudent ID: ${username}\nTemporary password: ${tempPassword}\n\n${emailNote}`
        );
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
            <i className="hgi-stroke hgi-close-circle text-lg" aria-hidden />
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <i className="hgi-stroke hgi-plus text-lg" aria-hidden />
                {`Create ${type === 'student' ? 'Student' : 'Teacher'}`}
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}