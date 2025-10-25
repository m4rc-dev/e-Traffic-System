import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../services/api';
import { AlertTriangle, Users, TrendingUp, DollarSign, Shield, Clock, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const RepeatOffenders = () => {
  const [filters, setFilters] = useState({
    min_violations: 2,
    limit: 20
  });

  const { data: repeatOffendersResponse, isLoading, error } = useQuery({
    queryKey: ['repeatOffenders', filters],
    queryFn: () => adminAPI.getRepeatOffenders(filters),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const data = repeatOffendersResponse?.data?.data;

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
        <p className="text-red-600">Failed to load repeat offenders data</p>
      </div>
    );
  }

  const repeatOffenders = data?.repeatOffenders || [];
  const statistics = data?.statistics || {};

  return (
    <div className="space-y-6 sm:space-y-8 mobile-padding">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 border border-red-200 rounded-3xl p-6 sm:p-8 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-orange-500/5"></div>
        <div className="relative">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                Repeat Offenders
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Monitor and track violators with multiple offenses</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="group bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Repeat Offenders</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {statistics.total_repeat_offenders || 0}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="group bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Violations per Offender</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {statistics.avg_violations_per_offender ? 
                    parseFloat(statistics.avg_violations_per_offender).toFixed(1) : '0.0'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="group bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Max Violations</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {statistics.max_violations || 0}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        <div className="group bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Fines</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  ₱{repeatOffenders.reduce((sum, offender) => sum + parseFloat(offender.total_fines || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Filter Options</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Minimum Violations
            </label>
            <select
              className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
              value={filters.min_violations}
              onChange={(e) => setFilters(prev => ({ ...prev, min_violations: parseInt(e.target.value) }))}
            >
              <option value={2}>2+ Violations</option>
              <option value={3}>3+ Violations</option>
              <option value={5}>5+ Violations</option>
              <option value={10}>10+ Violations</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Results Limit
            </label>
            <select
              className="block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400"
              value={filters.limit}
              onChange={(e) => setFilters(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
            >
              <option value={10}>10 Results</option>
              <option value={20}>20 Results</option>
              <option value={50}>50 Results</option>
              <option value={100}>100 Results</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-600">Showing <span className="font-semibold text-gray-900">{repeatOffenders.length}</span> repeat offenders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Repeat Offenders Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
        <div className="px-6 py-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Repeat Offenders List</h3>
              <p className="text-gray-600 mt-2">
                Showing <span className="font-semibold text-blue-600">{repeatOffenders.length}</span> repeat offenders with <span className="font-semibold text-red-600">{filters.min_violations}+</span> violations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">Live Data</span>
            </div>
          </div>
        </div>

        {repeatOffenders.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No repeat offenders found</h3>
            <p className="text-gray-500">No violators found with {filters.min_violations}+ violations</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-gray-100 to-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Violator
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Violations
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total Fines
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Status
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      First Violation
                    </div>
                    <div className="text-xs font-normal text-gray-500 mt-1">Date & Type</div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Last Violation
                    </div>
                    <div className="text-xs font-normal text-gray-500 mt-1">Date & Type</div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {repeatOffenders.map((offender, index) => (
                  <tr key={index} className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 group">
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{offender.violator_name}</div>
                        {offender.violator_license && (
                          <div className="text-xs text-blue-600 font-mono mt-1 bg-blue-50 px-2 py-1 rounded">
                            License: {offender.violator_license}
                          </div>
                        )}
                        {offender.violator_phone && (
                          <div className="text-xs text-gray-500 mt-1">
                            📞 {offender.violator_phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg">
                          🔥 {offender.total_violations} violations
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-gray-900">
                          ₱{parseFloat(offender.total_fines || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Paid: ₱{parseFloat(offender.paid_fines || 0).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold ${
                          parseFloat(offender.paid_fines || 0) === parseFloat(offender.total_fines || 0) 
                            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                            : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                        }`}>
                          {parseFloat(offender.paid_fines || 0) === parseFloat(offender.total_fines || 0) 
                            ? '✅ Fully Paid' 
                            : '⚠️ Outstanding Balance'}
                        </span>
                        {parseFloat(offender.pending_fines || 0) > 0 && (
                          <span className="text-xs text-gray-600 bg-yellow-100 px-2 py-1 rounded">
                            ₱{parseFloat(offender.pending_fines || 0).toLocaleString()} pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                          {offender.first_violation_date ? 
                            new Date(offender.first_violation_date).toLocaleDateString() : '-'}
                        </div>
                        {offender.first_violation_type && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {offender.first_violation_type}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap">
                      <div className="space-y-2">
                        <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                          {offender.last_violation_date ? 
                            new Date(offender.last_violation_date).toLocaleDateString() : '-'}
                        </div>
                        {offender.last_violation_type && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {offender.last_violation_type}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RepeatOffenders;
