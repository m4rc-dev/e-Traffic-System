import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '../../services/api';
import { AlertTriangle, Users, TrendingUp, DollarSign, Shield, Clock } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';

const RepeatOffenders = () => {
  const [filters, setFilters] = useState({
    min_violations: 2,
    limit: 20
  });

  const { data: repeatOffendersResponse, isLoading, error } = useQuery({
    queryKey: ['repeatOffenders', filters],
    queryFn: () => adminAPI.getRepeatOffenders(filters),
    refetchInterval: 30000,
  });

  const repeatOffenders = repeatOffendersResponse?.data?.data?.repeatOffenders || [];
  const statistics = repeatOffendersResponse?.data?.data?.statistics || {};

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-2 bg-red-100 rounded-lg">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Repeat Offenders
            </h1>
            <p className="text-sm text-gray-600 mt-1">Monitor and track violators with multiple offenses</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Users className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Repeat Offenders</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {statistics.total_repeat_offenders || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Violations per Offender</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {statistics.avg_violations_per_offender ? 
                  parseFloat(statistics.avg_violations_per_offender).toFixed(1) : '0.0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Max Violations</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {statistics.max_violations || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Fines</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                ₱{repeatOffenders.reduce((sum, offender) => sum + parseFloat(offender.total_fines || 0), 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Filter Repeat Offenders</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Violations
            </label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={filters.min_violations}
              onChange={(e) => setFilters(prev => ({ ...prev, min_violations: parseInt(e.target.value) }))}
            >
              <option value={2}>2+ Violations</option>
              <option value={3}>3+ Violations</option>
              <option value={5}>5+ Violations</option>
              <option value={10}>10+ Violations</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Results Limit
            </label>
            <select
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <div className="w-full bg-gray-50 rounded-md p-3 text-center">
              <p className="text-sm text-gray-600">Showing <span className="font-semibold text-gray-900">{repeatOffenders.length}</span> repeat offenders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Repeat Offenders Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Repeat Offenders List</h3>
              <p className="text-sm text-gray-600 mt-1">
                Showing <span className="font-semibold text-blue-600">{repeatOffenders.length}</span> repeat offenders with <span className="font-semibold text-red-600">{filters.min_violations}+</span> violations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-500">Live Data</span>
            </div>
          </div>
        </div>

        {repeatOffenders.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4">
              <Users className="mx-auto h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No repeat offenders found</h3>
            <p className="text-sm text-gray-500">No violators found with {filters.min_violations}+ violations</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Violator
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Violations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Financial Overview
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    First Violation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Violation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {repeatOffenders.map((offender, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{offender.violator_name}</div>
                        {offender.violator_license && (
                          <div className="text-xs text-blue-600 font-mono mt-1">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {offender.total_violations} violations
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-base font-bold text-gray-900">
                          ₱{parseFloat(offender.total_fines || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          Paid: ₱{parseFloat(offender.paid_fines || 0).toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          parseFloat(offender.paid_fines || 0) === parseFloat(offender.total_fines || 0) 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {parseFloat(offender.paid_fines || 0) === parseFloat(offender.total_fines || 0) 
                            ? 'Fully Paid' 
                            : 'Outstanding Balance'}
                        </span>
                        {parseFloat(offender.pending_fines || 0) > 0 && (
                          <span className="text-xs text-gray-600">
                            ₱{parseFloat(offender.pending_fines || 0).toLocaleString()} pending
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-600">
                          {offender.first_violation_date ? 
                            new Date(offender.first_violation_date.toDate ? offender.first_violation_date.toDate() : offender.first_violation_date).toLocaleDateString() : '-'}
                        </div>
                        {offender.first_violation_type && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {offender.first_violation_type}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-600">
                          {offender.last_violation_date ? 
                            new Date(offender.last_violation_date.toDate ? offender.last_violation_date.toDate() : offender.last_violation_date).toLocaleDateString() : '-'}
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