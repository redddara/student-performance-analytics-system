import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { DashboardLayout } from '../../components/layouts';
import { Card, StatCard, Button, Input, Select, Modal, Table, Badge } from '../../components/ui';
import { GradeDistributionChart, PassingRateChart, PerformanceTrendChart } from '../../components/charts';
import { 
  Users, 
  BookOpen, 
  GraduationCap, 
  TrendingUp, 
  Plus, 
  Search,
  UserPlus,
  Trash2,
  Edit,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { analytics, courses, subjects, students, grades, fetchAnalytics } = useStore();

  useEffect(() => {
    fetchAnalytics();
  }, [students, grades, subjects, courses]);

  const mockPerformanceTrend = [
    { month: 'Jan', avgGrade: 78 },
    { month: 'Feb', avgGrade: 80 },
    { month: 'Mar', avgGrade: 82 },
    { month: 'Apr', avgGrade: 79 },
    { month: 'May', avgGrade: 85 },
    { month: 'Jun', avgGrade: 87 },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
<h1 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-gold-400 via-yellow-300 to-gold-500 bg-clip-text text-transparent leading-tight">Admin Dashboard</h1>
          <p className="text-gray-400 mt-2">Overview of the academic performance system</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          <StatCard
            title="Total Students"
            value={students.length}
            icon={<GraduationCap size={24} />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Total Teachers"
            value={analytics?.totalTeachers || 0}
            icon={<Users size={24} />}
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Total Courses"
            value={courses.length}
            icon={<BookOpen size={24} />}
          />
          <StatCard
            title="Average GWA"
            value={analytics?.averageGWA?.toFixed(2) || '0.00'}
            icon={<TrendingUp size={24} />}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Grade Distribution</h3>
            <GradeDistributionChart data={analytics?.gradeDistribution || []} />
          </Card>

          <Card>
            <h3 className="text-xl font-semibold text-white mb-4">Passing Rate</h3>
            <PassingRateChart passingRate={analytics?.passingRate || 0} failingRate={analytics?.failingRate || 0} />
          </Card>
        </div>

        {/* Performance Trend */}
        <Card>
          <h3 className="text-xl font-semibold text-white mb-4">Performance Trend</h3>
          <PerformanceTrendChart data={mockPerformanceTrend} />
        </Card>

        {/* Quick Actions */}
        <Card>
          <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="flex items-center justify-center gap-2" onClick={() => navigate('/admin/users')}>
              <UserPlus size={18} />
              Add User
            </Button>
            <Button variant="secondary" className="flex items-center justify-center gap-2" onClick={() => navigate('/admin/courses')}>
              <Plus size={18} />
              Create Course
            </Button>
            <Button variant="secondary" className="flex items-center justify-center gap-2" onClick={() => navigate('/admin/subjects')}>
              <BookOpen size={18} />
              Add Subject
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
