const express = require('express');
const { protect, adminOnly } = require('../middleware/auth');
const { getAuditLogs, getAuditStats } = require('../utils/auditLogger');
const { getFirebaseService } = require('../config/database');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, adminOnly);

// @desc    Get audit logs with pagination and filtering
// @route   GET /api/audit/logs
// @access  Private (Admin only)
router.get('/logs', async (req, res) => {
  try {
    const { 
      page, 
      limit, 
      userId, 
      action, 
      tableName, 
      startDate, 
      endDate 
    } = req.query;

    const result = await getAuditLogs({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      userId,
      action,
      tableName,
      startDate,
      endDate
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get audit statistics
// @route   GET /api/audit/stats
// @access  Private (Admin only)
router.get('/stats', async (req, res) => {
  try {
    const result = await getAuditStats();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get audit log details by ID
// @route   GET /api/audit/logs/:id
// @access  Private (Admin only)
router.get('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const firebaseService = getFirebaseService();

    const auditLog = await firebaseService.findById('audit_logs', id);

    if (!auditLog) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    // Get user details if exists
    if (auditLog.user_id) {
      try {
        const user = await firebaseService.findById('users', auditLog.user_id);
        auditLog.user_name = user ? user.full_name : 'Unknown';
        auditLog.user_email = user ? user.email : 'Unknown';
        auditLog.user_role = user ? user.role : 'Unknown';
      } catch (error) {
        console.error(`Error fetching user for audit log ${auditLog.id}:`, error);
        auditLog.user_name = 'Unknown';
        auditLog.user_email = 'Unknown';
        auditLog.user_role = 'Unknown';
      }
    }

    res.status(200).json({
      success: true,
      data: auditLog
    });

  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get recent audit activity (last 24 hours)
// @route   GET /api/audit/recent
// @access  Private (Admin only)
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const firebaseService = getFirebaseService();

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Get audit logs from the last 24 hours
    const recentLogs = await firebaseService.getAuditLogsWithUser(
      {}, 
      { 
        limit: parseInt(limit),
        orderBy: { field: 'created_at', direction: 'desc' }
      }
    );

    // Filter by date in memory (since Firebase doesn't support date range queries easily)
    const filteredLogs = recentLogs.filter(log => {
      if (!log.created_at) return false;
      const logDate = new Date(log.created_at.toDate ? log.created_at.toDate() : log.created_at);
      return logDate >= twentyFourHoursAgo;
    });

    res.status(200).json({
      success: true,
      data: filteredLogs
    });

  } catch (error) {
    console.error('Get recent audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @desc    Get audit logs by user
// @route   GET /api/audit/user/:userId
// @access  Private (Admin only)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const result = await getAuditLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      userId
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.message
      });
    }

    res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Get user audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;