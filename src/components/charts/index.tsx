import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend
} from 'recharts';

const COLORS = ['#d4a500', '#df4444', '#ffd000', '#8c1818', '#b31b1b'];

interface ChartProps {
  data: any[];
  dataKey?: string;
  xAxisKey?: string;
}

export const GradeDistributionChart: React.FC<ChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="range" stroke="#9CA3AF" fontSize={12} />
        <YAxis stroke="#9CA3AF" fontSize={12} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid rgba(212, 165, 0, 0.3)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Bar dataKey="count" fill="#d4a500" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const PerformanceTrendChart: React.FC<ChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorGrade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#df4444" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#df4444" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
        <YAxis stroke="#9CA3AF" fontSize={12} domain={[60, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid rgba(212, 165, 0, 0.3)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Area
          type="monotone"
          dataKey="avgGrade"
          stroke="#df4444"
          fillOpacity={1}
          fill="url(#colorGrade)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const PassingRateChart: React.FC<{ passingRate: number; failingRate: number }> = ({ passingRate, failingRate }) => {
  const chartData = [
    { name: 'Passing', value: passingRate },
    { name: 'Failing', value: failingRate }
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={5}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}%`}
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid rgba(212, 165, 0, 0.3)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

interface StudentProgressChartProps {
  data: { subject: string; grade: number; semester: number }[];
}

export const StudentProgressChart: React.FC<StudentProgressChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="subject" stroke="#9CA3AF" fontSize={12} />
        <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid rgba(212, 165, 0, 0.3)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="grade"
          stroke="#d4a500"
          strokeWidth={2}
          dot={{ fill: '#d4a500', strokeWidth: 2 }}
          name="Grade"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

interface SubjectComparisonChartProps {
  data: { subject: string; avgGrade: number; studentCount: number }[];
}

export const SubjectComparisonChart: React.FC<SubjectComparisonChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="subject" stroke="#9CA3AF" fontSize={12} />
        <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid rgba(212, 165, 0, 0.3)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Bar dataKey="avgGrade" fill="#df4444" radius={[8, 8, 0, 0]} name="Average Grade" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const QuarterlyPerformanceChart: React.FC<ChartProps> = ({ data }) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
        <XAxis dataKey="quarter" stroke="#9CA3AF" fontSize={12} />
        <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid rgba(212, 165, 0, 0.3)',
            borderRadius: '8px',
            color: '#fff'
          }}
        />
        <Legend />
        <Bar dataKey="avgGrade" fill="#d4a500" radius={[8, 8, 0, 0]} name="Average Grade" />
      </BarChart>
    </ResponsiveContainer>
  );
};
