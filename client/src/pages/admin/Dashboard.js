import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../../services/api';
import {
  Users,
  FileText,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import LoadingSpinner from '../../components/LoadingSpinner';

const COLORS = ['#A7C7E7', '#D8B4FE', '#FED7AA', '#BBF7D0', '#C7D2FE', '#FECACA', '#A5F3FC', '#D9F99D'];

const StatCard = ({ title, value, icon: Icon, change, color = 'primary', subtitle }) => {
  const colorMap = {
    primary: {
      bg: 'bg-red-200',
      text: 'text-red-600',
      gradient: 'from-red-50 to-red-100',
      border: 'border-red-200',
      iconBg: 'bg-red-100'
    },
    success: {
      bg: 'bg-green-200',
      text: 'text-green-600',
      gradient: 'from-green-50 to-green-100',
      border: 'border-green-200',
      iconBg: 'bg-green-100'
    },
    info: {
      bg: 'bg-violet-200',
      text: 'text-violet-600',
      gradient: 'from-violet-50 to-violet-100',
      border: 'border-violet-200',
      iconBg: 'bg-violet-100'
    },
    warning: {
      bg: 'bg-amber-200',
      text: 'text-amber-600',
      gradient: 'from-amber-50 to-amber-100',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100'
    }
  };

  const colors = colorMap[color] || colorMap.primary;

  return (
    <div className={`bg-gradient-to-br ${colors.gradient} rounded-2xl border ${colors.border} shadow-sm hover:shadow-md transition-all duration-300 p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">{title}</h4>
          <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
          {subtitle && (
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>{subtitle}</span>
            </div>
          )}
        </div>
        <div className={`p-3 ${colors.iconBg} rounded-xl flex-shrink-0`}>
          <Icon className={`h-6 w-6 ${colors.text}`} />
        </div>
      </div>
      {change !== undefined && (
        <div className="flex items-center pt-2 border-t border-gray-200">
          {change > 0 ? (
            <TrendingUp className="h-4 w-4 text-green-500 mr-2" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500 mr-2" />
          )}
          <span className={`text-sm font-semibold ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          <span className="text-sm text-gray-500 ml-2">from last month</span>
        </div>
      )}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: 'warning', icon: Clock, text: 'Pending', bg: 'bg-amber-100 text-amber-800' },
    issued: { color: 'info', icon: AlertTriangle, text: 'Issued', bg: 'bg-blue-100 text-blue-800' },
    paid: { color: 'success', icon: CheckCircle, text: 'Paid', bg: 'bg-green-100 text-green-800' },
    disputed: { color: 'danger', icon: XCircle, text: 'Disputed', bg: 'bg-red-100 text-red-800' },
    cancelled: { color: 'secondary', icon: XCircle, text: 'Cancelled', bg: 'bg-gray-100 text-gray-800' },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span className={`${config.bg} inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`}>
      <Icon className="h-3 w-3 mr-1.5" />
      {config.text}
    </span>
  );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  const { data: dashboardResponse, isLoading, error } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: adminAPI.getDashboard,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Extract data from response (server wraps payload in data)
  const data = dashboardResponse?.data?.data;

  // Debug: Log the data to see what's available
  console.log('Dashboard Data:', data);
  console.log('Dashboard Response:', dashboardResponse);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load dashboard data</p>
      </div>
    );
  }

  // Prepare chart data
  const statusData = data?.violationsByStatus?.map(item => ({
    name: item.status,
    value: item.count,
  })) || [];

  // Use real data from database or show empty state
  const trendData = data?.violationsByMonth?.map(item => ({
    month: item.month,
    violations: item.count,
    fines: item.totalFines || 0
  })) || [];

  // Calculate total fines from violations data if totalFines is not available
  const totalFines = data?.totalFines || data?.recentViolations?.reduce((sum, violation) => {
    return sum + (parseFloat(violation.fine_amount) || 0);
  }, 0) || 0;

  // Format fines properly to avoid leading zeros
  const formatFines = (amount) => {
    // Ensure amount is a number
    const numAmount = parseFloat(amount) || 0;
    if (numAmount === 0) return '₱0.00';
    return `₱${numAmount.toFixed(2)}`;
  };

  return (
    <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
      {/* Page header */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl p-8 border border-primary-100">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Dashboard Overview</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Real-time insights into traffic violations and system performance
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-primary-600">
            <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
            <span>Real-time data updates</span>
            <span className="text-xs text-gray-500">• Auto-refresh every 30 seconds</span>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Violations"
          value={data?.totalViolations || 0}
          icon={FileText}
          color="primary"
          change={12}
          subtitle="This month"
        />
        <StatCard
          title="Active Enforcers"
          value={data?.activeEnforcers || 0}
          icon={Users}
          color="success"
          change={8}
          subtitle="On duty today"
        />
        <StatCard
          title="Total Enforcers"
          value={data?.totalEnforcers || 0}
          icon={Users}
          color="info"
          subtitle="Registered personnel"
        />
        <StatCard
          title="Total Fines Collected"
          value={formatFines(totalFines)}
          icon={DollarSign}
          color="warning"
          change={15}
          subtitle="This month"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Monthly violations chart - Modern Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Violations Trend
            </h4>
            <p className="text-sm text-gray-600 mt-1">Monthly violation patterns and trends</p>
          </div>
          <div className="p-6">
            <div className="h-80">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="violations" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      fill="url(#colorViolations)"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">No Data Available</p>
                    <p className="text-sm text-gray-500">Violation trends will appear here once more data is recorded</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status distribution chart - Modern Pie Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary-600" />
              Status Distribution
            </h4>
            <p className="text-sm text-gray-600 mt-1">Payment status breakdown</p>
          </div>
          <div className="p-6">
            <div className="h-80">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    <p className="text-lg font-medium text-gray-900 mb-2">No Status Data</p>
                    <p className="text-sm text-gray-500">Status distribution will appear here once violations are recorded</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Chart - Fines Trend */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary-600" />
            Fines Collection Trend
          </h4>
          <p className="text-sm text-gray-600 mt-1">Monthly fine collection patterns</p>
        </div>
        <div className="p-6">
          <div className="h-80">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    content={<CustomTooltip />}
                    formatter={(value) => [`₱${value.toLocaleString()}`, 'Fines']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="fines" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <p className="text-lg font-medium text-gray-900 mb-2">No Fines Data</p>
                  <p className="text-sm text-gray-500">Fine collection trends will appear here once more violations are recorded</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent violations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            Recent Violations
          </h4>
          <p className="text-sm text-gray-600 mt-1">Latest traffic violation records</p>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Recent Violations</h3>
            <button 
              onClick={() => navigate('/violations')}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors duration-200 hover:underline"
            >
              View All →
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Violation #
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Violator
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fine
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Enforcer
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.recentViolations?.map((violation) => (
                  <tr key={violation.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {violation.violation_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{violation.violator_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{violation.violation_type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">
                        ₱{violation.fine_amount?.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={violation.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{violation.enforcer_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {new Date(violation.created_at).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data?.recentViolations || data.recentViolations.length === 0) && (
              <div className="text-center py-12 text-gray-500">
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No recent violations</h3>
                <p className="text-gray-500">Violations will appear here once they are recorded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
