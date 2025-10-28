const { getFirebaseService } = require('../config/database');

/**
 * Log audit trail for user actions
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action being performed (e.g., 'CREATE_ENFORCER', 'UPDATE_VIOLATION')
 * @param {string} tableName - Database table being affected
 * @param {string} recordId - ID of the record being affected
 * @param {object} oldValues - Previous values (for updates)
 * @param {object} newValues - New values (for creates/updates)
 * @param {object} req - Express request object (for IP and User-Agent)
 */
const logAudit = async (userId, action, tableName, recordId = null, oldValues = null, newValues = null, req = null) => {
  try {
    const firebaseService = getFirebaseService();
    
    // Get IP address and User-Agent from request
    const ipAddress = req ? (req.ip || req.connection?.remoteAddress || 'unknown') : 'system';
    const userAgent = req ? req.get('User-Agent') || 'unknown' : 'system';

    // Create audit log entry
    await firebaseService.createAuditLog({
      user_id: userId,
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      user_agent: userAgent
    });

    console.log(`✅ Audit logged: ${action} on ${tableName} by user ${userId}`);
  } catch (error) {
    console.error('❌ Audit logging failed:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Get audit logs with pagination and filtering
 * @param {object} filters - Filter options
 * @returns {object} Audit logs with pagination
 */
const getAuditLogs = async (filters = {}) => {
  try {
    const firebaseService = getFirebaseService();
    const { 
      page = 1, 
      limit = 10, 
      userId = '', 
      action = '', 
      tableName = '',
      startDate = '',
      endDate = ''
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = {};

    // Add filters
    if (userId) {
      conditions.user_id = userId;
    }

    if (tableName) {
      conditions.table_name = tableName;
    }

    // Get audit logs with user information
    const logs = await firebaseService.getAuditLogsWithUser(conditions, {
      orderBy: { field: 'created_at', direction: 'desc' },
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Filter by action and date if specified (Firebase doesn't support LIKE queries)
    let filteredLogs = logs;
    
    if (action) {
      filteredLogs = filteredLogs.filter(log => 
        log.action && log.action.toLowerCase().includes(action.toLowerCase())
      );
    }

    if (startDate || endDate) {
      filteredLogs = filteredLogs.filter(log => {
        if (!log.created_at) return false;
        
        const logDate = new Date(log.created_at.toDate ? log.created_at.toDate() : log.created_at);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        if (start && logDate < start) return false;
        if (end && logDate > end) return false;
        
        return true;
      });
    }

    // Get total count
    const totalCount = await firebaseService.count('audit_logs', conditions);

    return {
      success: true,
      data: {
        logs: filteredLogs,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(totalCount / limit),
          totalRecords: totalCount
        }
      }
    };

  } catch (error) {
    console.error('Get audit logs error:', error);
    return { 
      success: false, 
      message: 'Failed to get audit logs',
      error: error.message 
    };
  }
};

/**
 * Get audit statistics
 * @returns {object} Audit statistics
 */
const getAuditStats = async () => {
  try {
    const firebaseService = getFirebaseService();
    
    // Get total audit logs
    const totalLogs = await firebaseService.count('audit_logs');
    
    // Get all logs for statistics
    const allLogs = await firebaseService.getAuditLogs({}, { limit: 1000 });
    
    // Get logs by action
    const logsByAction = {};
    const logsByTable = {};
    const recentActivity = {};
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    allLogs.forEach(log => {
      // Count by action
      if (log.action) {
        logsByAction[log.action] = (logsByAction[log.action] || 0) + 1;
      }
      
      // Count by table
      if (log.table_name) {
        logsByTable[log.table_name] = (logsByTable[log.table_name] || 0) + 1;
      }
      
      // Count recent activity
      if (log.created_at) {
        const logDate = new Date(log.created_at.toDate ? log.created_at.toDate() : log.created_at);
        if (logDate >= sevenDaysAgo) {
          const dateKey = logDate.toISOString().split('T')[0];
          recentActivity[dateKey] = (recentActivity[dateKey] || 0) + 1;
        }
      }
    });

    // Convert to arrays for consistency with MySQL version
    const logsByActionArray = Object.entries(logsByAction)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count);
    
    const logsByTableArray = Object.entries(logsByTable)
      .map(([table_name, count]) => ({ table_name, count }))
      .sort((a, b) => b.count - a.count);
    
    const recentActivityArray = Object.entries(recentActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      success: true,
      data: {
        totalLogs,
        logsByAction: logsByActionArray,
        logsByTable: logsByTableArray,
        recentActivity: recentActivityArray
      }
    };

  } catch (error) {
    console.error('Get audit stats error:', error);
    return { 
      success: false, 
      message: 'Failed to get audit statistics',
      error: error.message 
    };
  }
};

module.exports = {
  logAudit,
  getAuditLogs,
  getAuditStats
};
