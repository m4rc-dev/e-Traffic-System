const { query } = require('../config/database');

/**
 * Log audit trail for user actions
 * @param {number} userId - ID of the user performing the action
 * @param {string} action - Action being performed (e.g., 'CREATE_ENFORCER', 'UPDATE_VIOLATION')
 * @param {string} tableName - Database table being affected
 * @param {number} recordId - ID of the record being affected
 * @param {object} oldValues - Previous values (for updates)
 * @param {object} newValues - New values (for creates/updates)
 * @param {object} req - Express request object (for IP and User-Agent)
 */
const logAudit = async (userId, action, tableName, recordId = null, oldValues = null, newValues = null, req = null) => {
  try {
    // Get IP address and User-Agent from request
    const ipAddress = req ? (req.ip || req.connection?.remoteAddress || 'unknown') : 'system';
    const userAgent = req ? req.get('User-Agent') || 'unknown' : 'system';

    // Insert audit log
    await query(`
      INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      action,
      tableName,
      recordId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    ]);

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
    let whereClause = 'WHERE 1=1';
    let params = [];

    // Add filters
    if (userId) {
      whereClause += ' AND al.user_id = ?';
      params.push(userId);
    }

    if (action) {
      whereClause += ' AND al.action LIKE ?';
      params.push(`%${action}%`);
    }

    if (tableName) {
      whereClause += ' AND al.table_name = ?';
      params.push(tableName);
    }

    if (startDate) {
      whereClause += ' AND DATE(al.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND DATE(al.created_at) <= ?';
      params.push(endDate);
    }

    // Get audit logs with user information
    const logs = await query(`
      SELECT 
        al.*,
        u.full_name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `, params);

    // Get total count
    const [totalCount] = await query(`
      SELECT COUNT(*) as count 
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
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
    // Get total audit logs
    const [totalLogs] = await query('SELECT COUNT(*) as count FROM audit_logs');
    
    // Get logs by action
    const logsByAction = await query(`
      SELECT action, COUNT(*) as count 
      FROM audit_logs 
      GROUP BY action 
      ORDER BY count DESC
    `);
    
    // Get logs by table
    const logsByTable = await query(`
      SELECT table_name, COUNT(*) as count 
      FROM audit_logs 
      WHERE table_name IS NOT NULL
      GROUP BY table_name 
      ORDER BY count DESC
    `);
    
    // Get recent activity (last 7 days)
    const recentActivity = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM audit_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    return {
      success: true,
      data: {
        totalLogs: totalLogs.count,
        logsByAction,
        logsByTable,
        recentActivity
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
