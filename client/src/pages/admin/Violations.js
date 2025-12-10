import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { violationsAPI, adminAPI } from '../../services/api';
import { Search, Filter, Download, Edit, Trash2, RefreshCw, Printer } from 'lucide-react';
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

/**
 * Parse various date formats for display, including ESP32 format
 * Handles: Firebase Timestamp, ISO strings, ESP32 format (e.g., "12-4-25 14.30.0")
 * @param {any} dateValue - The date value from the database
 * @returns {Date} - Valid Date object or current date if parsing fails
 */
const parseDisplayDate = (dateValue) => {
  if (!dateValue) return new Date();

  // Handle Firebase Timestamp (with or without underscore)
  if (dateValue?.seconds || dateValue?._seconds) {
    const seconds = dateValue.seconds || dateValue._seconds;
    return new Date(seconds * 1000);
  }

  // Handle Date object
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }

  // Try standard Date parsing first
  const standardDate = new Date(dateValue);
  if (!isNaN(standardDate.getTime())) {
    return standardDate;
  }

  // Try ESP32 format: "12-4-25 14.30.0" (MM-D-YY HH.MM.SS)
  if (typeof dateValue === 'string') {
    try {
      const cleaned = dateValue.trim();
      const parts = cleaned.split(' ');

      if (parts.length === 2) {
        const [datePart, timePart] = parts;

        // Split date by / or -
        const datePieces = datePart.includes('/')
          ? datePart.split('/')
          : datePart.split('-');

        if (datePieces.length === 3) {
          let [month, day, year] = datePieces.map(Number);

          // Handle 2-digit year
          if (year < 100) year += 2000;

          // Split time by : or .
          const timePieces = timePart.includes(':')
            ? timePart.split(':')
            : timePart.split('.');

          const hours = parseInt(timePieces[0], 10) || 0;
          const minutes = parseInt(timePieces[1], 10) || 0;
          const seconds = timePieces.length > 2 ? parseInt(timePieces[2], 10) : 0;

          const date = new Date(year, month - 1, day, hours, minutes, seconds);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing ESP32 date:', error);
    }
  }

  // Fallback to current date
  return new Date();
};

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

  // Debounced filters for search fields (violator_name, violation_type, search)
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const debounceTimeoutRef = useRef(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingViolation, setEditingViolation] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, violation: null });
  const queryClient = useQueryClient();

  // Debounce search fields (violator_name, violation_type, search) with 300ms delay
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [filters]);

  const { data: violationsResponse, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['violations', debouncedFilters],
    queryFn: () => violationsAPI.getViolations(debouncedFilters),
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
  const enforcers = enforcersData?.data?.data || [];

  // Extract data from response
  const data = violationsResponse?.data?.data;
  const { violations, pagination } = data || {};

  // State for tracking the selected status in the edit form
  const [selectedStatus, setSelectedStatus] = useState('');

  // Send SMS mutation
  const sendSMSMutation = useMutation({
    mutationFn: ({ id, data }) => violationsAPI.sendSMS(id, data),
    onSuccess: (data) => {
      toast.success(data.data?.message || 'SMS sent successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to send SMS');
    }
  });

  // Update violation mutation
  const updateViolationMutation = useMutation({
    mutationFn: ({ id, data }) => violationsAPI.updateViolation(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries(['violations']);
      queryClient.invalidateQueries(['adminDashboard']);
      queryClient.invalidateQueries(['violationStats']);
      setShowEditModal(false);
      setEditingViolation(null);
      setFormErrors({});
      setSelectedStatus('');

      // Check if we should send SMS (status was updated to 'paid' and sendSMS was checked)
      if (variables.data.status === 'paid' && variables.data.sendSMS) {
        const message = `e-Traffic: Payment Confirmed. Violation: ${variables.data.violationType}, Plate: ${variables.data.vehiclePlate}, Paid: PHP${variables.data.fineAmount}. Ref: ${variables.data.violationNumber}`;
        sendSMSMutation.mutate({
          id: variables.id,
          data: { message }
        });
      }

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
      queryClient.invalidateQueries(['violations']);
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

      // Fetch violations data for PDF generation
      const response = await violationsAPI.getViolations({
        ...filters,
        limit: 10000 // Get all violations for export
      });

      if (!response.data?.data?.violations) {
        throw new Error('Failed to fetch violations data');
      }

      const violations = response.data.data.violations;

      // Generate PDF using jsPDF
      const { jsPDF } = window.jspdf || require('jspdf');
      window.jspdfAutoTable || require('jspdf-autotable');

      const doc = new jsPDF('landscape');
      doc.setFont('helvetica');

      // Add title
      doc.setFontSize(18);
      doc.text('Traffic Violations Report', 14, 20);
      doc.setFontSize(12);

      // Add filter information
      let filterText = `Generated on: ${new Date().toLocaleDateString()}`;
      if (filters.status) filterText += ` | Status: ${filters.status}`;
      if (filters.start_date && filters.end_date) {
        filterText += ` | Period: ${filters.start_date} to ${filters.end_date}`;
      }
      doc.text(filterText, 14, 30);

      // Add violations table
      doc.autoTable({
        startY: 40,
        head: [['Violation #', 'Violator', 'Vehicle', 'Type', 'Fine', 'Status', 'Enforcer', 'Location', 'Date']],
        body: violations.map(violation => [
          violation.violation_number,
          violation.violator_name,
          violation.vehicle_plate,
          violation.violation_type,
          `P${parseFloat(violation.fine_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          violation.status,
          `${violation.enforcer_name}\n${violation.enforcer_badge}`,
          violation.location,
          parseDisplayDate(violation.datetime || violation.captured_at || violation.created_at).toLocaleDateString()
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [22, 160, 133] },
        margin: { top: 10 }
      });

      // Save the PDF
      const today = new Date().toISOString().split('T')[0];
      let filename = `violations_export_${today}`;
      if (filters.status) filename += `_${filters.status}`;
      if (filters.start_date && filters.end_date) {
        filename += `_${filters.start_date}_to_${filters.end_date}`;
      }
      filename += '.pdf';

      doc.save(filename);

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
    const status = formData.get('status');
    const notes = formData.get('notes');
    const sendSMS = formData.get('sendSMS') === 'on';
    const sendPenaltyReminder = formData.get('sendPenaltyReminder') === 'on';

    const violationData = {
      status,
      notes
    };

    // Add SMS flag and violation details if status is 'paid'
    if (status === 'paid') {
      violationData.sendSMS = sendSMS;
      violationData.violationNumber = editingViolation.violation_number;
      violationData.violatorName = editingViolation.violator_name;
      violationData.vehiclePlate = editingViolation.vehicle_plate;
      violationData.violationType = editingViolation.violation_type;
      violationData.fineAmount = editingViolation.fine_amount;
      violationData.enforcerName = editingViolation.enforcer_name;
      violationData.badgeNumber = editingViolation.enforcer_badge;
    }

    // Add penalty reminder flag if status is 'issued' and checkbox is checked
    if (status === 'issued' && sendPenaltyReminder) {
      violationData.sendPenaltyReminder = sendPenaltyReminder;
      violationData.violationNumber = editingViolation.violation_number;
      violationData.violatorName = editingViolation.violator_name;
      violationData.vehiclePlate = editingViolation.vehicle_plate;
      violationData.violationType = editingViolation.violation_type;
      violationData.fineAmount = editingViolation.fine_amount;
      violationData.location = editingViolation.location;
      violationData.dueDate = editingViolation.due_date;
      violationData.violatorPhone = editingViolation.violator_phone;
    }

    updateViolationMutation.mutate({
      id: editingViolation.id,
      data: violationData
    });
  };

  const handlePrintReceipt = async (violationData) => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');

    // Show a loading indicator in the new window or main window
    const toastId = toast.loading('Generating receipt...');

    let violation = violationData;
    try {
      // Fetch fresh data to ensure status is up to date
      const response = await violationsAPI.getViolation(violationData.id);
      if (response.data && response.data.data) {
        violation = response.data.data;
      }
    } catch (error) {
      console.error('Failed to fetch latest violation data:', error);
      // Fallback to existing data if fetch fails
      toast.error('Using cached data (failed to refresh)', { id: toastId });
    }

    // Parse the violation date for display
    const violationDate = parseDisplayDate(violation.datetime || violation.captured_at || violation.created_at);

    // Get logo as base64
    let logoDataUrl = '';
    try {
      const response = await fetch('/logo2.png');
      const blob = await response.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to load logo:', error);
    }

    toast.success('Receipt generated', { id: toastId });

    // Generate the receipt HTML
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Violation Receipt - ${violation.violation_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header img.logo {
            max-width: 120px;
            height: auto;
            margin: 0 auto 15px auto;
            display: block;
          }
          .header h1 {
            margin: 0;
            color: #2563eb;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-weight: bold;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-bottom: 10px;
            color: #2563eb;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .info-item {
            margin-bottom: 8px;
          }
          .info-label {
            font-weight: bold;
            display: inline-block;
            width: 150px;
          }
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-line {
            flex: 1;
            border-top: 1px solid #333;
            margin-top: 60px;
            padding-top: 10px;
            text-align: center;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
          }
          @media print {
            body {
              padding: 10px;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" class="logo" />` : ''}
          <h1>e-Traffic Violation System</h1>
          <p>Official Violation Receipt</p>
          <p>Generated: ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="section">
          <div class="section-title">Violation Details</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Violation #:</span>
              <span>${violation.violation_number}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Status:</span>
              <span style="text-transform: capitalize; font-weight: bold;">${violation.status}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Date & Time:</span>
              <span>${violationDate.toLocaleString()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Enforcer:</span>
              <span>${violation.enforcer_name} (${violation.enforcer_badge})</span>
            </div>
            <div class="info-item">
              <span class="info-label">Location:</span>
              <span>${violation.location}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Violation Type:</span>
              <span>${violation.violation_type}</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Violator Information</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Name:</span>
              <span>${violation.violator_name}</span>
            </div>
            <div class="info-item">
              <span class="info-label">License #:</span>
              <span>${violation.violator_license || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone:</span>
              <span>${violation.violator_phone || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Address:</span>
              <span>${violation.violator_address || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Vehicle Information</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Plate #:</span>
              <span>${violation.vehicle_plate}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Model:</span>
              <span>${violation.vehicle_model || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Color:</span>
              <span>${violation.vehicle_color || 'N/A'}</span>
            </div>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Financial Details</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Fine Amount:</span>
              <span>₱${violation.fine_amount?.toLocaleString()}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Repeat Offender:</span>
              <span>${violation.is_repeat_offender ? 'Yes' : 'No'}</span>
            </div>
            ${violation.is_repeat_offender ? `
            <div class="info-item">
              <span class="info-label">Previous Violations:</span>
              <span>${violation.previous_violations_count}</span>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Description</div>
          <p>${violation.violation_description || 'No description provided'}</p>
        </div>
        
        <div class="signature-section">
          <div class="signature-line">
            Enforcer Signature
          </div>
          <div class="signature-line">
            Violator Signature
          </div>
        </div>
        
        <div class="footer">
          <p>This is an official receipt for traffic violation. Please keep this document for your records.</p>
          <p>System Generated Receipt - ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background-color: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
            Print Receipt
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background-color: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
            Close
          </button>
        </div>
      </body>
      </html>
    `;

    // Write the HTML to the new window
    printWindow.document.write(receiptHTML);
    printWindow.document.close();

    // Focus the window and trigger print when it loads
    printWindow.onload = function () {
      printWindow.focus();
      // Uncomment the line below if you want to automatically trigger print
      // printWindow.print();
    };
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 0v8m0-8l-8 8-4-4-6 6" />
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
      <div className={`border rounded-lg p-4 ${filters.status === 'pending'
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
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 10-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="ml-3">
            <h3 className={`text-sm font-medium ${filters.status === 'pending' ? 'text-warning-800' : 'text-blue-800'
              }`}>
              {filters.status === 'pending' ? 'Pending Violations View' : 'IoT Device Integration'}
            </h3>
            <div className={`mt-2 text-sm ${filters.status === 'pending' ? 'text-warning-700' : 'text-blue-700'
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
                className="block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base transition-colors duration-200"
                placeholder="Search violation types..."
                value={filters.violation_type}
                onChange={(e) => handleFilterChange('violation_type', e.target.value)}
              />
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
                  Location
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
                  <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                    {violation.location}
                  </td>
                  <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div className="font-medium text-gray-900">
                        {parseDisplayDate(violation.datetime || violation.captured_at || violation.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {parseDisplayDate(violation.datetime || violation.captured_at || violation.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">

                      <button
                        onClick={() => handleEdit(violation)}
                        className="text-warning-600 hover:text-warning-900 p-1 rounded-md hover:bg-warning-50 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePrintReceipt(violation)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors"
                        title="Print Receipt"
                      >
                        <Printer className="h-4 w-4" />
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
                  {editingViolation.violator_phone && (
                    <p><span className="font-medium text-gray-900">Phone:</span> {editingViolation.violator_phone}</p>
                  )}
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
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={`mobile-select w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200 ${formErrors.status ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
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

              {/* SMS Notification Option - Only show when status is 'paid' or being changed to 'paid' */}
              {(editingViolation.status === 'paid' || selectedStatus === 'paid') && editingViolation.violator_phone && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="sendSMS"
                        name="sendSMS"
                        type="checkbox"
                        defaultChecked={editingViolation.status === 'paid'}
                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="sendSMS" className="font-medium text-gray-700">
                        Send SMS Notification
                      </label>
                      <p className="text-gray-500">
                        Notify the violator that their violation has been marked as paid.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Penalty Reminder Option - Only show when status is 'issued' or being changed to 'issued' */}
              {(editingViolation.status === 'issued' || selectedStatus === 'issued') && editingViolation.violator_phone && (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mt-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="sendPenaltyReminder"
                        name="sendPenaltyReminder"
                        type="checkbox"
                        defaultChecked={false}
                        className="focus:ring-yellow-500 h-4 w-4 text-yellow-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="sendPenaltyReminder" className="font-medium text-gray-700">
                        Send Penalty Reminder
                      </label>
                      <p className="text-gray-500">
                        Send a penalty reminder SMS to the violator for overdue payments.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Administrative Notes
                </label>
                <textarea
                  name="notes"
                  rows="4"
                  defaultValue={editingViolation.notes || ''}
                  placeholder="Add administrative notes or updates..."
                  className={`mobile-input w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-colors duration-200 ${formErrors.notes ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
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
                  disabled={updateViolationMutation.isPending || sendSMSMutation.isPending}
                  className="mobile-btn-primary flex-1"
                >
                  {updateViolationMutation.isPending || sendSMSMutation.isPending ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {sendSMSMutation.isPending ? 'Sending SMS...' : 'Updating...'}
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
                    setSelectedStatus('');
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
