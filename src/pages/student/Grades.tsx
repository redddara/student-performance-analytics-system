import React, { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, Table, Badge, Select } from '../../components/ui';
import { 
  GraduationCap, 
  Filter,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const StudentGrades: React.FC = () => {
  const { user, subjects } = useStore();
  const [myGrades, setMyGrades] = useState<any[]>([]);
  const [semesterFilter, setSemesterFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyGrades();
  }, [user, subjects]);

  const fetchMyGrades = async () => {
    if (!user) return;
    setLoading(true);

    const { data: studentData } = await supabase
      .from('students')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (studentData) {
      const { data: grades } = await supabase
        .from('grades')
        .select('*, subject:subjects(*)')
        .eq('student_id', studentData.id)
        .order('created_at', { ascending: false });

      if (grades) setMyGrades(grades);
    }
    setLoading(false);
  };

  // Filter grades
  let filteredGrades = myGrades;
  if (semesterFilter !== 'all') {
    filteredGrades = myGrades.filter(g => g.semester === parseInt(semesterFilter));
  }

  // Calculate GWA
  const gwa = filteredGrades.length > 0
    ? filteredGrades.reduce((sum, g) => sum + Number(g.grade), 0) / filteredGrades.length
    : 0;

  const getGradeStatus = (grade: number) => {
    if (grade >= 90) return { label: 'Excellent', variant: 'success' as const };
    if (grade >= 85) return { label: 'Very Good', variant: 'success' as const };
    if (grade >= 80) return { label: 'Good', variant: 'info' as const };
    if (grade >= 75) return { label: 'Passing', variant: 'warning' as const };
    return { label: 'Failed', variant: 'danger' as const };
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-white">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">My Grades</h1>
          <p className="text-gray-400 mt-2">View your academic performance</p>
        </div>

        {/* GWA Summary */}
        <Card className="bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-indigo-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300">Overall GWA</p>
              <p className="text-5xl font-bold text-white mt-2">{gwa.toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-gray-400 text-sm">Total Subjects</p>
                <p className="text-2xl font-bold text-white">{filteredGrades.length}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Passing</p>
                <p className="text-2xl font-bold text-green-400">
                  {filteredGrades.filter(g => Number(g.grade) >= 75).length}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Filter */}
        <Card>
          <div className="flex items-center gap-4">
            <Filter size={20} className="text-gray-400" />
            <Select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Semesters' },
                { value: '1', label: 'First Semester' },
                { value: '2', label: 'Second Semester' }
              ]}
            />
          </div>
        </Card>

        {/* Grades Table */}
        <Card>
          <Table headers={['Subject', 'Grade', 'Quarter', 'Semester', 'Remarks', 'Status']}>
            {filteredGrades.map(grade => {
              const status = getGradeStatus(Number(grade.grade));
              return (
                <tr key={grade.id} className="hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-300">
                        <GraduationCap size={18} />
                      </div>
                      <span className="text-white font-medium">
                        {grade.subject?.name || 'Unknown'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-2xl font-bold text-white">{grade.grade}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400" />
                      Quarter {grade.quarter}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    Semester {grade.semester}
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {grade.remarks || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </Table>

          {filteredGrades.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <GraduationCap size={48} className="mx-auto mb-4 opacity-50" />
              <p>No grades recorded yet</p>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default StudentGrades;
