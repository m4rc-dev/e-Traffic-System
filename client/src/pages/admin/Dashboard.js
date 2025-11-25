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
  AreaChart,
  Area,
} from 'recharts';
import LoadingSpinner from '../../components/LoadingSpinner';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// Custom Peso Icon Component
const PesoIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <text x="12" y="18" fontSize="28" fontWeight="bold" textAnchor="middle" fill="currentColor" fontFamily="Arial, sans-serif">₱</text>
  </svg>
);

const StatCard = ({ title, value, icon: Icon, change, color = 'primary', subtitle }) => {
  const colorMap = {
    primary: {
      bg: 'bg-white',
      text: 'text-red-600',
      gradient: 'from-white to-white',
      border: 'border-gray-300',
      iconBg: 'bg-red-50'
    },
    success: {
      bg: 'bg-white',
      text: 'text-green-600',
      gradient: 'from-white to-white',
      border: 'border-gray-300',
      iconBg: 'bg-green-50'
    },
    info: {
      bg: 'bg-white',
      text: 'text-violet-600',
      gradient: 'from-white to-white',
      border: 'border-gray-300',
      iconBg: 'bg-violet-50'
    },
    warning: {
      bg: 'bg-white',
      text: 'text-amber-600',
      gradient: 'from-white to-white',
      border: 'border-gray-300',
      iconBg: 'bg-amber-50'
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


const AdminDashboard = () => {
  const navigate = useNavigate();
  
  const { data: dashboardResponse, isLoading, error } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: adminAPI.getDashboard,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Extract data from response (server wraps payload in data)
  const data = dashboardResponse?.data?.data;

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

  // Use real data from database - single source for both charts
  const monthlyData = data?.monthlyData || [];
  
  // Prepare violations trend data (counts and total fines issued)
  const trendData = monthlyData.map(item => ({
    month: item.month,
    violations: parseInt(item.totalViolations) || 0,
    fines: parseFloat(item.totalFines) || 0
  }));

  // Prepare fines collection trend data (collected vs total fines)
  const finesTrendData = monthlyData.map(item => ({
    month: item.month,
    collectedFines: parseFloat(item.collectedFines) || 0,
    totalFines: parseFloat(item.totalFines) || 0,
    paidViolations: parseInt(item.paidViolations) || 0,
    totalViolations: parseInt(item.totalViolations) || 0
  }));

  // Debug: Log the data to see what's available
  console.log('Dashboard Data:', data);
  console.log('Monthly Data from Backend:', monthlyData);
  console.log('Violations Trend Data:', trendData);
  console.log('Fines Collection Trend Data:', finesTrendData);

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
    <div className="space-y-6 sm:space-y-8 mobile-padding">
      {/* Page header */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl mobile-card border border-primary-100">
        <div className="max-w-4xl">
          <h1 className="responsive-text-3xl font-bold text-gray-900 mb-3">Dashboard Overview</h1>
          <p className="responsive-text-base text-gray-600 leading-relaxed">
            Real-time insights into traffic violations and system performance
          </p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-primary-600">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
              <span>Real-time data updates</span>
            </div>
            <span className="text-xs text-gray-500 hidden sm:inline">• Auto-refresh every 30 seconds</span>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mobile-stats-grid">
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
          icon={PesoIcon}
          color="warning"
          change={15}
          subtitle="This month"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-2">
        {/* Monthly violations chart - Modern Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-indigo-600" />
              Violations Trend
            </h4>
            <p className="text-sm text-gray-600 mt-1">Monthly violation patterns and trends</p>
              </div>
              {trendData.length > 0 && (
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                    <span className="text-gray-600">Violations</span>
                  </div>
                  {trendData.some(item => item.fines > 0) && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-gray-600">Fines</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="mobile-chart-container" style={{ minHeight: '300px' }}>
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={trendData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <defs>
                      <linearGradient id="colorViolations" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                        <stop offset="50%" stopColor="#6366f1" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorFines" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="50%" stopColor="#059669" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#047857" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke="#e2e8f0" 
                      strokeOpacity={0.6}
                    />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ 
                        fill: '#64748b', 
                        fontSize: 11,
                        fontWeight: 500
                      }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return date.toLocaleDateString('en-US', { 
                          month: 'short', 
                          year: '2-digit' 
                        });
                      }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ 
                        fill: '#64748b', 
                        fontSize: 11,
                        fontWeight: 500
                      }}
                      tickFormatter={(value) => value.toString()}
                    />
                    <Tooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                              <p className="font-semibold text-gray-900 mb-2">
                                {new Date(label).toLocaleDateString('en-US', { 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}
                              </p>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                                  <span className="text-sm text-gray-600">Violations:</span>
                                  <span className="font-semibold text-gray-900">
                                    {payload[0]?.value || 0}
                                  </span>
                                </div>
                                {payload[1] && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                    <span className="text-sm text-gray-600">Fines:</span>
                                    <span className="font-semibold text-gray-900">
                                      ₱{(payload[1]?.value || 0).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="violations" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      fill="url(#colorViolations)"
                      fillOpacity={0.6}
                      dot={{ 
                        fill: '#6366f1', 
                        strokeWidth: 2, 
                        stroke: '#ffffff',
                        r: 4
                      }}
                      activeDot={{ 
                        r: 6, 
                        stroke: '#6366f1', 
                        strokeWidth: 2,
                        fill: '#ffffff'
                      }}
                    />
                    {trendData.some(item => item.fines > 0) && (
                      <Area 
                        type="monotone" 
                        dataKey="fines" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        fill="url(#colorFines)"
                        fillOpacity={0.4}
                        dot={{ 
                          fill: '#10b981', 
                          strokeWidth: 2, 
                          stroke: '#ffffff',
                          r: 3
                        }}
                        activeDot={{ 
                          r: 5, 
                          stroke: '#10b981', 
                          strokeWidth: 2,
                          fill: '#ffffff'
                        }}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <div className="relative">
                      <svg className="mx-auto h-16 w-16 text-gray-300 mb-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                    </div>
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
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-blue-600" />
              Status Distribution
            </h4>
            <p className="text-sm text-gray-600 mt-1">Payment status breakdown</p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="mobile-chart-container">
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
                      labelStyle={{
                        fontSize: '12px',
                        fontWeight: '600',
                        fill: '#374151'
                      }}
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
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0];
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                              <p className="font-semibold text-gray-900">
                                {data.name}: {data.value}
                              </p>
                              <p className="text-sm text-gray-600">
                                {((data.value / statusData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}% of total
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
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
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-blue-50">
          <div className="flex items-center justify-between">
            <div>
          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
            Fines Collection Trend
          </h4>
          <p className="text-sm text-gray-600 mt-1">Monthly fine collection patterns</p>
            </div>
            {finesTrendData.length > 0 && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-gray-600">Collected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600">Total Fines</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 sm:p-6">
          <div className="mobile-chart-container" style={{ minHeight: '300px' }}>
            {finesTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={finesTrendData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="colorCollectedFines" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="50%" stopColor="#059669" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#047857" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorTotalFines" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="50%" stopColor="#2563eb" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke="#e2e8f0" 
                    strokeOpacity={0.6}
                  />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ 
                      fill: '#64748b', 
                      fontSize: 11,
                      fontWeight: 500
                    }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: '2-digit' 
                      });
                    }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ 
                      fill: '#64748b', 
                      fontSize: 11,
                      fontWeight: 500
                    }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200">
                            <p className="font-semibold text-gray-900 mb-2">
                              {new Date(label).toLocaleDateString('en-US', { 
                                month: 'long', 
                                year: 'numeric' 
                              })}
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                <span className="text-sm text-gray-600">Collected:</span>
                                <span className="font-semibold text-gray-900">
                                  ₱{(payload[0]?.value || 0).toLocaleString()}
                                </span>
                              </div>
                              {payload[1] && (
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                  <span className="text-sm text-gray-600">Total Fines:</span>
                                  <span className="font-semibold text-gray-900">
                                    ₱{(payload[1]?.value || 0).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              <div className="pt-2 border-t border-gray-100">
                                <div className="text-xs text-gray-500">
                                  Collection Rate: {payload[0]?.value && payload[1]?.value ? 
                                    ((payload[0].value / payload[1].value) * 100).toFixed(1) : 0}%
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="collectedFines" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fill="url(#colorCollectedFines)"
                    fillOpacity={0.6}
                    dot={{ 
                      fill: '#10b981', 
                      strokeWidth: 2, 
                      stroke: '#ffffff',
                      r: 4
                    }}
                    activeDot={{ 
                      r: 6, 
                      stroke: '#10b981', 
                      strokeWidth: 2,
                      fill: '#ffffff'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalFines" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fill="url(#colorTotalFines)"
                    fillOpacity={0.3}
                    dot={{ 
                      fill: '#3b82f6', 
                      strokeWidth: 2, 
                      stroke: '#ffffff',
                      r: 3
                    }}
                    activeDot={{ 
                      r: 5, 
                      stroke: '#3b82f6', 
                      strokeWidth: 2,
                      fill: '#ffffff'
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="relative">
                    <svg className="mx-auto h-16 w-16 text-gray-300 mb-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                  </div>
                  <p className="text-lg font-medium text-gray-900 mb-2">No Collection Data</p>
                  <p className="text-sm text-gray-500">Fine collection trends will appear here once payments are recorded</p>
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
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="responsive-text-xl font-bold text-gray-900">Recent Violations</h3>
            <button 
              onClick={() => navigate('/violations')}
              className="text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-colors duration-200 hover:underline px-3 py-1 rounded-md hover:bg-indigo-50"
            >
              View All →
            </button>
          </div>
          <div className="mobile-table-container">
            <table className="mobile-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="mobile-table th">
                    Violation #
                  </th>
                  <th className="mobile-table th">
                    Violator
                  </th>
                  <th className="mobile-table th">
                    Type
                  </th>
                  <th className="mobile-table th">
                    Fine
                  </th>
                  <th className="mobile-table th">
                    Status
                  </th>
                  <th className="mobile-table th">
                    Enforcer
                  </th>
                  <th className="mobile-table th">
                    Location
                  </th>
                  <th className="mobile-table th">
                    Date & Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.recentViolations?.map((violation) => (
                  <tr key={violation.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="mobile-table td">
                      <span className="responsive-text-sm font-semibold text-gray-900">
                        {violation.violation_number}
                      </span>
                    </td>
                    <td className="mobile-table td">
                      <div className="responsive-text-sm font-medium text-gray-900">{violation.violator_name}</div>
                      {violation.violator_license && (
                        <div className="text-xs text-blue-600 font-mono mt-1">
                          License: {violation.violator_license}
                        </div>
                      )}
                      {violation.is_repeat_offender && (
                        <div className="flex items-center mt-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            🔁 Repeat ({violation.previous_violations_count + 1})
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="mobile-table td">
                      <span className="responsive-text-sm text-gray-900">{violation.violation_type}</span>
                    </td>
                    <td className="mobile-table td">
                      <span className="responsive-text-sm font-semibold text-gray-900">
                        ₱{violation.fine_amount?.toLocaleString()}
                      </span>
                    </td>
                    <td className="mobile-table td">
                      <StatusBadge status={violation.status} />
                    </td>
                    <td className="mobile-table td">
                      <div className="responsive-text-sm text-gray-900">{violation.enforcer_name}</div>
                      <div className="text-xs text-gray-500">{violation.enforcer_badge}</div>
                    </td>
                    <td className="mobile-table td">
                      <div className="responsive-text-sm text-gray-900">{violation.location}</div>
                    </td>
                    <td className="mobile-table td">
                      <div>
                        <div className="responsive-text-sm font-medium text-gray-900">
                          {new Date(violation.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(violation.created_at).toLocaleTimeString()}
                        </div>
                      </div>
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
