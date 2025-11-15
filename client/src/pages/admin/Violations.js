import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { violationsAPI, adminAPI } from '../../services/api';
import { Search, Filter, Download, Eye, Edit, Trash2, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import toast from 'react-hot-toast';

const VIOLATION_TYPES = [
  'Speeding',
  'Red Light',
  'Parking',
  'Reckless Driving',
  'DUI'
];

const Violations = () => {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: '',
    enforcer_id: '',
    start_date: '',
    end_date: '',
    violation_type: '',
    repeat_offender: '',
    violator_name: '',
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingViolation, setEditingViolation] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, violation: null });
  const queryClient = useQueryClient();

  const { data: violationsResponse, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['violations', filters],
    queryFn: () => violationsAPI.getViolations(filters),
    placeholderData: (previousData) => previousData,
    retry: 2,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always consider data stale for better refresh behavior
    onError: (err) => {
      console.error('Failed to load violations:', err);
    }
  });

  // Query for dashboard stats to get accurate counts
  const { data: dashboardStats } = useQuery({
    queryKey: ['violationStats'],
    queryFn: () => adminAPI.getDashboard(),
    staleTime: 30000, // 30 seconds
  });

  // Query for enforcers data for filtering
  const { data: enforcersData } = useQuery({
    queryKey: ['enforcers'],
    queryFn: () => adminAPI.getEnforcers(),
    staleTime: 60000, // 1 minute
    retry: 2,
    onError: (err) => {
      console.error('Failed to load enforcers:', err);
    }
  });

  // Extract enforcers from response
  const enforcers = enforcersData?.data?.data?.enforcers || [];

  // Extract data from response
  const data = violationsResponse?.data?.data;
  const { violations, pagination } = data || {};

  // Update violation mutation
  const updateViolationMutation = useMutation({
    mutationFn: ({ id, data }) => violationsAPI.updateViolation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['violations', filters]);
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['violationStats']);
      setShowEditModal(false);
      setEditingViolation(null);
      setFormErrors({});
      toast.success('Violation updated successfully');
    },
    onError: (error) => {
      if (error.response?.data?.details) {
        const errors = {};
        error.response.data.details.forEach(detail => {
          errors[detail.param || detail.path] = detail.msg;
        });
        setFormErrors(errors);
      } else {
        setFormErrors({});
        toast.error(error.response?.data?.message || 'Failed to update violation');
      }
    }
  });

  // Delete violation mutation
  const deleteViolationMutation = useMutation({
    mutationFn: (id) => violationsAPI.deleteViolation(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['violations', filters]);
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['violationStats']);
      toast.success('Violation deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete violation');
    }
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleEdit = (violation) => {
    setEditingViolation(violation);
    setShowEditModal(true);
    setFormErrors({});
  };

  const handleDelete = (violation) => {
    setDeleteDialog({ isOpen: true, violation });
  };

  const confirmDelete = () => {
    if (deleteDialog.violation) {
      deleteViolationMutation.mutate(deleteDialog.violation.id);
      setDeleteDialog({ isOpen: false, violation: null });
    }
  };

  const cancelDelete = () => {
    setDeleteDialog({ isOpen: false, violation: null });
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      toast.loading('Preparing export...', { id: 'export' });
      
      // Prepare export parameters with current filters (exclude pagination)
      const exportFilters = {
        search: filters.search || '',
        status: filters.status || '',
        enforcer_id: filters.enforcer_id || '',
        start_date: filters.start_date || '',
        end_date: filters.end_date || '',
        violation_type: filters.violation_type || '',
        repeat_offender: filters.repeat_offender || '',
        violator_name: filters.violator_name || '',
        format: 'csv'
      };

      console.log('Export filters:', exportFilters);
      const response = await violationsAPI.exportViolations(exportFilters);
      console.log('Export response status:', response.status);
      
      // Check for successful response
      if (response.status !== 200) {
        const errorText = await response.text();
        console.error('Export error response:', errorText);
        throw new Error(`Export failed: ${response.status} - ${errorText}`);
      }
      
      // Get the CSV content as blob
      const blob = await response.blob();
      console.log('Export blob size:', blob.size);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with current date and filters
      const today = new Date().toISOString().split('T')[0];
      let filename = `violations_export_${today}`;
      if (filters.status) filename += `_${filters.status}`;
      if (filters.start_date && filters.end_date) {
        filename += `_${filters.start_date}_to_${filters.end_date}`;
      }
      filename += '.csv';
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Export completed successfully!', { id: 'export' });
    } catch (error) {
      console.error('Export error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to export violations';
      if (error.message.includes('401')) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (error.message.includes('403')) {
        errorMessage = 'You do not have permission to export violations.';
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error occurred during export.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage, { id: 'export' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const violationData = {
      status: formData.get('status'),
      notes: formData.get('notes')
    };

    updateViolationMutation.mutate({ 
      id: editingViolation.id, 
      data: violationData 
    });
  };

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
        <div className="text-danger-600 mb-4">Failed to load violations</div>
        <p className="text-gray-600 mb-6">Request failed with status code {error?.response?.status || 500}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          <RefreshCw className="h-4 w-4 mr-2 inline" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="bg-gradient-to-r from-white to-gray-50 rounded-2xl mobile-card shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="responsive-text-2xl font-bold text-gray-900">Traffic Violations</h1>
          <p className="mt-1 responsive-text-sm text-gray-500">
            View and manage violations recorded by enforcers via IoT devices
          </p>
        </div>
          <div className="mobile-button-group">
            {/* Simplified View Pending Button */}
          <button 
            onClick={() => handleFilterChange('status', filters.status === 'pending' ? '' : 'pending')}
              className={`mobile-btn ${
                filters.status === 'pending' 
                  ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md' 
                  : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md'
              }`}
            title={filters.status === 'pending' ? 'Show all violations' : 'Show only pending violations'}
          >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">{filters.status === 'pending' ? 'Show All' : 'View Pending'}</span>
              <span className="sm:hidden">{filters.status === 'pending' ? 'All' : 'Pending'}</span>
          </button>
            
            {/* Simplified Refresh Button */}
          <button 
            onClick={async () => {
              try {
                // Invalidate all related queries
                await queryClient.invalidateQueries(['violations']);
                await queryClient.invalidateQueries(['violationStats']);
                await queryClient.invalidateQueries(['adminDashboard']);
                
                // Force refetch the current query
                await refetch();
                
                toast.success('Data refreshed successfully!');
              } catch (error) {
                console.error('Refresh error:', error);
                toast.error('Failed to refresh data');
              }
            }}
            disabled={isFetching}
              className="mobile-btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>
            
            {/* Simplified Export Button */}
          <button 
            onClick={handleExport}
            disabled={isExporting}
              className="mobile-btn bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export current violations to CSV"
          >
            {isExporting ? (
                <LoadingSpinner size="sm" />
            ) : (
                <Download className="h-4 w-4" />
            )}
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="bg-white rounded-2xl mobile-card shadow-sm border border-gray-100">
        <div className="mobile-stats-grid-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl border border-blue-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center">
            <div className="flex-1">
                <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Total Violations</p>
              <p className="text-3xl font-bold text-blue-900">{dashboardStats?.data?.data?.totalViolations || 0}</p>
                <div className="mt-2 flex items-center text-sm text-blue-600">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span>Total recorded</span>
                </div>
            </div>
              <div className="p-4 bg-blue-200 rounded-2xl shadow-inner">
                <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>
        
          <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-2xl border border-amber-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center">
            <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 uppercase tracking-wide mb-2">Pending Violations</p>
                <p className="text-3xl font-bold text-amber-800">
                {dashboardStats?.data?.data?.violationsByStatus?.find(s => s.status === 'pending')?.count || 0}
              </p>
                <div className="mt-2 flex items-center text-sm text-amber-600">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Awaiting payment</span>
                </div>
            </div>
              <div className="p-4 bg-amber-200 rounded-2xl shadow-inner">
                <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
        
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl border border-green-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="flex items-center">
            <div className="flex-1">
                <p className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-2">Paid Violations</p>
                <p className="text-3xl font-bold text-green-800">
                {dashboardStats?.data?.data?.violationsByStatus?.find(s => s.status === 'paid')?.count || 0}
              </p>
                <div className="mt-2 flex items-center text-sm text-green-600">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Successfully collected</span>
                </div>
            </div>
              <div className="p-4 bg-green-200 rounded-2xl shadow-inner">
                <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className={`border rounded-lg p-4 ${
        filters.status === 'pending' 
          ? 'bg-warning-50 border-warning-200' 
          : 'bg-blue-50 border-blue-200'
      }`}>
        <div className="flex">
          <div className="flex-shrink-0">
            {filters.status === 'pending' ? (
              <svg className="h-5 w-5 text-warning-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${
              filters.status === 'pending' ? 'text-warning-800' : 'text-blue-800'
            }`}>
              {filters.status === 'pending' ? 'Pending Violations View' : 'IoT Device Integration'}
            </h3>
            <div className={`mt-2 text-sm ${
              filters.status === 'pending' ? 'text-warning-700' : 'text-blue-700'
            }`}>
              <p>
                {filters.status === 'pending' 
                  ? 'You are currently viewing pending violations that require review and processing. These violations were recorded by enforcers and are awaiting status updates.' 
                  : 'Violations are automatically recorded by enforcers using handheld IoT devices. This interface allows administrators to view, manage, and process the recorded violations.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-100 to-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary-600" />
            Filter Violations
          </h3>
          <p className="text-sm text-gray-600 mt-1">Refine your search to find specific violations</p>
        </div>
        <div className="mobile-card">
          <div className="mobile-form-grid">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200"
                  placeholder="Search violations..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
              </div>
            </div>

            {/* Violator name filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Violator Name
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200"
                  placeholder="Search by violator name..."
                  value={filters.violator_name}
                  onChange={(e) => handleFilterChange('violator_name', e.target.value)}
                />
              </div>
            </div>

            {/* Status filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="issued">Issued</option>
                <option value="paid">Paid</option>
                <option value="disputed">Disputed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Violation type filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Violation Type
              </label>
              <input
                type="text"
                list="violation-types"
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200"
                placeholder="Search violation types..."
                value={filters.violation_type}
                onChange={(e) => handleFilterChange('violation_type', e.target.value)}
              />
              <datalist id="violation-types">
                {VIOLATION_TYPES.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>

            {/* Repeat offender filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repeat Offender
              </label>
              <select
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200"
                value={filters.repeat_offender}
                onChange={(e) => handleFilterChange('repeat_offender', e.target.value)}
              >
                <option value="">All Violators</option>
                <option value="true">Repeat Offenders Only</option>
                <option value="false">First-Time Offenders Only</option>
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                className="mobile-input focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>
          </div>

          <div className="mobile-form-grid mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                className="mobile-input focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enforcer
              </label>
              <select
                className="mobile-select focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.enforcer_id}
                onChange={(e) => handleFilterChange('enforcer_id', e.target.value)}
              >
                <option value="">All Enforcers</option>
                {enforcers.map(enforcer => (
                  <option key={enforcer.id} value={enforcer.id}>
                    {enforcer.full_name} ({enforcer.badge_number})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Items per page
              </label>
              <select
                className="mobile-select focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  page: 1,
                  limit: 10,
                  search: '',
                  status: '',
                  enforcer_id: '',
                  start_date: '',
                  end_date: '',
                  violation_type: '',
                  repeat_offender: '',
                  violator_name: '',
                })}
                className="mobile-btn-secondary w-full hover:bg-gray-100 transition-colors duration-200"
              >
                <Filter className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Clear Filters</span>
                <span className="sm:hidden">Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Violations table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Violations List
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {filters.status === 'pending' 
                  ? 'Pending violations requiring review'
                  : 'All traffic violations recorded by enforcers'
                }
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {pagination?.totalRecords || 0} total violations
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Violation #
                </th>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Violator
                </th>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vehicle
                </th>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fine
                </th>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enforcer
                </th>
                <th className="px-2 sm:px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-2 sm:px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                {violations?.map((violation) => (
                  <tr key={violation.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {violation.violation_number}
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{violation.violator_name}</div>
                        <div className="text-sm text-gray-500">
                          {violation.violator_phone}
                        </div>
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
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{violation.vehicle_plate}</div>
                        <div className="text-sm text-gray-500">
                          {violation.vehicle_model} {violation.vehicle_color}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-sm text-gray-900">{violation.violation_type}</td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₱{violation.fine_amount?.toLocaleString()}
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                      <StatusBadge status={violation.status} />
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{violation.enforcer_name}</div>
                        <div className="text-sm text-gray-500">
                          {violation.enforcer_badge}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(violation.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(violation.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button className="text-primary-600 hover:text-primary-900 p-1 rounded-md hover:bg-primary-50 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(violation)}
                          className="text-warning-600 hover:text-warning-900 p-1 rounded-md hover:bg-warning-50 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(violation)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!violations || violations.length === 0) && (
              <div className="text-center py-16 bg-gradient-to-b from-gray-50 to-gray-100">
                <div className="mb-6">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-gray-900 mb-3">No violations found</h3>
                <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
                  {filters.status === 'pending' 
                    ? 'No pending violations at the moment. All violations have been processed.'
                    : 'Violations will appear here once enforcers record them using their IoT devices.'
                  }
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.total > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium text-gray-900">{((pagination.current - 1) * filters.limit) + 1}</span> to{' '}
                  <span className="font-medium text-gray-900">{Math.min(pagination.current * filters.limit, pagination.totalRecords)}</span> of{' '}
                  <span className="font-medium text-gray-900">{pagination.totalRecords}</span> results
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handlePageChange(pagination.current - 1)}
                    disabled={pagination.current === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors duration-200"
                  >
                    Previous
                  </button>
                  <div className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg">
                    Page {pagination.current} of {pagination.total}
                  </div>
                  <button
                    onClick={() => handlePageChange(pagination.current + 1)}
                    disabled={pagination.current === pagination.total}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors duration-200"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* Edit Violation Modal */}
      {showEditModal && editingViolation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl mobile-modal overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-blue-50">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary-600" />
                Edit Violation
              </h2>
              <p className="text-sm text-gray-600 mt-1">Update violation status and add administrative notes</p>
            </div>
            
            <form onSubmit={handleSubmit} className="mobile-card space-y-6">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Violation Details
                </h3>
                <div className="text-sm text-gray-700 space-y-2">
                  <p><span className="font-medium text-gray-900">Number:</span> {editingViolation.violation_number}</p>
                  <p><span className="font-medium text-gray-900">Type:</span> {editingViolation.violation_type}</p>
                  <p><span className="font-medium text-gray-900">Violator:</span> {editingViolation.violator_name}</p>
                  <p><span className="font-medium text-gray-900">Fine:</span> ₱{editingViolation.fine_amount?.toLocaleString()}</p>
                  <p><span className="font-medium text-gray-900">Location:</span> {editingViolation.location}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  name="status"
                  defaultValue={editingViolation.status}
                  required
                  className={`mobile-select w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 ${
                    formErrors.status ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                >
                  <option value="pending">Pending</option>
                  <option value="issued">Issued</option>
                  <option value="paid">Paid</option>
                  <option value="disputed">Disputed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                {formErrors.status && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formErrors.status}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Administrative Notes
                </label>
                <textarea
                  name="notes"
                  rows="4"
                  defaultValue={editingViolation.notes || ''}
                  placeholder="Add administrative notes or updates..."
                  className={`mobile-input w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-colors duration-200 ${
                    formErrors.notes ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                  }`}
                />
                {formErrors.notes && (
                  <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formErrors.notes}
                  </p>
                )}
              </div>

              <div className="mobile-button-group pt-6 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={updateViolationMutation.isPending}
                  className="mobile-btn-primary flex-1"
                >
                  {updateViolationMutation.isPending ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </div>
                  ) : (
                    'Update Violation'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingViolation(null);
                    setFormErrors({});
                  }}
                  className="mobile-btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteDialog.isOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Violation"
        message={`Are you sure you want to delete violation #${deleteDialog.violation?.violation_number}? This action cannot be undone and will remove all associated data including SMS logs.`}
        confirmText="Delete Violation"
        cancelText="Cancel"
        type="danger"
        isLoading={deleteViolationMutation.isPending}
        confirmButtonColor="red"
      />
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: 'warning', text: 'Pending' },
    issued: { color: 'info', text: 'Issued' },
    paid: { color: 'success', text: 'Paid' },
    disputed: { color: 'danger', text: 'Disputed' },
    cancelled: { color: 'secondary', text: 'Cancelled' },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`badge-${config.color}`}>
      {config.text}
    </span>
  );
};

export default Violations;
