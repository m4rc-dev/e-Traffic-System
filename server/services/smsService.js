const axios = require('axios');
const { query } = require('../config/database');

const sendSMS = async (phoneNumber, message, violationId = null) => {
  try {
    // Check if SMS is enabled in system settings
    const [smsSetting] = await query(
      'SELECT setting_value FROM system_settings WHERE setting_key = "sms_enabled"'
    );

    if (!smsSetting || smsSetting.setting_value !== 'true') {
      console.log('SMS notifications are disabled');
      return { success: false, message: 'SMS notifications are disabled' };
    }

    // Get SMS configuration
    const apiKey = process.env.SMS_API_KEY;
    const apiUrl = process.env.SMS_API_URL;
    const senderId = process.env.SMS_SENDER_ID || 'E_TRAFFIC';

    if (!apiKey || !apiUrl) {
      console.error('SMS configuration missing');
      return { success: false, message: 'SMS configuration missing' };
    }

    // Prepare SMS payload (adjust based on your SMS gateway provider)
    const smsPayload = {
      api_key: apiKey,
      to: phoneNumber,
      message: message,
      sender_id: senderId,
      // Add any other required fields for your SMS gateway
    };

    // Send SMS
    const response = await axios.post(apiUrl, smsPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000 // 10 second timeout
    });

    // Log SMS attempt
    await query(`
      INSERT INTO sms_logs (violation_id, phone_number, message, status, api_response)
      VALUES (?, ?, ?, ?, ?)
    `, [
      violationId,
      phoneNumber,
      message,
      response.data.success ? 'sent' : 'failed',
      JSON.stringify(response.data)
    ]);

    if (response.data.success) {
      console.log(`SMS sent successfully to ${phoneNumber}`);
      return { success: true, message: 'SMS sent successfully' };
    } else {
      console.error('SMS sending failed:', response.data);
      return { success: false, message: response.data.message || 'SMS sending failed' };
    }

  } catch (error) {
    console.error('SMS service error:', error);

    // Log failed SMS attempt
    try {
      await query(`
        INSERT INTO sms_logs (violation_id, phone_number, message, status, api_response)
        VALUES (?, ?, ?, ?, ?)
      `, [
        violationId,
        phoneNumber,
        message,
        'failed',
        JSON.stringify({ error: error.message })
      ]);
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

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (phone_number) {
      whereClause += ' AND phone_number LIKE ?';
      params.push(`%${phone_number}%`);
    }

    // Get SMS logs
    const logs = await query(`
      SELECT 
        sl.*,
        v.violation_number,
        v.violator_name
      FROM sms_logs sl
      LEFT JOIN violations v ON sl.violation_id = v.id
      ${whereClause}
      ORDER BY sl.sent_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    // Get total count
    const [totalCount] = await query(`
      SELECT COUNT(*) as count 
      FROM sms_logs sl
      LEFT JOIN violations v ON sl.violation_id = v.id
      ${whereClause}
    `, params);

    return {
      success: true,
      data: {
        logs,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCount.count / limit),
          totalRecords: totalCount.count
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
    // Get total SMS sent
    const [totalSMS] = await query('SELECT COUNT(*) as count FROM sms_logs');
    
    // Get SMS by status
    const smsByStatus = await query(`
      SELECT status, COUNT(*) as count 
      FROM sms_logs 
      GROUP BY status
    `);
    
    // Get SMS by month (last 6 months)
    const smsByMonth = await query(`
      SELECT 
        DATE_FORMAT(sent_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM sms_logs 
      WHERE sent_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY DATE_FORMAT(sent_at, '%Y-%m')
      ORDER BY month DESC
    `);

    return {
      success: true,
      data: {
        totalSMS: totalSMS.count,
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
