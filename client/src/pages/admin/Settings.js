import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../../services/api';
import { 
  Save, 
  Settings as SettingsIcon, 
  MessageSquare, 
  Shield, 
  Database, 
  Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../../components/LoadingSpinner';

const SettingSection = ({ title, description, icon: Icon, children }) => (
  <div className="card">
    <div className="card-header">
      <div className="flex items-center">
        <div className="flex-shrink-0 p-2 rounded-md bg-primary-100">
          <Icon className="h-5 w-5 text-primary-600" />
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
    <div className="card-body">
      {children}
    </div>
  </div>
);

const FormField = ({ label, children, required = false, error }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
  </div>
);

function Settings() {
  const [formData, setFormData] = useState({
    system_name: '',
    system_description: '',
    admin_email: '',
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    currency: 'PHP',
    sms_api_key: '',
    sms_api_url: '',
    sms_sender_id: '',
    sms_enabled: false, // Optional for admin notifications only
    session_timeout: 30,
    max_login_attempts: 5,
    password_min_length: 8,
    require_strong_password: true,
    email_notifications: true, // For admin alerts
    violation_alerts: true, // For system events
    debug_mode: false,
    auto_backup: true
  });

  const [errors, setErrors] = useState({});
  const queryClient = useQueryClient();

  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['adminSettings'],
    queryFn: adminAPI.getSettings
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => adminAPI.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['adminSettings']);
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    }
  });

  useEffect(() => {
    if (currentSettings?.data) {
      setFormData(prev => ({
        ...prev,
        ...currentSettings.data
      }));
    }
  }, [currentSettings]);

  const handleInputChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
    
    if (errors[key]) {
      setErrors(prev => ({
        ...prev,
        [key]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.system_name.trim()) {
      newErrors.system_name = 'System name is required';
    }

    if (!formData.admin_email.trim()) {
      newErrors.admin_email = 'Admin email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.admin_email)) {
      newErrors.admin_email = 'Please enter a valid email address';
    }

    if (formData.sms_enabled && !formData.sms_api_key.trim()) {
      newErrors.sms_api_key = 'SMS API key is required when SMS is enabled';
    }

    if (formData.sms_enabled && !formData.sms_api_url.trim()) {
      newErrors.sms_api_url = 'SMS API URL is required when SMS is enabled';
    }

    if (formData.password_min_length < 6) {
      newErrors.password_min_length = 'Minimum password length must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    updateSettingsMutation.mutate(formData);
  };

  const handleReset = () => {
    if (currentSettings?.data) {
      setFormData(prev => ({
        ...prev,
        ...currentSettings.data
      }));
    }
    setErrors({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure system preferences and admin settings (Violation processing handled by IoT device)
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <SettingSection
          title="General Settings"
          description="Basic system configuration and appearance"
          icon={SettingsIcon}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="System Name" required error={errors.system_name}>
              <input
                type="text"
                value={formData.system_name}
                onChange={(e) => handleInputChange('system_name', e.target.value)}
                className="input"
                placeholder="e-Traffic System"
              />
            </FormField>

            <FormField label="System Description">
              <input
                type="text"
                value={formData.system_description}
                onChange={(e) => handleInputChange('system_description', e.target.value)}
                className="input"
                placeholder="Traffic violation management system"
              />
            </FormField>

            <FormField label="Admin Email" required error={errors.admin_email}>
              <input
                type="email"
                value={formData.admin_email}
                onChange={(e) => handleInputChange('admin_email', e.target.value)}
                className="input"
                placeholder="admin@etraffic.com"
              />
            </FormField>

            <FormField label="Timezone">
              <select
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="input"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </FormField>

            <FormField label="Date Format">
              <select
                value={formData.date_format}
                onChange={(e) => handleInputChange('date_format', e.target.value)}
                className="input"
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              </select>
            </FormField>

            <FormField label="Currency">
              <select
                value={formData.currency}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="input"
              >
                <option value="PHP">PHP (₱)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CAD">CAD (C$)</option>
              </select>
            </FormField>
          </div>
        </SettingSection>

        <SettingSection
          title="SMS Configuration (Optional)"
          description="Configure SMS gateway for system admin notifications (IoT device handles violation SMS)"
          icon={MessageSquare}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Enable SMS Notifications">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="sms_enabled"
                  checked={formData.sms_enabled}
                  onChange={(e) => handleInputChange('sms_enabled', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="sms_enabled" className="ml-2 text-sm text-gray-700">
                  Enable SMS notifications
                </label>
              </div>
            </FormField>

            <FormField label="SMS Sender ID">
              <input
                type="text"
                value={formData.sms_sender_id}
                onChange={(e) => handleInputChange('sms_sender_id', e.target.value)}
                className="input"
                placeholder="eTraffic"
                disabled={!formData.sms_enabled}
              />
            </FormField>

            <FormField 
              label="SMS API Key" 
              required={formData.sms_enabled}
              error={errors.sms_api_key}
            >
              <input
                type="password"
                value={formData.sms_api_key}
                onChange={(e) => handleInputChange('sms_api_key', e.target.value)}
                className="input"
                placeholder="Your SMS API key"
                disabled={!formData.sms_enabled}
              />
            </FormField>

            <FormField 
              label="SMS API URL" 
              required={formData.sms_enabled}
              error={errors.sms_api_url}
            >
              <input
                type="url"
                value={formData.sms_api_url}
                onChange={(e) => handleInputChange('sms_api_url', e.target.value)}
                className="input"
                placeholder="https://api.smsgateway.com/send"
                disabled={!formData.sms_enabled}
              />
            </FormField>
          </div>
        </SettingSection>

        <SettingSection
          title="Security Settings"
          description="Configure authentication and security parameters"
          icon={Shield}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Session Timeout (minutes)">
              <input
                type="number"
                value={formData.session_timeout}
                onChange={(e) => handleInputChange('session_timeout', parseInt(e.target.value))}
                className="input"
                min="5"
                max="480"
              />
            </FormField>

            <FormField label="Max Login Attempts">
              <input
                type="number"
                value={formData.max_login_attempts}
                onChange={(e) => handleInputChange('max_login_attempts', parseInt(e.target.value))}
                className="input"
                min="3"
                max="10"
              />
            </FormField>

            <FormField label="Minimum Password Length" error={errors.password_min_length}>
              <input
                type="number"
                value={formData.password_min_length}
                onChange={(e) => handleInputChange('password_min_length', parseInt(e.target.value))}
                className="input"
                min="6"
                max="20"
              />
            </FormField>

            <FormField label="Require Strong Password">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="require_strong_password"
                  checked={formData.require_strong_password}
                  onChange={(e) => handleInputChange('require_strong_password', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="require_strong_password" className="ml-2 text-sm text-gray-700">
                  Require uppercase, lowercase, numbers, and symbols
                </label>
              </div>
            </FormField>
          </div>
        </SettingSection>

        <SettingSection
          title="System Notifications"
          description="Configure system notification settings (IoT device handles violation notifications)"
          icon={Bell}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Admin Email Alerts">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="email_notifications"
                  checked={formData.email_notifications}
                  onChange={(e) => handleInputChange('email_notifications', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="email_notifications" className="ml-2 text-sm text-gray-700">
                  Send admin email notifications
                </label>
              </div>
            </FormField>

            <FormField label="System Alerts">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="violation_alerts"
                  checked={formData.violation_alerts}
                  onChange={(e) => handleInputChange('violation_alerts', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="violation_alerts" className="ml-2 text-sm text-gray-700">
                  Alert on system events
                </label>
              </div>
            </FormField>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> Violation notifications to violators are handled automatically by your IoT device.
            </p>
          </div>
        </SettingSection>

        <SettingSection
          title="System Configuration"
          description="Basic system settings and maintenance options"
          icon={Database}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Debug Mode">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="debug_mode"
                  checked={formData.debug_mode}
                  onChange={(e) => handleInputChange('debug_mode', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="debug_mode" className="ml-2 text-sm text-gray-700">
                  Enable debug logging
                </label>
              </div>
            </FormField>

            <FormField label="Auto Backup">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="auto_backup"
                  checked={formData.auto_backup}
                  onChange={(e) => handleInputChange('auto_backup', e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="auto_backup" className="ml-2 text-sm text-gray-700">
                  Enable automatic backups
                </label>
              </div>
            </FormField>
          </div>
          
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              <strong>IoT Integration:</strong> Your handheld device manages violation processing and notifications automatically.
            </p>
          </div>
        </SettingSection>

        <div className="flex justify-end space-x-4 pt-6">
          <button
            type="button"
            onClick={handleReset}
            className="btn-secondary"
            disabled={updateSettingsMutation.isPending}
          >
            Reset to Default
          </button>
          <button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="btn-primary flex items-center gap-2"
          >
            {updateSettingsMutation.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}

export default Settings;
