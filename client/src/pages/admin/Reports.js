import React, { useState, useEffect, useCallback } from 'react';
import { reportsAPI } from '../../services/api';
import toast, { Toaster } from 'react-hot-toast';
import { 
  Download, 
  FileText, 
  Users, 
  TrendingUp, 
  Calendar,
  BarChart3,
  PieChart,
  Table,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const ReportCard = ({ title, description, icon: Icon, onClick, color = 'primary' }) => {
  // Define static background colors to avoid dynamic class compilation issues
  const backgroundColors = {
    primary: 'linear-gradient(135deg, #BFECFF 0%, #E6F7FF 100%)', // Light blue
    success: 'linear-gradient(135deg, #CDC1FF 0%, #E8DFFF 100%)', // Light purple
    warning: 'linear-gradient(135deg, #FFE4B5 0%, #FFF2D6 100%)', // Light peach
    info: 'linear-gradient(135deg, #D4EDDA 0%, #E9F7EF 100%)'      // Light green
  };
  
  const iconColors = {
    primary: '#3B82F6',   // Blue
    success: '#8B5CF6',  // Purple
    warning: '#F59E0B',  // Orange
    info: '#10B981'      // Green
  };

  return (
    <div 
      className="group relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer touch-target"
      onClick={onClick}
      style={{ background: backgroundColors[color] || backgroundColors.primary }}
    >
      {/* Content */}
      <div className="relative p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-3 sm:gap-4 lg:gap-6">
          {/* Icon container */}
          <div className="flex-shrink-0 p-2 sm:p-3 lg:p-4 rounded-2xl bg-white/20 backdrop-blur-sm group-hover:bg-white/30 transition-all duration-300 border border-white/30">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 transition-colors duration-300" style={{ color: iconColors[color] || iconColors.primary }} />
          </div>
          
          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h3 className="responsive-text-lg font-semibold text-gray-900 mb-2 sm:mb-3 group-hover:text-gray-800 transition-colors duration-300">
              {title}
            </h3>
            <p className="responsive-text-sm text-gray-700 leading-relaxed group-hover:text-gray-800 transition-colors duration-300">
              {description}
            </p>
          </div>
          
          {/* Arrow indicator */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <div className="p-1.5 sm:p-2 rounded-full bg-white/30 backdrop-blur-sm" style={{ color: iconColors[color] || iconColors.primary }}>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
        
        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" style={{ background: iconColors[color] || iconColors.primary }}></div>
      </div>
    </div>
  );
};

const DateRangePicker = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => (
  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end">
    <div className="flex-1 w-full">
      <label className="block responsive-text-sm font-medium text-gray-700 mb-1">Start Date</label>
      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="mobile-input w-full"
        max={endDate || undefined}
      />
    </div>
    <div className="flex-1 w-full">
      <label className="block responsive-text-sm font-medium text-gray-700 mb-1">End Date</label>
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="mobile-input w-full"
        min={startDate || undefined}
      />
    </div>
  </div>
);

const ExportButtons = ({ onExport, reportType, isLoading, hasData }) => (
  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
    <button
      onClick={() => onExport('json')}
      disabled={isLoading || !hasData}
      className="mobile-btn-secondary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
    >
      <FileText className="h-4 w-4" />
      <span className="hidden sm:inline">Export JSON</span>
      <span className="sm:hidden">JSON</span>
    </button>
    <button
      onClick={() => onExport('csv')}
      disabled={isLoading || !hasData}
      className="mobile-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Export CSV</span>
      <span className="sm:hidden">CSV</span>
    </button>
  </div>
);

const ViolationsReport = ({ filters, setFilters }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const generateReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      setError('Please select both start and end dates');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await reportsAPI.getViolationsReport({
        start_date: filters.startDate,
        end_date: filters.endDate
      });
      
      if (response.data.success) {
        setReportData(response.data.data);
        setLastRefresh(new Date());
      } else {
        setError('Failed to generate report');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      setError(error.response?.data?.error || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = (format) => {
    if (!reportData) return;
    
    if (format === 'json') {
      const dataStr = JSON.stringify(reportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `violations-report-${filters.startDate}-to-${filters.endDate}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      // Use server-side CSV export
      const params = new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        format: 'csv'
      });
      
      const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/reports/violations?${params}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `violations-report-${filters.startDate}-to-${filters.endDate}.csv`;
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Violations Report</h2>
          <p className="text-gray-600">Generate detailed reports on traffic violations</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live Data</span>
            <span>• Last updated: {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <button
            onClick={generateReport}
            disabled={isLoading}
            className="mobile-btn-secondary text-xs px-3 py-2 sm:py-1 flex items-center justify-center gap-1 w-full sm:w-auto"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <ExportButtons onExport={exportReport} reportType="violations" isLoading={isLoading} hasData={!!reportData} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end mb-4">
            <div className="flex-1">
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                onEndDateChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              />
            </div>
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="mobile-btn-primary w-full sm:w-auto"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Generate Report'}
            </button>
          </div>

          {reportData && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Violations</h4>
                    <div className="p-2 bg-blue-200 rounded-lg">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                </div>
                </div>
                  <p className="text-3xl font-bold text-blue-900">{reportData.summary?.total_violations || 0}</p>
                  <div className="mt-2 flex items-center text-sm text-blue-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Total recorded</span>
                </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide">Total Fines</h4>
                    <div className="p-2 bg-green-200 rounded-lg">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-900">₱{(reportData.summary?.total_fines || 0).toFixed(2)}</p>
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Amount issued</span>
                </div>
              </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-2xl border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Pending Fines</h4>
                    <div className="p-2 bg-yellow-200 rounded-lg">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                  </div>
                    </div>
                  <p className="text-3xl font-bold text-yellow-900">₱{(reportData.summary?.pending_fines || 0).toFixed(2)}</p>
                  <div className="mt-2 flex items-center text-sm text-yellow-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Awaiting payment</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Collection Rate</h4>
                    <div className="p-2 bg-purple-200 rounded-lg">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                  </div>
                    </div>
                  <p className="text-3xl font-bold text-purple-900">{reportData.summary?.collection_rate || 0}%</p>
                  <div className="mt-2 flex items-center text-sm text-purple-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Success rate</span>
                  </div>
                </div>
              </div>

              {/* Violations Table */}
              <div className="card">
                <div className="card-header">
                  <h4 className="text-lg font-medium">Violations Details</h4>
                </div>
                <div className="card-body p-0 sm:p-6">
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="mobile-table w-full">
                      <thead className="table-header">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Violation #</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Violator & License</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fine</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enforcer</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {reportData.violations.map((violation, index) => (
                          <tr key={index} className="table-row">
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-mono">{violation.violation_number}</td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">
                              <div>
                                <div>{violation.violator_name}</div>
                                {violation.violator_license && (
                                  <div className="text-xs text-blue-600 font-mono mt-1">
                                    License: {violation.violator_license}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{violation.vehicle_plate || '-'}</td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {violation.violation_type}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">₱{parseFloat(violation.fine_amount).toFixed(2)}</td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                violation.status === 'paid' ? 'bg-green-100 text-green-800' :
                                violation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {violation.status}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{violation.enforcer_name}</td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                              <div>
                                <div className="font-medium text-gray-900">
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
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EnforcersReport = ({ filters, setFilters }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const generateReport = async () => {
    if (!filters.startDate || !filters.endDate) {
      setError('Please select both start and end dates');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      console.log('Generating enforcers report with filters:', filters);
      const response = await reportsAPI.getEnforcersReport({
        start_date: filters.startDate,
        end_date: filters.endDate
      });
      
      console.log('Enforcers report response:', response);
      
      if (response.data.success) {
        setReportData(response.data.data);
        setLastRefresh(new Date());
        console.log('Enforcers report data set:', response.data.data);
      } else {
        setError('Failed to generate report');
      }
    } catch (error) {
      console.error('Failed to generate enforcers report:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      
      if (error.response?.status === 500) {
        setError('Server error: Database connection or query failed');
      } else if (error.response?.status === 404) {
        setError('Report endpoint not found');
      } else if (error.response?.status === 401) {
        setError('Authentication failed. Please login again.');
      } else if (error.code === 'ERR_NETWORK') {
        setError('Network error: Cannot connect to server');
      } else {
        setError(error.response?.data?.error || error.message || 'Failed to generate report');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = (format) => {
    if (!reportData) return;
    
    if (format === 'json') {
      const dataStr = JSON.stringify(reportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `enforcers-report-${filters.startDate}-to-${filters.endDate}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === 'csv') {
      const params = new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        format: 'csv'
      });
      
      const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/reports/enforcers?${params}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `enforcers-report-${filters.startDate}-to-${filters.endDate}.csv`;
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Enforcers Performance Report</h2>
          <p className="text-gray-600">Track enforcer productivity and performance metrics</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live Data</span>
            <span>• Last updated: {lastRefresh.toLocaleTimeString()}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
          <button
            onClick={generateReport}
            disabled={isLoading}
            className="mobile-btn-secondary text-xs px-3 py-2 sm:py-1 flex items-center justify-center gap-1 w-full sm:w-auto"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <ExportButtons onExport={exportReport} reportType="enforcers" isLoading={isLoading} hasData={!!reportData} />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end mb-4">
            <div className="flex-1">
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                onEndDateChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              />
            </div>
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="mobile-btn-primary w-full sm:w-auto"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Generate Report'}
            </button>
          </div>

          {reportData && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Enforcers</h4>
                    <div className="p-2 bg-blue-200 rounded-lg">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-blue-900">{reportData.summary?.total_enforcers || 0}</p>
                  <div className="mt-2 flex items-center text-sm text-blue-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Active personnel</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide">Total Violations</h4>
                    <div className="p-2 bg-green-200 rounded-lg">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-900">{reportData.summary?.total_violations || 0}</p>
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Total recorded</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-2xl border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Total Fines</h4>
                    <div className="p-2 bg-yellow-200 rounded-lg">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-yellow-900">₱{(reportData.summary?.total_fines || 0).toFixed(2)}</p>
                  <div className="mt-2 flex items-center text-sm text-yellow-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Amount issued</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Collection Rate</h4>
                    <div className="p-2 bg-purple-200 rounded-lg">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-purple-900">{reportData.summary?.avg_collection_rate || 0}%</p>
                  <div className="mt-2 flex items-center text-sm text-purple-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Success rate</span>
                  </div>
                </div>
              </div>

              {/* Check if there are enforcers with data */}
              {(!reportData.enforcers || reportData.enforcers.length === 0) ? (
                <div className="text-center py-12">
                  <div className="text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Enforcer Data Found</h3>
                    <p className="text-gray-500 mb-4">
                      {reportData.message || 'No enforcers found for the selected date range, or no violations have been recorded yet.'}
                    </p>
                    <div className="text-sm text-gray-400">
                      <p>• Try selecting a different date range</p>
                      <p>• Check if there are any enforcers in the system</p>
                      <p>• Verify that violations exist for the selected period</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Performance Chart */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary-600" />
                        Enforcer Performance Comparison
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">Visual comparison of violations issued and fines collected</p>
                    </div>
                    <div className="p-4 sm:p-6">
                      <div className="mobile-chart-container">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={reportData.enforcers}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="full_name" 
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              axisLine={{ stroke: '#e2e8f0' }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis 
                              tick={{ fontSize: 10, fill: '#64748b' }}
                              axisLine={{ stroke: '#e2e8f0' }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                fontSize: '12px'
                              }}
                            />
                            <Bar 
                              dataKey="total_violations" 
                              fill="#3b82f6" 
                              name="Violations Issued"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar 
                              dataKey="collected_fines" 
                              fill="#10b981" 
                              name="Fines Collected"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Performance Table */}
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                      <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Table className="h-5 w-5 text-primary-600" />
                        Detailed Performance
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">Comprehensive breakdown of individual enforcer metrics</p>
                    </div>
                    <div className="overflow-x-auto -mx-4 sm:mx-0">
                      <table className="mobile-table w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Enforcer
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Badge #
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Violations
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Total Fines
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Collected
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Collection Rate
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              Today
                            </th>
                            <th className="px-3 sm:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                              This Month
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {reportData.enforcers.map((enforcer, index) => (
                            <tr key={index} className="hover:bg-gray-50 transition-colors duration-150">
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8">
                                    <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                                      <span className="text-xs sm:text-sm font-medium text-primary-700">
                                        {enforcer.full_name?.charAt(0) || 'U'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-2 sm:ml-3">
                                    <div className="text-xs sm:text-sm font-medium text-gray-900">{enforcer.full_name || 'Unknown'}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 font-mono">
                                  {enforcer.badge_number || '-'}
                                </span>
                              </td>
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">
                                {enforcer.total_violations || 0}
                              </td>
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">
                                ₱{(enforcer.total_fines || 0).toFixed(2)}
                              </td>
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">
                                ₱{(enforcer.collected_fines || 0).toFixed(2)}
                              </td>
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-xs font-semibold ${
                                  (enforcer.collection_rate || 0) >= 80 ? 'bg-green-100 text-green-800' :
                                  (enforcer.collection_rate || 0) >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {(enforcer.collection_rate || 0).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                                {enforcer.today_violations || 0}
                              </td>
                              <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                                {enforcer.month_violations || 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DailySummaryReport = ({ filters, setFilters }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const generateReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reportsAPI.getDailySummary({
        date: filters.date || new Date().toISOString().split('T')[0]
      });
      
      if (response.data.success) {
        setReportData(response.data.data);
      } else {
        setError('Failed to generate report');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      setError(error.response?.data?.error || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Summary Report</h2>
          <p className="text-gray-600">Quick overview of daily activities and key metrics</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end mb-4">
            <div className="flex-1">
              <label className="block responsive-text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={filters.date || new Date().toISOString().split('T')[0]}
                onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                className="mobile-input w-full"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="mobile-btn-primary w-full sm:w-auto"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Generate Report'}
            </button>
          </div>

          {reportData && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Violations</h4>
                    <div className="p-2 bg-blue-200 rounded-lg">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-blue-900">{reportData.summary.total_violations}</p>
                  <div className="mt-2 flex items-center text-sm text-blue-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Total recorded</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide">Total Fines</h4>
                    <div className="p-2 bg-green-200 rounded-lg">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-900">₱{reportData.summary.total_fines.toFixed(2)}</p>
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Amount issued</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-2xl border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Active Enforcers</h4>
                    <div className="p-2 bg-yellow-200 rounded-lg">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-yellow-900">{reportData.summary.active_enforcers}</p>
                  <div className="mt-2 flex items-center text-sm text-yellow-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>On duty today</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Avg per Enforcer</h4>
                    <div className="p-2 bg-purple-200 rounded-lg">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-purple-900">{reportData.summary.avg_violations_per_enforcer}</p>
                  <div className="mt-2 flex items-center text-sm text-purple-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Per person</span>
                  </div>
                </div>
              </div>

                            {/* Violations by Type Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-primary-600" />
                      Violations by Type
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">Distribution of violation categories</p>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="mobile-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={reportData.violations_by_type}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ violation_type, count }) => `${violation_type}: ${count}`}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {reportData.violations_by_type.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              fontSize: '12px'
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary-600" />
                      Enforcer Activity
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">Individual enforcer performance</p>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="mobile-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.violations_by_enforcer}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="full_name" 
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              fontSize: '12px'
                            }}
                          />
                          <Bar 
                            dataKey="violations_count" 
                            fill="#3b82f6" 
                            name="Violations"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Violations */}
              <div className="card">
                <div className="card-header">
                  <h4 className="text-lg font-medium">Recent Violations</h4>
                </div>
                <div className="card-body p-0 sm:p-6">
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <table className="mobile-table w-full">
                      <thead className="table-header">
                        <tr>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Violator & License</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fine</th>
                          <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enforcer</th>
                        </tr>
                      </thead>
                      <tbody className="table-body">
                        {reportData.recent_violations.map((violation, index) => (
                          <tr key={index} className="table-row">
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                              {new Date(violation.created_at).toLocaleTimeString()}
                            </td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">
                              <div>
                                <div>{violation.violator_name}</div>
                                {violation.violator_license && (
                                  <div className="text-xs text-blue-600 font-mono mt-1">
                                    License: {violation.violator_license}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {violation.violation_type}
                              </span>
                            </td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">₱{parseFloat(violation.fine_amount).toFixed(2)}</td>
                            <td className="px-3 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{violation.enforcer_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MonthlyReport = ({ filters, setFilters }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);

  const generateReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reportsAPI.getMonthlyReport({
        year: filters.year || new Date().getFullYear(),
        month: filters.month || new Date().getMonth() + 1
      });
      
      if (response.data.success) {
        setReportData(response.data.data);
      } else {
        setError('Failed to generate report');
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
      setError(error.response?.data?.error || 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Monthly Analysis Report</h2>
          <p className="text-gray-600">Monthly trends and comparative analysis</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end mb-4">
            <div className="flex-1">
              <label className="block responsive-text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={filters.year || new Date().getFullYear()}
                onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                className="mobile-select w-full"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block responsive-text-sm font-medium text-gray-700 mb-1">Month</label>
              <select
                value={filters.month || new Date().getMonth() + 1}
                onChange={(e) => setFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                className="mobile-select w-full"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <option key={month} value={month}>
                    {new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={generateReport}
              disabled={isLoading}
              className="mobile-btn-primary w-full sm:w-auto"
            >
              {isLoading ? <LoadingSpinner size="sm" /> : 'Generate Report'}
            </button>
          </div>

          {reportData && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Total Violations</h4>
                    <div className="p-2 bg-blue-200 rounded-lg">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-blue-900">{reportData.summary.total_violations}</p>
                  <div className="mt-2 flex items-center text-sm text-blue-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Total recorded</span>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide">Total Fines</h4>
                    <div className="p-2 bg-green-200 rounded-lg">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-green-900">₱{reportData.summary.total_fines.toFixed(2)}</p>
                  <div className="mt-2 flex items-center text-sm text-green-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Amount issued</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-2xl border border-yellow-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide">Paid Fines</h4>
                    <div className="p-2 bg-yellow-200 rounded-lg">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-yellow-900">₱{reportData.summary.paid_fines.toFixed(2)}</p>
                  <div className="mt-2 flex items-center text-sm text-yellow-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Successfully collected</span>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Collection Rate</h4>
                    <div className="p-2 bg-purple-200 rounded-lg">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-purple-900">{reportData.summary.collection_rate}%</p>
                  <div className="mt-2 flex items-center text-sm text-purple-600">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span>Success rate</span>
                  </div>
                </div>
              </div>

              {/* Daily Trend Chart */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                  <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary-600" />
                    Daily Violations Trend - {reportData.month_name}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">Daily violation patterns throughout the month</p>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="mobile-chart-container">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={reportData.daily_breakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis 
                          tick={{ fontSize: 10, fill: '#64748b' }}
                          axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            fontSize: '12px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="violations_count" 
                          stroke="#3b82f6" 
                          fill="#3b82f6" 
                          fillOpacity={0.3} 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-primary-600" />
                      Violations by Status
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">Payment status distribution</p>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="mobile-chart-container">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPieChart>
                          <Pie
                            data={reportData.violations_by_status}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ status, count }) => `${status}: ${count}`}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="count"
                          >
                            {reportData.violations_by_status.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              fontSize: '12px'
                            }}
                          />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-gray-100">
                    <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Table className="h-5 w-5 text-primary-600" />
                      Monthly Summary
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">Key performance indicators</p>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200 gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-blue-700 uppercase tracking-wide">Average Daily Violations</span>
                        <span className="text-xl sm:text-2xl font-bold text-blue-900">{reportData.summary.avg_daily_violations}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200 gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-green-700 uppercase tracking-wide">Days with Violations</span>
                        <span className="text-xl sm:text-2xl font-bold text-green-900">{reportData.daily_breakdown.filter(d => d.violations_count > 0).length}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200 gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-purple-700 uppercase tracking-wide">Peak Day</span>
                        <span className="text-lg sm:text-2xl font-bold text-purple-900">
                          {reportData.daily_breakdown.reduce((max, day) => 
                            day.violations_count > max.violations_count ? day : max
                          , { violations_count: 0 }).date}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Reports = () => {
  const [activeReport, setActiveReport] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    date: new Date().toISOString().split('T')[0],
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);

  const reportTypes = [
    {
      id: 'violations',
      title: 'Violations Report',
      description: 'Comprehensive analysis of traffic violations with trends and statistics',
      icon: FileText,
      color: 'primary'
    },
    {
      id: 'enforcers',
      title: 'Enforcers Performance',
      description: 'Track enforcer productivity and performance metrics',
      icon: Users,
      color: 'success'
    },
    {
      id: 'daily-summary',
      title: 'Daily Summary',
      description: 'Quick overview of daily activities and key metrics',
      icon: Calendar,
      color: 'warning'
    },
    {
      id: 'monthly',
      title: 'Monthly Analysis',
      description: 'Monthly trends and comparative analysis',
      icon: TrendingUp,
      color: 'info'
    }
  ];

  const handleReportSelect = (reportType) => {
    setActiveReport(reportType);
    // Set default date range to last 30 days for date-based reports
    if (reportType === 'violations' || reportType === 'enforcers') {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setFilters(prev => ({ ...prev, startDate, endDate }));
    }
  };

  // Auto-refresh function
  const refreshData = useCallback(() => {
    setLastUpdate(new Date());
    toast.success('Data refreshed successfully!', { duration: 2000 });
    // Force re-render of active report
    if (activeReport) {
      // This will trigger the report components to refresh their data
      const currentReport = activeReport;
      setActiveReport(null);
      setTimeout(() => setActiveReport(currentReport), 100);
    }
  }, [activeReport]);

  // Auto-refresh effect
  useEffect(() => {
    if (!isAutoRefresh) return;

    const interval = setInterval(() => {
      refreshData();
      // Check for new violations and show notification
      toast.success('🔄 Auto-refreshing data...', { duration: 1500 });
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isAutoRefresh, refreshData]);

  const renderActiveReport = () => {
    switch (activeReport) {
      case 'violations':
        return <ViolationsReport filters={filters} setFilters={setFilters} />;
      case 'enforcers':
        return <EnforcersReport filters={filters} setFilters={setFilters} />;
      case 'daily-summary':
        return <DailySummaryReport filters={filters} setFilters={setFilters} />;
      case 'monthly':
        return <MonthlyReport filters={filters} setFilters={setFilters} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 mobile-padding">
      <Toaster position="top-right" />
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-2xl mobile-card border border-primary-100">
        <div className="max-w-4xl">
          <h1 className="responsive-text-3xl font-bold text-gray-900 mb-3">Reports & Analytics</h1>
          <p className="responsive-text-base text-gray-600 leading-relaxed">
            Generate comprehensive reports and analyze system performance with detailed insights and visualizations
          </p>
          <div className="mt-4 space-y-3 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-primary-600">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                  <span>Real-time data updates</span>
                </div>
                <span className="text-xs text-gray-500 hidden sm:inline">• Last updated: {lastUpdate.toLocaleTimeString()}</span>
                <span className="text-xs text-green-600">• Auto-refresh: {isAutoRefresh ? 'ON' : 'OFF'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={refreshData}
                  className="mobile-btn-secondary text-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">Refresh Now</span>
                  <span className="sm:hidden">Refresh</span>
                </button>
                <label className="flex items-center justify-center sm:justify-start gap-2 text-sm text-gray-600 w-full sm:w-auto">
                  <input
                    type="checkbox"
                    checked={isAutoRefresh}
                    onChange={(e) => setIsAutoRefresh(e.target.checked)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="hidden sm:inline">Auto-refresh</span>
                  <span className="sm:hidden">Auto</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!activeReport ? (
        /* Report Selection Grid */
        <div className="space-y-6">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="responsive-text-2xl font-semibold text-gray-800 mb-2">Choose Your Report Type</h2>
            <p className="responsive-text-sm text-gray-500">Select from our comprehensive suite of analytical reports</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {reportTypes.map((report) => (
            <ReportCard
              key={report.id}
              title={report.title}
              description={report.description}
              icon={report.icon}
              color={report.color}
              onClick={() => handleReportSelect(report.id)}
            />
          ))}
          </div>
        </div>
      ) : (
        /* Active Report View */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-xl mobile-card shadow-sm border border-gray-100 gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <button
              onClick={() => setActiveReport(null)}
                className="mobile-btn-secondary flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors w-full sm:w-auto"
            >
                <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Reports</span>
              <span className="sm:hidden">Back</span>
            </button>
              <div className="hidden sm:block h-6 w-px bg-gray-200"></div>
              <div className="text-center sm:text-left">
                <h2 className="responsive-text-xl font-semibold text-gray-900">
                  {reportTypes.find(r => r.id === activeReport)?.title}
                </h2>
                <p className="responsive-text-sm text-gray-500">
                  {reportTypes.find(r => r.id === activeReport)?.description}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live Data</span>
              <span className="text-xs hidden sm:inline">• Updated: {lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
          {renderActiveReport()}
        </div>
      )}
    </div>
  );
};

export default Reports;
