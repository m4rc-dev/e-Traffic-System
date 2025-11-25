const axios = require('axios');
const { getFirebaseService } = require('../config/database');

// Function to format phone number for iprogsms.com
// iprogsms.com accepts phone numbers in local format (09xxxxxxxxx) or international format (+639xxxxxxxxx)
const formatPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) return null;
  
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Handle different phone number formats
  if (cleaned.startsWith('+63')) {
    // Already in correct international format, convert to local format for iprogsms
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('63')) {
    // International format without +
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    // Local format without leading 0
    cleaned = '0' + cleaned;
  }
  // If it already starts with 0 and is 11 digits, keep as is
  
  // Validate that it's now in correct local format (09xxxxxxxxx)
  if (/^09\d{9}$/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
};

const sendSMS = async (phoneNumber, message, violationId = null) => {
  try {
    const firebaseService = getFirebaseService();
    
    // Check if SMS is enabled in system settings
    const smsSetting = await firebaseService.findSettingByKey('sms_enabled');

    if (!smsSetting || smsSetting.setting_value !== 'true') {
      console.log('SMS notifications are disabled');
      return { success: false, message: 'SMS notifications are disabled' };
    }

    // Get SMS configuration for iprogsms.com
    const apiToken = process.env.IPROGSMS_API_TOKEN || '1e285b5aa3b0e31fce7f7a40dc69a5789a1f43a1'; // Default to your provided API token
    const apiUrl = 'https://www.iprogsms.com/api/v1/sms_messages';
    
    if (!apiToken) {
      console.error('SMS configuration missing: API token required');
      return { success: false, message: 'SMS configuration missing' };
    }

    // Format phone number
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    if (!formattedPhoneNumber) {
      return { success: false, message: 'Invalid phone number format' };
    }

    // Prepare SMS payload for iprogsms.com
    const smsPayload = {
      api_token: apiToken,
      phone_number: formattedPhoneNumber,
      message: message
    };

    // Send SMS to iprogsms.com
    const response = await axios.post(apiUrl, smsPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    // Log SMS attempt
    await firebaseService.createSmsLog({
      violation_id: violationId,
      phone_number: formattedPhoneNumber,
      message: message,
      status: response.data.status === 200 ? 'sent' : 'failed',
      api_response: JSON.stringify(response.data)
    });

    if (response.data.status === 200) {
      console.log(`SMS sent successfully to ${formattedPhoneNumber}`);
      return { success: true, message: 'SMS sent successfully' };
    } else {
      console.error('SMS sending failed:', response.data);
      return { success: false, message: response.data.message || 'SMS sending failed' };
    }

  } catch (error) {
    console.error('SMS service error:', error);

    // Log failed SMS attempt
    try {
      const firebaseService = getFirebaseService();
      
      await firebaseService.createSmsLog({
        violation_id: violationId,
        phone_number: phoneNumber || 'unknown',
        message: message || 'unknown',
        status: 'failed',
        api_response: JSON.stringify({ 
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        })
      });
    } catch (logError) {
      console.error('Failed to log SMS error:', logError);
    }

    return { 
      success: false, 
      message: error.response?.data?.message || error.message || 'SMS sending failed' 
    };
  }
};

const getSMSLogs = async (filters = {}) => {
  try {
    const { page = 1, limit = 10, status = '', phone_number = '' } = filters;
    const offset = (page - 1) * limit;
    
    const firebaseService = getFirebaseService();

    // Build conditions for Firebase
    const conditions = {};
    
    if (status) {
      conditions.status = status;
    }
    
    if (phone_number) {
      conditions.phone_number = phone_number;
    }

    // Get SMS logs
    const logs = await firebaseService.getSmsLogs(conditions, { 
      offset: offset,
      limit: parseInt(limit)
    });

    // Get total count
    const totalLogs = await firebaseService.count('sms_logs', conditions);
    
    return {
      success: true,
      data: {
        logs,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalLogs / limit),
          totalRecords: totalLogs
        }
      }
    };

  } catch (error) {
    console.error('Get SMS logs error:', error);
    return { success: false, message: 'Failed to get SMS logs' };
  }
};

const getSMSStats = async () => {
  try {
    const firebaseService = getFirebaseService();
    
    // Get total SMS sent
    const totalSMS = await firebaseService.count('sms_logs');
    
    // Get SMS by status
    const allLogs = await firebaseService.getSmsLogs({}, { limit: 1000 });
    const smsByStatusObj = {};
    allLogs.forEach(log => {
      const status = log.status || 'unknown';
      smsByStatusObj[status] = (smsByStatusObj[status] || 0) + 1;
    });
    
    const smsByStatus = Object.entries(smsByStatusObj).map(([status, count]) => ({
      status,
      count
    }));
    
    // For monthly stats, we would need to implement a different approach in Firebase
    // as it doesn't have built-in date grouping like SQL
    const smsByMonth = [];

    return {
      success: true,
      data: {
        totalSMS: totalSMS,
        smsByStatus,
        smsByMonth
      }
    };

  } catch (error) {
    console.error('Get SMS stats error:', error);
    return { success: false, message: 'Failed to get SMS statistics' };
  }
};

module.exports = {
  sendSMS,
  getSMSLogs,
  getSMSStats
};