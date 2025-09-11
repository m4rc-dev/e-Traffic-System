import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Search, RefreshCw } from 'lucide-react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

const Enforcers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEnforcer, setEditingEnforcer] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [suggestedBadgeNumber, setSuggestedBadgeNumber] = useState('');
  const queryClient = useQueryClient();
  
  // Debug authentication
  const token = localStorage.getItem('token');
  console.log('Auth token:', token ? 'Present' : 'Missing');
  console.log('Token value:', token);

  // Fetch enforcers
  const { data: enforcersResponse, isLoading, error: queryError, isFetching } = useQuery({
    queryKey: ['enforcers'],
    queryFn: () => adminAPI.getEnforcers(),
    retry: 1,
    refetchOnWindowFocus: false
  });
  
  console.log('Query state:', { isLoading, isFetching, error: queryError, hasData: !!enforcersResponse });

  // Extract enforcers array from response (server wraps payload in data)
  const enforcers = enforcersResponse?.data?.data?.enforcers || [];
  
  // Debug logging
  console.log('Enforcers API Response:', enforcersResponse);
  console.log('Extracted enforcers:', enforcers);
  console.log('Response structure:', {
    success: enforcersResponse?.data?.success,
    data: enforcersResponse?.data,
    enforcers: enforcersResponse?.data?.enforcers
  });

  // Fetch next badge number for new enforcers
  const fetchNextBadgeNumber = async () => {
    try {
      const response = await adminAPI.getNextBadgeNumber();
      if (response.data.success) {
        setSuggestedBadgeNumber(response.data.data.next_badge_number);
      }
    } catch (error) {
      console.error('Failed to fetch next badge number:', error);
      // Fallback to manual entry
      setSuggestedBadgeNumber('');
    }
  };

  // Auto-fetch badge number when opening add modal
  useEffect(() => {
    if (showAddModal && !editingEnforcer) {
      fetchNextBadgeNumber();
    }
  }, [showAddModal, editingEnforcer]);
  


  // Add enforcer mutation
  const addEnforcerMutation = useMutation({
    mutationFn: (enforcerData) => adminAPI.createEnforcer(enforcerData),
    onSuccess: (response, variables) => {
      // Add the new enforcer to the cache immediately
      queryClient.setQueryData(['enforcers'], (oldData) => {
        if (oldData?.data?.data?.enforcers) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              data: {
                ...oldData.data.data,
                enforcers: [response.data?.data, ...(oldData.data.data.enforcers || [])]
              }
            }
          };
        }
        return oldData;
      });
      
      // Also invalidate to ensure fresh data across pages
      queryClient.invalidateQueries(['enforcers']);
      queryClient.invalidateQueries(['adminDashboard']);
      setShowAddModal(false);
      setFormErrors({});
      
      // Show success message with IoT device login instructions
      const enforcerName = variables.full_name || variables.username;
      toast.success(
        `${enforcerName} added! \n\n📱 IoT Login:\nEmail: ${variables.email}\nPassword: [as provided]`,
        {
          duration: 6000,
          style: {
            minWidth: '300px'
          }
        }
      );
    },
    onError: (error) => {
      console.log('Add enforcer error:', error.response?.data);
      // Handle validation errors
      if (error.response?.data?.details && error.response.data.details.length > 0) {
        const errors = {};
        error.response.data.details.forEach(detail => {
          const fieldName = detail.param || detail.path || detail.location;
          errors[fieldName] = detail.msg;
        });
        setFormErrors(errors);
        // Don't show general error if we have specific field errors
      } else {
        // Only show general error if no specific field errors
        setFormErrors({ 
          general: error.response?.data?.message || error.response?.data?.error || 'Failed to add enforcer. Please check your input and try again.' 
        });
        toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to add enforcer');
      }
    }
  });

  // Update enforcer mutation
  const updateEnforcerMutation = useMutation({
    mutationFn: ({ id, data }) => adminAPI.updateEnforcer(id, data),
    onSuccess: (response, variables) => {
      // Update the enforcer in the cache immediately
      queryClient.setQueryData(['enforcers'], (oldData) => {
        if (oldData?.data?.data?.enforcers) {
          return {
            ...oldData,
            data: {
              ...oldData.data,
              data: {
                ...oldData.data.data,
                enforcers: oldData.data.data.enforcers.map(enforcer =>
                  enforcer.id === variables.id ? { ...enforcer, ...response.data?.data } : enforcer
                )
              }
            }
          };
        }
        return oldData;
      });
      
      // Also invalidate to ensure fresh data across pages
      queryClient.invalidateQueries(['enforcers']);
      queryClient.invalidateQueries(['adminDashboard']);
      setEditingEnforcer(null);
      setFormErrors({});
      toast.success('Enforcer updated successfully');
    },
    onError: (error) => {
      console.log('Update enforcer error:', error.response?.data);
      // Handle validation errors
      if (error.response?.data?.details && error.response.data.details.length > 0) {
        const errors = {};
        error.response.data.details.forEach(detail => {
          const fieldName = detail.param || detail.path || detail.location;
          errors[fieldName] = detail.msg;
        });
        setFormErrors(errors);
        // Don't show general error if we have specific field errors
      } else {
        // Only show general error if no specific field errors
        setFormErrors({ 
          general: error.response?.data?.message || error.response?.data?.error || 'Failed to update enforcer. Please check your input and try again.' 
        });
        toast.error(error.response?.data?.message || error.response?.data?.error || 'Failed to update enforcer');
      }
    }
  });

  // Delete enforcer mutation
  const deleteEnforcerMutation = useMutation({
    mutationFn: (id) => adminAPI.deleteEnforcer(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['enforcers']);
      queryClient.invalidateQueries(['adminDashboard']);
      toast.success('Enforcer deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to delete enforcer');
    }
  });

  // Filter enforcers
  const filteredEnforcers = enforcers.filter(enforcer => {
    const matchesSearch = enforcer.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         enforcer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         enforcer.badge_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && enforcer.is_active) ||
                         (statusFilter === 'inactive' && !enforcer.is_active);
    
    return matchesSearch && matchesStatus;
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Clear previous errors
    setFormErrors({});
    
    // Validate phone number (11 digits for Philippine mobile numbers)
    const phoneNumber = formData.get('phone_number');
    if (phoneNumber) {
      // Remove any non-digit characters for validation
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length !== 11) {
        setFormErrors({ phone_number: 'Phone number must be exactly 11 digits' });
        return;
      }
      // Check if it starts with 09 (Philippine mobile prefix)
      if (!cleanPhone.startsWith('09')) {
        setFormErrors({ phone_number: 'Phone number must start with 09 (Philippine mobile format)' });
        return;
      }
    }
    
    const enforcerData = {
      username: formData.get('username'),
      email: formData.get('email'),
      full_name: formData.get('full_name'),
      badge_number: formData.get('badge_number'),
      phone_number: phoneNumber,
      is_active: formData.get('is_active') === 'true'
    };

    // Only include password for new enforcers
    if (!editingEnforcer) {
      enforcerData.password = formData.get('password');
    }

    if (editingEnforcer) {
      updateEnforcerMutation.mutate({ id: editingEnforcer.id, data: enforcerData });
    } else {
      addEnforcerMutation.mutate(enforcerData);
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this enforcer?')) {
      deleteEnforcerMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load enforcers</p>
        <p className="text-gray-600 text-sm">{queryError.message}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 btn-primary"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="responsive-text-2xl font-bold text-gray-900">Enforcer Management</h1>
          <p className="responsive-text-sm text-gray-600">Manage traffic enforcer accounts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="mobile-btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Enforcer</span>
          </button>
        </div>
      </div>

      {/* IoT Device Integration Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-blue-800">
              📱 IoT Device Integration
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Enforcers use <strong>email</strong> and <strong>password</strong> to log into handheld IoT devices for recording violations.
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs">
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  Automatic account activation
                </span>
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  Secure password hashing
                </span>
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  Real-time violation sync
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mobile-card">
        <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search enforcers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200"
              />
            </div>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200 min-w-[140px] appearance-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Enforcers Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enforcer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Badge Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEnforcers.map((enforcer) => (
                <tr key={enforcer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {enforcer.full_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {enforcer.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {enforcer.badge_number || 'N/A'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {enforcer.phone_number || 'N/A'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      enforcer.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {enforcer.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {enforcer.last_login 
                      ? new Date(enforcer.last_login).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingEnforcer(enforcer)}
                        className="text-indigo-600 hover:text-indigo-900 p-1 rounded-md hover:bg-indigo-50 transition-colors"
                        title="Edit Enforcer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(enforcer.id)}
                        className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                        title="Delete Enforcer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredEnforcers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">No enforcers found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingEnforcer) && (
        <>
          {/* Backdrop - Full screen coverage */}
                <div
        className="fixed bg-transparent z-[9999] inset-0"
        onClick={() => {
          setShowAddModal(false);
          setEditingEnforcer(null);
          setFormErrors({});
        }}
      />
          
                    {/* Modal Content */}
          <div className="fixed inset-0 flex items-start justify-center z-[10000] p-4 pt-12">
            <div className="mobile-modal bg-white rounded-lg shadow-2xl border border-gray-200 p-3 sm:p-4 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-2">
                <h2 className="responsive-text-xl font-bold text-gray-900">
                  {editingEnforcer ? 'Edit Enforcer' : 'Add New Enforcer'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingEnforcer(null);
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 touch-target"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-2">
                {/* General Error Message - only show if no specific field errors */}
                {formErrors.general && !Object.keys(formErrors).some(key => key !== 'general') && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{formErrors.general}</p>
                  </div>
                )}
                
                <div>
                  <label className="block responsive-text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    defaultValue={editingEnforcer?.username || ''}
                    required
                    className={`mobile-input ${
                      formErrors.username ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {formErrors.username && (
                    <p className="mt-1 responsive-text-sm text-red-600">{formErrors.username}</p>
                  )}
                </div>
                
                <div>
                  <label className="block responsive-text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingEnforcer?.email || ''}
                    required
                    placeholder="enforcer@example.com"
                    className={`mobile-input ${
                      formErrors.email ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {formErrors.email && (
                    <p className="mt-1 responsive-text-sm text-red-600">{formErrors.email}</p>
                  )}
                </div>
                
                {!editingEnforcer && (
                  <div>
                    <label className="block responsive-text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="Enter a secure password"
                      className={`mobile-input ${
                        formErrors.password ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    />
                    {formErrors.password && (
                      <p className="mt-1 responsive-text-sm text-red-600">{formErrors.password}</p>
                    )}
                  </div>
                )}
                
                <div>
                  <label className="block responsive-text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    defaultValue={editingEnforcer?.full_name || ''}
                    required
                    className={`mobile-input ${
                      formErrors.full_name ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {formErrors.full_name && (
                    <p className="mt-1 responsive-text-sm text-red-600">{formErrors.full_name}</p>
                  )}
                </div>
                
                <div>
                  <label className="block responsive-text-sm font-medium text-gray-700 mb-1">
                    Badge Number
                    {!editingEnforcer && suggestedBadgeNumber && (
                      <span className="responsive-text-xs text-green-600 ml-2 font-medium">
                        (Suggested: {suggestedBadgeNumber})
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="badge_number"
                      defaultValue={editingEnforcer?.badge_number || suggestedBadgeNumber || ''}
                      key={editingEnforcer ? `edit-${editingEnforcer.id}` : `add-${suggestedBadgeNumber}`}
                      required
                      placeholder={!editingEnforcer ? (suggestedBadgeNumber || 'BADGE001') : ''}
                      className={`flex-1 mobile-input ${
                        formErrors.badge_number ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    />
                    {!editingEnforcer && (
                      <button
                        type="button"
                        onClick={fetchNextBadgeNumber}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary focus:border-transparent transition-colors touch-target"
                        title="Refresh suggested badge number"
                      >
                        <RefreshCw className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                  </div>
                  {formErrors.badge_number && (
                    <p className="mt-1 responsive-text-sm text-red-600">{formErrors.badge_number}</p>
                  )}
                </div>
                
                <div>
                  <label className="block responsive-text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                    <span className="responsive-text-xs text-gray-500 ml-1">(11 digits, starts with 09)</span>
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    defaultValue={editingEnforcer?.phone_number || ''}
                    pattern="09[0-9]{9}"
                    placeholder="09123456789"
                    maxLength="11"
                    className={`mobile-input ${
                      formErrors.phone_number ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  />
                  {formErrors.phone_number && (
                    <p className="mt-1 responsive-text-sm text-red-600">{formErrors.phone_number}</p>
                  )}
                </div>
                
                <div>
                  <label className="block responsive-text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="is_active"
                    defaultValue={editingEnforcer ? editingEnforcer.is_active.toString() : 'true'}
                    className={`mobile-select ${
                      formErrors.is_active ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  {formErrors.is_active && (
                    <p className="mt-1 responsive-text-sm text-red-600">{formErrors.is_active}</p>
                  )}
                </div>
                
                <div className="mobile-button-group pt-4">
                  <button
                    type="submit"
                    disabled={addEnforcerMutation.isPending || updateEnforcerMutation.isPending}
                    className="mobile-btn-primary"
                  >
                    {addEnforcerMutation.isPending || updateEnforcerMutation.isPending ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </div>
                    ) : (
                      editingEnforcer ? 'Update Enforcer' : 'Add Enforcer'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingEnforcer(null);
                      setFormErrors({});
                    }}
                    className="mobile-btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Enforcers;
